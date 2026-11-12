create table if not exists public.momo_movie_members (
  phone_hash text primary key,
  joined_at timestamptz not null default now()
);

alter table public.momo_movie_members enable row level security;
revoke all on table public.momo_movie_members from public, anon, authenticated;
grant all on table public.momo_movie_members to service_role;

-- Admin access is granted explicitly to Supabase Auth users by UUID.
create table if not exists public.momo_movie_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.momo_movie_admins enable row level security;
revoke all on table public.momo_movie_admins from public, anon, authenticated;
grant all on table public.momo_movie_admins to service_role;

-- Only the server's service-role API reads/writes this table. Public output is
-- separately filtered to rows marked published and rights_verified by an admin.
create table if not exists public.momo_movie_library (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  media_type text not null default 'movie' check (media_type in ('movie', 'series')),
  synopsis text not null default '' check (char_length(synopsis) <= 4000),
  poster_url text,
  release_date text,
  playback_type text not null default 'file' check (playback_type in ('file', 'embed')),
  playback_url text,
  rights_url text,
  rights_notes text check (char_length(coalesce(rights_notes, '')) <= 1200),
  rights_verified boolean not null default false,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint momo_movie_library_publish_rights check (
    not is_published or (rights_verified and playback_url is not null and rights_url is not null and rights_notes is not null)
  )
);
create index if not exists momo_movie_library_public_order
  on public.momo_movie_library (is_published, rights_verified, created_at desc);
alter table public.momo_movie_library enable row level security;
revoke all on table public.momo_movie_library from public, anon, authenticated;
grant all on table public.momo_movie_library to service_role;

-- Comments are accessed only through the member-authenticated server API.
-- Member identity remains the existing HMAC phone hash; raw phone numbers
-- are never stored in or returned from this table.
create table if not exists public.momo_movie_comments (
  id uuid primary key default gen_random_uuid(),
  movie_key text not null check (char_length(movie_key) between 8 and 96),
  movie_title text not null check (char_length(movie_title) between 1 and 160),
  member_hash text not null references public.momo_movie_members(phone_hash) on delete cascade,
  comment_text text not null check (char_length(comment_text) between 2 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint momo_movie_comments_one_per_member unique (movie_key, member_hash)
);
create index if not exists momo_movie_comments_movie_order
  on public.momo_movie_comments (movie_key, created_at asc);
alter table public.momo_movie_comments enable row level security;
revoke all on table public.momo_movie_comments from public, anon, authenticated;
grant all on table public.momo_movie_comments to service_role;
