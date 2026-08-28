-- teachers.nickname 추가 (선택 입력, 개인화 표시용)
-- 0001을 이미 실행한 경우 이 파일만 실행하면 된다.
alter table teachers add column if not exists nickname text;
