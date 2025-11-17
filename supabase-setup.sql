-- Supabase Database Setup Script
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable the trigram extension for similarity search
create extension if not exists pg_trgm;

-- Create the campaigns table
create table if not exists campaigns (
  id bigint generated always as identity primary key,
  company_name text not null,
  campaign text not null,
  channel text not null,
  sent_at timestamptz not null default now(),
  body text not null,
  occurrences integer not null default 0
);

-- Create the trigram index for fast similarity search
create index if not exists idx_campaigns_body_trgm
  on campaigns using gin (body gin_trgm_ops);

-- Create the search function
create or replace function search_campaigns(q text, k integer default 5)
returns table (
  id bigint,
  company_name text,
  campaign text,
  channel text,
  sent_at timestamptz,
  body text,
  occurrences integer,
  similarity real
)
language sql stable
as $$
  select
    c.*,
    similarity(c.body, q) as similarity
  from campaigns c
  where q is not null
    and c.body % q
  order by similarity desc
  limit k;
$$;

-- Grant necessary permissions (if using RLS)
-- Note: Service role key should bypass RLS, but if you have RLS enabled,
-- you may need to adjust these policies
alter table campaigns enable row level security;

-- Allow service role to do everything (bypasses RLS)
create policy "Service role can do everything"
  on campaigns
  for all
  to service_role
  using (true)
  with check (true);

-- Optional: Allow authenticated users to read campaigns
-- create policy "Users can read campaigns"
--   on campaigns
--   for select
--   to authenticated
--   using (true);

