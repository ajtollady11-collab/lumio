-- Lumio · 0006 · Onboarding, examinations and parent invitations
--
-- Free-plan design: every rule that matters (who may write what, when
-- onboarding counts as complete, invitation codes, single use, expiry,
-- brute-force limits) is enforced inside Postgres — RLS, constraints,
-- triggers and SECURITY DEFINER functions. No paid feature, no service-role
-- key in the request path.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.education_level as enum ('gcse', 'a_level', 'igcse', 'other');
create type public.subject_confidence as enum ('difficult', 'neutral', 'confident');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

-- ---------------------------------------------------------------------------
-- Student profile additions
-- ---------------------------------------------------------------------------
alter table public.student_profiles
  add column education_level public.education_level,
  add column primary_qualification_id uuid references public.qualifications (id) on delete set null,
  add column academic_goals text check (academic_goals is null or char_length(academic_goals) <= 600),
  -- Last step the student reached; used only to resume. Completion is decided
  -- by complete_student_onboarding(), never by this number.
  add column onboarding_step smallint not null default 1 check (onboarding_step between 1 and 8);

create index student_profiles_primary_qualification_idx on public.student_profiles (primary_qualification_id);

grant update (education_level, primary_qualification_id, academic_goals, onboarding_step)
  on public.student_profiles to authenticated;

-- Completion may only be set by the completion functions below.
revoke update (onboarding_completed_at) on public.profiles from authenticated;

-- Keep the display name in step with the first name a user edits.
create or replace function private.sync_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.first_name is distinct from old.first_name then
    update public.profiles set display_name = new.first_name where id = new.profile_id;
  end if;
  return new;
end;
$$;

create trigger student_profiles_sync_display_name
  after update of first_name on public.student_profiles
  for each row execute function private.sync_display_name();
create trigger parent_profiles_sync_display_name
  after update of first_name on public.parent_profiles
  for each row execute function private.sync_display_name();

-- Under-13s need parental consent (UK age of digital consent). The status is
-- not user-writable; this trigger moves it in step with the age band.
create or replace function private.track_parental_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.age_band = 'under_13' and new.parental_consent = 'not_required' then
    new.parental_consent := 'pending';
  elsif new.age_band is distinct from 'under_13' and new.parental_consent = 'pending' then
    new.parental_consent := 'not_required';
  end if;
  return new;
end;
$$;

create trigger student_profiles_track_consent
  before update of age_band on public.student_profiles
  for each row execute function private.track_parental_consent();

-- ---------------------------------------------------------------------------
-- Which boards offer which qualification (reference data)
-- ---------------------------------------------------------------------------
create table public.qualification_exam_boards (
  qualification_id uuid not null references public.qualifications (id) on delete cascade,
  exam_board_id uuid not null references public.exam_boards (id) on delete cascade,
  primary key (qualification_id, exam_board_id)
);
create index qualification_exam_boards_board_idx on public.qualification_exam_boards (exam_board_id);

-- GCSE, AS and A-level: all four boards (WJEC offers these in England under its
-- Eduqas brand). International GCSE: of these four, only Pearson Edexcel.
insert into public.qualification_exam_boards (qualification_id, exam_board_id)
select q.id, b.id
from public.qualifications q
cross join public.exam_boards b
where q.slug in ('gcse', 'as-level', 'a-level')
   or (q.slug = 'international-gcse' and b.slug = 'pearson-edexcel');

revoke all on public.qualification_exam_boards from anon, authenticated;
grant select on public.qualification_exam_boards to anon, authenticated;
alter table public.qualification_exam_boards enable row level security;
create policy "qualification_exam_boards: public read" on public.qualification_exam_boards
  for select to anon, authenticated using (true);
create policy "qualification_exam_boards: staff insert" on public.qualification_exam_boards
  for insert to authenticated with check ((select private.is_staff('admin')));
create policy "qualification_exam_boards: staff delete" on public.qualification_exam_boards
  for delete to authenticated using ((select private.is_staff('admin')));
grant insert, delete on public.qualification_exam_boards to authenticated;

-- ---------------------------------------------------------------------------
-- Student subjects (rebuilt: one row per subject, own board per subject)
-- The previous table was empty and keyed on specifications, which are not
-- loaded until Phase 5.
-- ---------------------------------------------------------------------------
drop table public.student_subjects;

create table public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  -- null = "not sure yet"
  exam_board_id uuid references public.exam_boards (id) on delete restrict,
  -- Resolved once specification content exists (Phase 5).
  specification_id uuid references public.specifications (id) on delete set null,
  current_grade text,
  target_grade text,
  confidence public.subject_confidence,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_subjects_one_per_subject unique (student_id, subject_id),
  -- A board can only be chosen if it offers that qualification.
  constraint student_subjects_board_offers_qualification
    foreign key (qualification_id, exam_board_id)
    references public.qualification_exam_boards (qualification_id, exam_board_id)
);
create index student_subjects_subject_idx on public.student_subjects (subject_id);
create index student_subjects_qualification_idx on public.student_subjects (qualification_id, exam_board_id);
create index student_subjects_board_idx on public.student_subjects (exam_board_id);
create index student_subjects_spec_idx on public.student_subjects (specification_id);

create trigger student_subjects_touch_updated_at
  before update on public.student_subjects
  for each row execute function private.touch_updated_at();

-- Grades must exist on the qualification's scale.
create or replace function private.grade_is_valid(qualification uuid, grade text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select grade is null or case (select level from public.qualifications where id = qualification)
    when 'gcse' then grade in ('9', '8', '7', '6', '5', '4', '3', '2', '1', 'U')
    when 'igcse' then grade in ('9', '8', '7', '6', '5', '4', '3', '2', '1', 'U')
    when 'a_level' then grade in ('A*', 'A', 'B', 'C', 'D', 'E', 'U')
    when 'as_level' then grade in ('A', 'B', 'C', 'D', 'E', 'U')
    else false
  end;
$$;

create or replace function private.validate_student_subject()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.grade_is_valid(new.qualification_id, new.current_grade) then
    raise exception 'LUMIO:invalid_grade' using errcode = 'P0001';
  end if;
  if not private.grade_is_valid(new.qualification_id, new.target_grade) then
    raise exception 'LUMIO:invalid_grade' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.student_subjects where student_id = new.student_id) >= 15 then
    raise exception 'LUMIO:too_many_subjects' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger student_subjects_validate
  before insert or update on public.student_subjects
  for each row execute function private.validate_student_subject();

revoke all on public.student_subjects from anon, authenticated;
grant select, delete on public.student_subjects to authenticated;
grant insert (student_id, subject_id, qualification_id, exam_board_id, current_grade, target_grade, confidence)
  on public.student_subjects to authenticated;
grant update (qualification_id, exam_board_id, current_grade, target_grade, confidence)
  on public.student_subjects to authenticated;

alter table public.student_subjects enable row level security;
create policy "student_subjects: read own or linked parent" on public.student_subjects for select to authenticated
  using (student_id = (select auth.uid()) or (select private.parent_can_view(student_id, 'activity')));
create policy "student_subjects: insert own" on public.student_subjects for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "student_subjects: update own" on public.student_subjects for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "student_subjects: delete own" on public.student_subjects for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Examination dates
-- ---------------------------------------------------------------------------
create table public.examination_dates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  exam_board_id uuid references public.exam_boards (id) on delete restrict,
  exam_date date not null check (exam_date between date '2024-01-01' and date '2040-12-31'),
  notes text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint examination_dates_board_offers_qualification
    foreign key (qualification_id, exam_board_id)
    references public.qualification_exam_boards (qualification_id, exam_board_id)
);
create index examination_dates_student_date_idx on public.examination_dates (student_id, exam_date);
create index examination_dates_subject_idx on public.examination_dates (subject_id);
create index examination_dates_qualification_idx on public.examination_dates (qualification_id, exam_board_id);
create index examination_dates_board_idx on public.examination_dates (exam_board_id);
-- The same paper can't be entered twice.
create unique index examination_dates_no_duplicates
  on public.examination_dates (student_id, subject_id, exam_date, coalesce(notes, ''));

create trigger examination_dates_touch_updated_at
  before update on public.examination_dates
  for each row execute function private.touch_updated_at();

create or replace function private.limit_examination_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.examination_dates where student_id = new.student_id) >= 60 then
    raise exception 'LUMIO:too_many_exams' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger examination_dates_limit
  before insert on public.examination_dates
  for each row execute function private.limit_examination_dates();

revoke all on public.examination_dates from anon, authenticated;
grant select, delete on public.examination_dates to authenticated;
grant insert (student_id, subject_id, qualification_id, exam_board_id, exam_date, notes)
  on public.examination_dates to authenticated;
grant update (subject_id, qualification_id, exam_board_id, exam_date, notes)
  on public.examination_dates to authenticated;

alter table public.examination_dates enable row level security;
create policy "examination_dates: read own or linked parent" on public.examination_dates for select to authenticated
  using (student_id = (select auth.uid()) or (select private.parent_can_view(student_id, 'activity')));
create policy "examination_dates: insert own" on public.examination_dates for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "examination_dates: update own" on public.examination_dates for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "examination_dates: delete own" on public.examination_dates for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Parent invitations
-- A parent creates a one-time code and gives it to their child. The child
-- enters it and approves the link. Codes: 12 characters from a 32-symbol
-- alphabet (60 bits), stored only as SHA-256 hashes, valid 7 days, single use.
-- ---------------------------------------------------------------------------
alter table public.parent_student_links drop column invite_code_hash, drop column invite_expires_at;

create table public.parent_invitations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint parent_invitations_accepted_consistent
    check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null))
);
create index parent_invitations_parent_idx on public.parent_invitations (parent_id, status, expires_at);
create index parent_invitations_accepted_by_idx on public.parent_invitations (accepted_by);

revoke all on public.parent_invitations from anon, authenticated;
grant select (id, parent_id, status, expires_at, accepted_by, accepted_at, revoked_at, created_at)
  on public.parent_invitations to authenticated;
alter table public.parent_invitations enable row level security;
create policy "parent_invitations: parent reads own" on public.parent_invitations for select to authenticated
  using (parent_id = (select auth.uid()));
