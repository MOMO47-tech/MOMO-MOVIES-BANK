create table if not exists public.momo_movie_members (
  phone_hash text primary key,
  joined_at timestamptz not null default now()
);

alter table public.momo_movie_members enable row level security;

-- Public and signed-in browser roles must not read membership identifiers.
revoke all on table public.momo_movie_members from anon, authenticated;

grant all on table public.momo_movie_members to service_role;
