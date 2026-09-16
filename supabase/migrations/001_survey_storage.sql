create extension if not exists pgcrypto;

create table if not exists public.survey_projects (
  id text primary key,
  name text not null,
  description text not null default '',
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_raw_responses (
  project_id text not null references public.survey_projects(id) on delete cascade,
  response_id text not null,
  payload jsonb not null,
  imported_at timestamptz not null default now(),
  primary key (project_id, response_id)
);

create table if not exists public.survey_processed_responses (
  project_id text not null references public.survey_projects(id) on delete cascade,
  response_id text not null,
  payload jsonb not null,
  sample_weight double precision not null default 1,
  is_statistical_replica boolean not null default false,
  replica_number integer not null default 1,
  processed_at timestamptz not null default now(),
  primary key (project_id, response_id, replica_number)
);

create table if not exists public.survey_quota_results (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.survey_projects(id) on delete cascade,
  dimensions jsonb not null default '{}'::jsonb,
  question text not null,
  answer text,
  value text,
  weighted_count double precision,
  percentage double precision,
  real_respondents integer,
  weighted_base double precision,
  question_type text,
  created_at timestamptz not null default now()
);

create index if not exists survey_raw_project_idx on public.survey_raw_responses(project_id);
create index if not exists survey_processed_project_idx on public.survey_processed_responses(project_id);
create index if not exists survey_results_project_question_idx on public.survey_quota_results(project_id, question);

alter table public.survey_projects enable row level security;
alter table public.survey_raw_responses enable row level security;
alter table public.survey_processed_responses enable row level security;
alter table public.survey_quota_results enable row level security;

-- La aplicación escribe exclusivamente desde el backend con service_role.
-- No se crean políticas para anon/authenticated: por defecto no pueden leer ni escribir.

alter table public.survey_projects replica identity full;
alter table public.survey_raw_responses replica identity full;
alter table public.survey_processed_responses replica identity full;
alter table public.survey_quota_results replica identity full;

drop publication if exists survey_bigquery_publication;
create publication survey_bigquery_publication for table
  public.survey_projects,
  public.survey_raw_responses,
  public.survey_processed_responses,
  public.survey_quota_results;
