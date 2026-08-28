-- ISSUE-28: Teacher-owned Batch PDF roots and logical page-range references.

alter table public.artifacts
  add column if not exists owner_teacher_id uuid references public.teachers(id) on delete cascade;

create index if not exists idx_artifacts_owner_teacher
  on public.artifacts (owner_teacher_id, created_at desc)
  where owner_teacher_id is not null;

alter table public.artifacts
  drop constraint if exists artifacts_exactly_one_owner;
alter table public.artifacts
  add constraint artifacts_exactly_one_owner
  check ((submission_id is null) <> (owner_teacher_id is null)) not valid;

-- Artifact writes are exposed only through fixed-shape RPCs. Reads accept the
-- existing Submission ownership path or the approved pre-matching Teacher path.
drop policy if exists artifacts_all on public.artifacts;
drop policy if exists artifacts_owned_select on public.artifacts;
create policy artifacts_owned_select on public.artifacts for select
  using (
    owner_teacher_id = public.current_teacher_id()
    or exists (
      select 1
      from public.submissions submission
      join public.activity_assignments assignment
        on assignment.id = submission.activity_assignment_id
      join public.activities activity on activity.id = assignment.activity_id
      join public.classes class on class.id = assignment.class_id
      join public.students student
        on student.id = submission.student_id
       and student.class_id = assignment.class_id
      where submission.id = artifacts.submission_id
        and activity.teacher_id = public.current_teacher_id()
        and class.teacher_id = public.current_teacher_id()
    )
  );

create or replace function public.record_teacher_batch_pdf(
  p_artifact_id uuid,
  p_storage_path text,
  p_file_name text,
  p_file_size_bytes bigint,
  p_checksum text,
  p_page_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_expected_path text;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  v_expected_path := 'teachers/' || v_teacher_id::text || '/batches/'
    || p_artifact_id::text || '/original/' || p_artifact_id::text || '.pdf';
  if p_storage_path <> v_expected_path then
    raise exception using errcode = '22023', message = 'Invalid Batch PDF storage path';
  end if;
  if nullif(btrim(coalesce(p_file_name, '')), '') is null or char_length(p_file_name) > 255 then
    raise exception using errcode = '22023', message = 'Invalid Batch PDF file name';
  end if;
  if p_file_size_bytes < 1 or p_file_size_bytes > 31457280 then
    raise exception using errcode = '22023', message = 'Batch PDF exceeds the 30 MB limit';
  end if;
  if p_page_count < 1 or p_page_count > 100 then
    raise exception using errcode = '22023', message = 'Batch PDF page count is outside 1 to 100';
  end if;
  if p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Batch PDF checksum';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'trace' and object.name = p_storage_path
  ) then
    raise exception using errcode = '22023', message = 'Private Batch PDF object is required before Artifact record';
  end if;

  insert into public.artifacts (
    id, submission_id, owner_teacher_id, source_artifact_id, storage_path,
    file_name, mime_type, file_size_bytes, checksum, artifact_role,
    attempt_no, page_start, page_end
  ) values (
    p_artifact_id, null, v_teacher_id, null, p_storage_path,
    p_file_name, 'application/pdf', p_file_size_bytes, p_checksum, 'ORIGINAL',
    1, 1, p_page_count
  );

  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    v_teacher_id, 'ARTIFACT_UPLOAD', 'Artifact', p_artifact_id,
    gen_random_uuid()::text, null
  );

  return p_artifact_id;
end;
$$;

revoke all on function public.record_teacher_batch_pdf(uuid, text, text, bigint, text, integer) from public;
grant execute on function public.record_teacher_batch_pdf(uuid, text, text, bigint, text, integer) to authenticated;

create or replace function public.replace_teacher_batch_page_ranges(
  p_source_artifact_id uuid,
  p_ranges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_source public.artifacts%rowtype;
  v_result jsonb;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_source
  from public.artifacts artifact
  where artifact.id = p_source_artifact_id
    and artifact.owner_teacher_id = v_teacher_id
    and artifact.submission_id is null
    and artifact.source_artifact_id is null
    and artifact.artifact_role = 'ORIGINAL'
    and artifact.mime_type = 'application/pdf'
  for update;

  if v_source.id is null then
    raise exception using errcode = '42501', message = 'Batch PDF is outside current Teacher scope';
  end if;
  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array'
     or jsonb_array_length(p_ranges) < 1
     or jsonb_array_length(p_ranges) > 100 then
    raise exception using errcode = '22023', message = 'Batch PDF ranges must be a non-empty array of at most 100 items';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_ranges) item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value ->> 'page_start', '') !~ '^[1-9][0-9]{0,2}$'
      or coalesce(item.value ->> 'page_end', '') !~ '^[1-9][0-9]{0,2}$'
      or (item.value ->> 'page_start')::integer > (item.value ->> 'page_end')::integer
      or (item.value ->> 'page_end')::integer > v_source.page_end
  ) then
    raise exception using errcode = '22023', message = 'Batch PDF range is outside the source page count';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_ranges) with ordinality first_range(value, position)
    join jsonb_array_elements(p_ranges) with ordinality second_range(value, position)
      on first_range.position < second_range.position
     and (first_range.value ->> 'page_start')::integer <= (second_range.value ->> 'page_end')::integer
     and (second_range.value ->> 'page_start')::integer <= (first_range.value ->> 'page_end')::integer
  ) then
    raise exception using errcode = '22023', message = 'Batch PDF ranges must not overlap';
  end if;

  delete from public.artifacts artifact
  where artifact.source_artifact_id = v_source.id
    and artifact.owner_teacher_id = v_teacher_id
    and artifact.submission_id is null
    and artifact.artifact_role = 'DERIVED';

  with inserted as (
    insert into public.artifacts (
      id, submission_id, owner_teacher_id, source_artifact_id, storage_path,
      file_name, mime_type, file_size_bytes, checksum, artifact_role,
      attempt_no, page_start, page_end
    )
    select
      gen_random_uuid(), null, v_teacher_id, v_source.id, v_source.storage_path,
      v_source.file_name, v_source.mime_type, v_source.file_size_bytes,
      v_source.checksum, 'DERIVED', v_source.attempt_no,
      (item.value ->> 'page_start')::integer,
      (item.value ->> 'page_end')::integer
    from jsonb_array_elements(p_ranges) item(value)
    order by (item.value ->> 'page_start')::integer
    returning id, page_start, page_end
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id, 'page_start', page_start, 'page_end', page_end)
      order by page_start
    ),
    '[]'::jsonb
  ) into v_result
  from inserted;

  return v_result;
end;
$$;

revoke all on function public.replace_teacher_batch_page_ranges(uuid, jsonb) from public;
grant execute on function public.replace_teacher_batch_page_ranges(uuid, jsonb) to authenticated;
