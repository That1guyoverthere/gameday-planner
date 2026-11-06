-- GameDay Planner: private single-owner profile and cloud game storage
-- Run this entire script once in Supabase Dashboard > SQL Editor > New query.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  background_theme text not null default 'midnight',
  icon_theme text not null default 'controller',
  avatar_url text,
  bio text not null default '',
  accent_color text not null default '#9b8cff',
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.games enable row level security;

drop policy if exists "Owner can read own profile" on public.profiles;
create policy "Owner can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Owner can create own profile" on public.profiles;
create policy "Owner can create own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Owner can update own profile" on public.profiles;
create policy "Owner can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Owner can read own games" on public.games;
create policy "Owner can read own games"
  on public.games for select
  using (auth.uid() = user_id);

drop policy if exists "Owner can add own games" on public.games;
create policy "Owner can add own games"
  on public.games for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner can update own games" on public.games;
create policy "Owner can update own games"
  on public.games for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owner can delete own games" on public.games;
create policy "Owner can delete own games"
  on public.games for delete
  using (auth.uid() = user_id);

create or replace function public.create_gameday_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_gameday on auth.users;
create trigger on_auth_user_created_gameday
  after insert on auth.users
  for each row execute procedure public.create_gameday_profile();


-- Expand existing profiles safely if this script was run before.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists accent_color text not null default '#9b8cff';

-- Publicly readable avatar images; uploads/changes/deletes are restricted to the signed-in owner folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

drop policy if exists "Users can upload own GameDay avatar" on storage.objects;
create policy "Users can upload own GameDay avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own GameDay avatar" on storage.objects;
create policy "Users can update own GameDay avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own GameDay avatar" on storage.objects;
create policy "Users can delete own GameDay avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
