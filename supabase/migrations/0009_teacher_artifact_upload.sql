-- ISSUE-15: private immutable ORIGINAL Artifact recording and minimal upload audit.

update storage.buckets
set public = false
where id = 'trace';

-- Split the original FOR ALL policy so authenticated Teachers cannot overwrite
-- an existing object. Delete remains available for failed-write compensation
-- and the later DATA_DELETE workflow.
drop policy if exists trace_storage_rw on storage.objects;
drop policy if exists trace_storage_select on storage.objects;
drop policy if exists trace_storage_insert on storage.objects;
drop policy if exists trace_storage_delete on storage.objects;

create policy trace_storage_select on storage.objects for select
  using (
    bucket_id = 'trace'
    and (storage.foldername(name))[1] = 'teachers'
    and (storage.foldername(name))[2] = public.current_teacher_id()::text
  );

create policy trace_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'trace'
    and (storage.foldername(name))[1] = 'teachers'
    and (storage.foldername(name))[2] = public.current_teacher_id()::text
  );

create policy trace_storage_delete on storage.objects for delete
  using (
    bucket_id = 'trace'
    and (storage.foldername(name))[1] = 'teachers'
    and (storage.foldername(name))[2] = public.current_teacher_id()::text
    and not exists (
      select 1 from public.artifacts artifact
      where artifact.storage_path = name
        and artifact.artifact_role = 'ORIGINAL'
    )
  );

create or replace function public.protect_original_artifact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.artifact_role = 'ORIGINAL' and new is distinct from old then
    raise exception using errcode = '23514', message = 'ORIGINAL Artifact is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_artifacts_protect_original on public.artifacts;
create trigger trg_artifacts_protect_original
before update on public.artifacts
for each row execute function public.protect_original_artifact();

-- The ownership policy introduced in ISSUE-03 is intentionally broad. Add
-- restrictive guards so an authenticated browser cannot bypass this issue's
-- audited RPC by inserting, updating or deleting an ORIGINAL row directly.
drop policy if exists artifacts_original_insert_guard on public.artifacts;
drop policy if exists artifacts_original_update_guard on public.artifacts;
drop policy if exists artifacts_original_delete_guard on public.artifacts;

create policy artifacts_original_insert_guard on public.artifacts
  as restrictive for insert
  with check (artifact_role <> 'ORIGINAL');

create policy artifacts_original_update_guard on public.artifacts
  as restrictive for update
  using (artifact_role <> 'ORIGINAL')
  with check (artifact_role <> 'ORIGINAL');

create policy artifacts_original_delete_guard on public.artifacts
  as restrictive for delete
  using (artifact_role <> 'ORIGINAL');

create or replace function public.record_teacher_artifact_upload(
  p_submission_id uuid,
  p_artifact_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_checksum text,
  p_attempt_no smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_current_attempt_no smallint;
  v_expected_prefix text;
  v_expected_suffix text;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select submission.current_attempt_no into v_current_attempt_no
  from public.submissions submission
  join public.students student on student.id = submission.student_id
  join public.activity_assignments assignment on assignment.id = submission.activity_assignment_id
    and assignment.class_id = student.class_id
  join public.activities activity on activity.id = assignment.activity_id
  join public.classes class on class.id = assignment.class_id
  where submission.id = p_submission_id
    and activity.teacher_id = v_teacher_id
    and class.teacher_id = v_teacher_id;

  if v_current_attempt_no is null then
    raise exception using errcode = '42501', message = 'Submission is outside current Teacher scope';
  end if;
  if p_attempt_no <> v_current_attempt_no then
    raise exception using errcode = '22023', message = 'Artifact attempt does not match current Submission attempt';
  end if;

  v_expected_prefix := 'teachers/' || v_teacher_id::text || '/submissions/' || p_submission_id::text || '/original/';
  if left(p_storage_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception using errcode = '22023', message = 'Invalid ORIGINAL Artifact storage path';
  end if;

  if p_mime_type = 'image/jpeg' then
    v_expected_suffix := '.jpg';
  elsif p_mime_type = 'image/png' then
    v_expected_suffix := '.png';
  elsif p_mime_type = 'image/webp' then
    v_expected_suffix := '.webp';
  elsif p_mime_type = 'application/pdf' then
    v_expected_suffix := '.pdf';
  else
    raise exception using errcode = '22023', message = 'Unsupported Artifact MIME type';
  end if;

  if p_storage_path <> (v_expected_prefix || p_artifact_id::text || v_expected_suffix) then
    raise exception using errcode = '22023', message = 'Artifact UUID must match storage object key';
  end if;
  if nullif(btrim(coalesce(p_file_name, '')), '') is null or char_length(p_file_name) > 255 then
    raise exception using errcode = '22023', message = 'Invalid Artifact file name';
  end if;
  if p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Artifact checksum';
  end if;
  if (p_mime_type like 'image/%' and (p_file_size_bytes < 1 or p_file_size_bytes > 10485760))
     or (p_mime_type = 'application/pdf' and (p_file_size_bytes < 1 or p_file_size_bytes > 31457280)) then
    raise exception using errcode = '22023', message = 'Artifact file size is outside the allowed limit';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'trace' and object.name = p_storage_path
  ) then
    raise exception using errcode = '22023', message = 'Private Storage object is required before Artifact record';
  end if;

  insert into public.artifacts (
    id, submission_id, source_artifact_id, storage_path, file_name,
    mime_type, file_size_bytes, checksum, artifact_role, attempt_no
  ) values (
    p_artifact_id, p_submission_id, null, p_storage_path, p_file_name,
    p_mime_type, p_file_size_bytes, p_checksum, 'ORIGINAL', p_attempt_no
  );

  update public.submissions
  set input_status = 'STORED'
  where id = p_submission_id;

  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    v_teacher_id, 'ARTIFACT_UPLOAD', 'Artifact', p_artifact_id, gen_random_uuid()::text, null
  );

  return p_artifact_id;
end;
$$;

revoke all on function public.record_teacher_artifact_upload(uuid, uuid, text, text, text, bigint, text, smallint) from public;
grant execute on function public.record_teacher_artifact_upload(uuid, uuid, text, text, text, bigint, text, smallint) to authenticated;
