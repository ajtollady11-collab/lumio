-- Lumio · 0003 · Curriculum knowledge structure
-- Qualification → Exam board → Subject → Specification → Module → Topic → Subtopic
--   → Learning objectives, with assessment criteria attached to specifications.
-- New qualifications and boards are rows, not schema changes.
--
-- Only reference vocabulary is seeded here. Specification content is loaded in
-- Phase 5 after licensing review of each exam board's published material.

create type public.qualification_level as enum ('gcse', 'igcse', 'as_level', 'a_level');
create type public.content_status as enum ('draft', 'published', 'retired');

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  level public.qualification_level not null,
  jurisdiction text not null default 'GB',
  sort_order smallint not null default 0
);

create table public.exam_boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  website_url text,
  sort_order smallint not null default 0
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  sort_order smallint not null default 0
);

create table public.specifications (
  id uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  exam_board_id uuid not null references public.exam_boards (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  code text not null,
  title text not null,
  first_teaching_year smallint,
  source_url text,
  licence_note text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint specifications_unique unique (exam_board_id, code)
);
create index specifications_lookup_idx on public.specifications (qualification_id, subject_id, exam_board_id);

create trigger specifications_touch_updated_at
  before update on public.specifications
  for each row execute function private.touch_updated_at();

create table public.curriculum_modules (
  id uuid primary key default gen_random_uuid(),
  specification_id uuid not null references public.specifications (id) on delete cascade,
  code text,
  title text not null,
  position smallint not null,
  constraint curriculum_modules_position_unique unique (specification_id, position)
);

-- Topics nest one level for subtopics via parent_topic_id.
create table public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.curriculum_modules (id) on delete cascade,
  parent_topic_id uuid references public.curriculum_topics (id) on delete cascade,
  code text,
  title text not null,
  summary text,
  position smallint not null
);
create index curriculum_topics_module_idx on public.curriculum_topics (module_id, position);
create index curriculum_topics_parent_idx on public.curriculum_topics (parent_topic_id);

create table public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.curriculum_topics (id) on delete cascade,
  code text,
  statement text not null,
  position smallint not null
);
create index learning_objectives_topic_idx on public.learning_objectives (topic_id, position);

create table public.assessment_criteria (
  id uuid primary key default gen_random_uuid(),
  specification_id uuid not null references public.specifications (id) on delete cascade,
  code text not null,            -- e.g. AO1, AO2
  description text not null,
  weighting_percent numeric(5, 2) check (weighting_percent is null or weighting_percent between 0 and 100),
  constraint assessment_criteria_unique unique (specification_id, code)
);

-- The subjects a student studies, at the specification they are entered for.
create table public.student_subjects (
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  specification_id uuid not null references public.specifications (id) on delete restrict,
  target_grade text check (target_grade is null or char_length(target_grade) <= 8),
  created_at timestamptz not null default now(),
  primary key (student_id, specification_id)
);
create index student_subjects_spec_idx on public.student_subjects (specification_id);

-- ---------------------------------------------------------------------------
-- Privileges and policies
-- Reference data is public to read (marketing pages list subjects); only
-- published specification content is visible. Writes are staff-only.
-- ---------------------------------------------------------------------------
revoke all on public.qualifications, public.exam_boards, public.subjects, public.specifications,
  public.curriculum_modules, public.curriculum_topics, public.learning_objectives,
  public.assessment_criteria, public.student_subjects from anon, authenticated;

grant select on public.qualifications, public.exam_boards, public.subjects to anon, authenticated;
grant select on public.specifications, public.curriculum_modules, public.curriculum_topics,
  public.learning_objectives, public.assessment_criteria to authenticated;
grant insert, update, delete on public.qualifications, public.exam_boards, public.subjects,
  public.specifications, public.curriculum_modules, public.curriculum_topics,
  public.learning_objectives, public.assessment_criteria to authenticated; -- gated by staff policies below
grant select, insert, delete on public.student_subjects to authenticated;
grant update (target_grade) on public.student_subjects to authenticated;

alter table public.qualifications enable row level security;
alter table public.exam_boards enable row level security;
alter table public.subjects enable row level security;
alter table public.specifications enable row level security;
alter table public.curriculum_modules enable row level security;
alter table public.curriculum_topics enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.assessment_criteria enable row level security;
alter table public.student_subjects enable row level security;

create policy "qualifications: public read" on public.qualifications for select to anon, authenticated using (true);
create policy "exam_boards: public read" on public.exam_boards for select to anon, authenticated using (true);
create policy "subjects: public read" on public.subjects for select to anon, authenticated using (true);

create policy "specifications: read published" on public.specifications for select to authenticated
  using (status = 'published' or (select public.is_staff()));

create or replace function private.specification_is_visible(spec uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.specifications s
    where s.id = spec and (s.status = 'published' or public.is_staff())
  );
$$;
revoke all on function private.specification_is_visible(uuid) from public, anon;
grant execute on function private.specification_is_visible(uuid) to authenticated, service_role;

create policy "modules: read visible" on public.curriculum_modules for select to authenticated
  using ((select private.specification_is_visible(specification_id)));
create policy "topics: read visible" on public.curriculum_topics for select to authenticated
  using (exists (select 1 from public.curriculum_modules m
                 where m.id = module_id and private.specification_is_visible(m.specification_id)));
create policy "objectives: read visible" on public.learning_objectives for select to authenticated
  using (exists (select 1 from public.curriculum_topics t join public.curriculum_modules m on m.id = t.module_id
                 where t.id = topic_id and private.specification_is_visible(m.specification_id)));
create policy "criteria: read visible" on public.assessment_criteria for select to authenticated
  using ((select private.specification_is_visible(specification_id)));

-- Staff manage curriculum content.
create policy "qualifications: staff write" on public.qualifications for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "exam_boards: staff write" on public.exam_boards for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "subjects: staff write" on public.subjects for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "specifications: staff write" on public.specifications for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "modules: staff write" on public.curriculum_modules for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "topics: staff write" on public.curriculum_topics for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "objectives: staff write" on public.learning_objectives for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));
create policy "criteria: staff write" on public.assessment_criteria for all to authenticated
  using ((select public.is_staff('admin'))) with check ((select public.is_staff('admin')));

create policy "student_subjects: own" on public.student_subjects for all to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "student_subjects: parent reads linked" on public.student_subjects for select to authenticated
  using ((select public.parent_can_view(student_id, 'activity')));

-- ---------------------------------------------------------------------------
-- Reference vocabulary (factual names only — no specification content).
-- ---------------------------------------------------------------------------
insert into public.qualifications (slug, name, level, sort_order) values
  ('gcse', 'GCSE', 'gcse', 10),
  ('international-gcse', 'International GCSE', 'igcse', 20),
  ('as-level', 'AS level', 'as_level', 30),
  ('a-level', 'A-level', 'a_level', 40);

insert into public.exam_boards (slug, name, website_url, sort_order) values
  ('aqa', 'AQA', 'https://www.aqa.org.uk', 10),
  ('pearson-edexcel', 'Pearson Edexcel', 'https://qualifications.pearson.com', 20),
  ('ocr', 'OCR', 'https://www.ocr.org.uk', 30),
  ('wjec', 'WJEC', 'https://www.wjec.co.uk', 40);

insert into public.subjects (slug, name, sort_order) values
  ('biology', 'Biology', 10),
  ('chemistry', 'Chemistry', 20),
  ('physics', 'Physics', 30),
  ('mathematics', 'Mathematics', 40),
  ('further-mathematics', 'Further Mathematics', 50),
  ('economics', 'Economics', 60),
  ('business', 'Business', 70),
  ('computer-science', 'Computer Science', 80),
  ('psychology', 'Psychology', 90),
  ('geography', 'Geography', 100),
  ('history', 'History', 110),
  ('english-language', 'English Language', 120),
  ('english-literature', 'English Literature', 130);
