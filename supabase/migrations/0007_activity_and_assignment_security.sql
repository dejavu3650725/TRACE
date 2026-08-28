-- ISSUE-09/10: atomic Activity persistence, linear parent enforcement,
-- human-readable Activity Code activation, and owned Class assignment.

create or replace function public.validate_activity_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_activity_id is null then
    return new;
  end if;

  if new.parent_activity_id = new.id then
    raise exception using errcode = '23514', message = 'Activity cannot be its own parent';
  end if;

  if not exists (
    select 1
    from public.activities parent
    where parent.id = new.parent_activity_id
      and parent.teacher_id = new.teacher_id
  ) then
    raise exception using errcode = '42501', message = 'Parent Activity is outside current Teacher scope';
  end if;

  if exists (
    with recursive parent_chain(id, parent_activity_id) as (
      select activity.id, activity.parent_activity_id
      from public.activities activity
      where activity.id = new.parent_activity_id
      union
      select activity.id, activity.parent_activity_id
      from public.activities activity
      join parent_chain chain on activity.id = chain.parent_activity_id
    )
    select 1 from parent_chain where id = new.id
  ) then
    raise exception using errcode = '23514', message = 'Activity parent chain cannot contain a cycle';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_activities_validate_parent on public.activities;
create trigger trg_activities_validate_parent
before insert or update of parent_activity_id, teacher_id on public.activities
for each row execute function public.validate_activity_parent();

create or replace function public.save_activity(
  p_activity_id uuid,
  p_title text,
  p_grade smallint,
  p_subject text,
  p_domain text,
  p_unit text,
  p_activity_type text,
  p_description text,
  p_parent_activity_id uuid,
  p_standard_ids text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_activity_id uuid;
  v_standard_ids text[] := coalesce(p_standard_ids, array[]::text[]);
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or char_length(btrim(p_title)) > 200 then
    raise exception using errcode = '22023', message = 'Invalid Activity title';
  end if;
  if p_grade is not null and (p_grade < 1 or p_grade > 12) then
    raise exception using errcode = '22023', message = 'Invalid Activity grade';
  end if;
  if exists (select 1 from unnest(v_standard_ids) as standard(id) where nullif(btrim(standard.id), '') is null)
     or cardinality(v_standard_ids) > 30
     or cardinality(v_standard_ids) <> (select count(distinct standard.id) from unnest(v_standard_ids) as standard(id)) then
    raise exception using errcode = '22023', message = 'Invalid Activity Standard IDs';
  end if;

  if p_activity_id is null then
    insert into public.activities (
      teacher_id, title, grade, subject, domain, unit, activity_type,
      description, content_json, activity_code, status, parent_activity_id
    ) values (
      v_teacher_id, btrim(p_title), p_grade, nullif(btrim(p_subject), ''),
      nullif(btrim(p_domain), ''), nullif(btrim(p_unit), ''),
      nullif(btrim(p_activity_type), ''), nullif(btrim(p_description), ''),
      null, null, 'DRAFT', p_parent_activity_id
    ) returning id into v_activity_id;
  else
    update public.activities
    set title = btrim(p_title),
        grade = p_grade,
        subject = nullif(btrim(p_subject), ''),
        domain = nullif(btrim(p_domain), ''),
        unit = nullif(btrim(p_unit), ''),
        activity_type = nullif(btrim(p_activity_type), ''),
        description = nullif(btrim(p_description), ''),
        parent_activity_id = p_parent_activity_id
    where id = p_activity_id
      and teacher_id = v_teacher_id
    returning id into v_activity_id;

    if v_activity_id is null then
      raise exception using errcode = '42501', message = 'Activity is outside current Teacher scope';
    end if;
  end if;

  delete from public.activity_standards where activity_id = v_activity_id;
  insert into public.activity_standards (activity_id, standard_id)
  select v_activity_id, btrim(standard.id)
  from unnest(v_standard_ids) as standard(id);

  return v_activity_id;
end;
$$;

create or replace function public.activate_activity(
  p_activity_id uuid,
  p_code_prefix text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_existing_code text;
  v_status public.activity_status;
  v_serial integer;
  v_code text;
begin
  select activity_code, status into v_existing_code, v_status
  from public.activities
  where id = p_activity_id and teacher_id = v_teacher_id;

  if not found then
    raise exception using errcode = '42501', message = 'Activity is outside current Teacher scope';
  end if;
  if v_status = 'ARCHIVED' then
    raise exception using errcode = '22023', message = 'Archived Activity cannot be activated';
  end if;
  if v_existing_code is not null then
    return v_existing_code;
  end if;
  if p_code_prefix !~ '^[A-Z0-9]+-[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = 'Invalid Activity Code prefix';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_code_prefix, 0));
  select coalesce(max(right(activity_code, 3)::integer), 0) + 1 into v_serial
  from public.activities
  where activity_code like p_code_prefix || '-___'
    and right(activity_code, 3) ~ '^[0-9]{3}$';

  if v_serial > 999 then
    raise exception using errcode = '22003', message = 'Activity Code serial exhausted';
  end if;

  v_code := p_code_prefix || '-' || lpad(v_serial::text, 3, '0');
  update public.activities
  set status = 'ACTIVE', activity_code = v_code
  where id = p_activity_id and teacher_id = v_teacher_id;

  return v_code;
end;
$$;

create or replace function public.assign_activity_to_classes(
  p_activity_id uuid,
  p_class_ids uuid[],
  p_open_at timestamptz,
  p_due_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_inserted integer;
  v_class_ids uuid[] := coalesce(p_class_ids, array[]::uuid[]);
begin
  if not exists (
    select 1 from public.activities
    where id = p_activity_id and teacher_id = v_teacher_id and status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'Owned ACTIVE Activity required';
  end if;
  if cardinality(v_class_ids) = 0
     or cardinality(v_class_ids) <> (select count(distinct selected.id) from unnest(v_class_ids) as selected(id)) then
    raise exception using errcode = '22023', message = 'Invalid Class selection';
  end if;
  if (select count(*) from public.classes where id = any(v_class_ids) and teacher_id = v_teacher_id)
     <> cardinality(v_class_ids) then
    raise exception using errcode = '42501', message = 'Class is outside current Teacher scope';
  end if;
  if p_open_at is not null and p_due_at is not null and p_due_at < p_open_at then
    raise exception using errcode = '22023', message = 'Due time must not precede open time';
  end if;

  insert into public.activity_assignments (activity_id, class_id, open_at, due_at, status)
  select p_activity_id, selected.class_id, p_open_at, p_due_at, 'OPEN'
  from unnest(v_class_ids) as selected(class_id)
  on conflict (activity_id, class_id) do nothing;
  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;

create or replace function public.update_activity_assignment(
  p_assignment_id uuid,
  p_status public.activity_assignment_status,
  p_open_at timestamptz,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_assignment_id uuid;
begin
  if p_open_at is not null and p_due_at is not null and p_due_at < p_open_at then
    raise exception using errcode = '22023', message = 'Due time must not precede open time';
  end if;

  update public.activity_assignments assignment
  set status = p_status, open_at = p_open_at, due_at = p_due_at
  from public.activities activity, public.classes class
  where assignment.id = p_assignment_id
    and activity.id = assignment.activity_id
    and class.id = assignment.class_id
    and activity.teacher_id = v_teacher_id
    and class.teacher_id = v_teacher_id
  returning assignment.id into v_assignment_id;

  if v_assignment_id is null then
    raise exception using errcode = '42501', message = 'ActivityAssignment is outside current Teacher scope';
  end if;
  return v_assignment_id;
end;
$$;

revoke all on function public.save_activity(uuid, text, smallint, text, text, text, text, text, uuid, text[]) from public;
revoke all on function public.activate_activity(uuid, text) from public;
revoke all on function public.assign_activity_to_classes(uuid, uuid[], timestamptz, timestamptz) from public;
revoke all on function public.update_activity_assignment(uuid, public.activity_assignment_status, timestamptz, timestamptz) from public;

grant execute on function public.save_activity(uuid, text, smallint, text, text, text, text, text, uuid, text[]) to authenticated;
grant execute on function public.activate_activity(uuid, text) to authenticated;
grant execute on function public.assign_activity_to_classes(uuid, uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function public.update_activity_assignment(uuid, public.activity_assignment_status, timestamptz, timestamptz) to authenticated;
