-- Sailo · Supabase schema (run once in the SQL editor of project fdjeafihwwoeqdcnqhjd)
-- Idempotent: safe to re-run.

create extension if not exists citext;

-- ── Profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  display_name text check (char_length(display_name) between 1 and 40),
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  onboarding_completed boolean not null default false,
  starting_region jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[A-Za-z0-9._]{3,20}$')
);

create table if not exists public.reserved_usernames (name citext primary key);
insert into public.reserved_usernames(name) values
 ('admin'),('administrator'),('sailo'),('sailoapp'),('support'),('help'),('root'),('system'),('moderator'),('mod'),
 ('staff'),('official'),('owner'),('api'),('www'),('null'),('undefined'),('security'),('team'),('captain'),('harbourmaster'),('everyone')
on conflict do nothing;

create or replace function public.profiles_before_write() returns trigger language plpgsql as $$
begin
  if new.username is not null and exists (select 1 from public.reserved_usernames r where r.name = new.username) then
    raise exception 'username_reserved' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;            -- ids are immutable
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_before_write on public.profiles;
create trigger profiles_before_write before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- ── Boats ─────────────────────────────────────────────────────────────────
create table if not exists public.boat_catalog (
  id text primary key, name text not null, hull text not null, color text not null,
  rarity text not null, req_kind text not null check (req_kind in ('start','streak','voyages')), req_value int not null default 0
);
insert into public.boat_catalog values
 ('drifter','The Drifter','drifter','#c89b6a','Common','start',0),
 ('harbour','Harbour Sloop','sloop','#ff7a59','Common','streak',2),
 ('tide','Tide Runner','sloop','#5fd4c4','Common','streak',3),
 ('saltmarsh','Saltmarsh','launch','#9fd27a','Common','voyages',3),
 ('lantern','Lantern Brig','launch','#f2c14e','Rare','streak',4),
 ('reedling','Reedling','drifter','#9fd27a','Common','voyages',5),
 ('moonwake','Moonwake','sloop','#c9b6ff','Rare','streak',5),
 ('coral','Coral Skiff','drifter','#ff9fb0','Rare','streak',6),
 ('drift','Drift Queen','cat','#efe8da','Epic','streak',7),
 ('kelpie','Kelpie','launch','#3fb88a','Rare','voyages',8),
 ('lagoon','Lagoon Punt','drifter','#3fb8c8','Rare','streak',9),
 ('pelican','Pelican','sloop','#f2c14e','Rare','streak',10),
 ('seaglass','Seaglass','sloop','#a8e6e0','Rare','voyages',12),
 ('nightjar','Nightjar','launch','#6a7fc0','Epic','streak',14),
 ('mistral','Mistral','launch','#e9e4ff','Epic','voyages',15),
 ('monsoon','Monsoon','launch','#4a7fb0','Epic','streak',18),
 ('saffron','Saffron','sloop','#f0a23b','Epic','voyages',20),
 ('albatross','Albatross','sloop','#f6f1e7','Epic','streak',21),
 ('ember','Ember Galleon','cat','#e8604c','Epic','voyages',25),
 ('sovereign','Sovereign','cat','#e0b44a','Legendary','streak',30),
 ('kraken','Kraken','cat','#3d5a80','Legendary','voyages',40),
 ('aurora','Aurora','launch','#8fe3b0','Legendary','streak',45),
 ('tempest','Tempest','cat','#6a6f7a','Legendary','voyages',60),
 ('leviathan','Leviathan','cat','#1f3b4d','Legendary','streak',60)
on conflict (id) do update set name=excluded.name, hull=excluded.hull, color=excluded.color, rarity=excluded.rarity, req_kind=excluded.req_kind, req_value=excluded.req_value;

create table if not exists public.user_boats (
  user_id uuid not null references auth.users(id) on delete cascade,
  boat_id text not null references public.boat_catalog(id),
  unlocked_at timestamptz not null default now(),
  active boolean not null default false,
  primary key (user_id, boat_id)
);
create unique index if not exists user_boats_one_active on public.user_boats(user_id) where active;

create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak int not null default 0, best int not null default 0, last_day date,
  voyages int not null default 0, updated_at timestamptz not null default now()
);

-- Map position, destination, customisation, privacy + social cache (owner-only)
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.boat_catalog enable row level security;
alter table public.user_boats enable row level security;
alter table public.user_streaks enable row level security;
alter table public.user_state enable row level security;
alter table public.reserved_usernames enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "catalog is public" on public.boat_catalog;
create policy "catalog is public" on public.boat_catalog for select to anon, authenticated using (true);

drop policy if exists "own boats" on public.user_boats;
create policy "own boats" on public.user_boats for select to authenticated using (user_id = auth.uid());
drop policy if exists "own streak" on public.user_streaks;
create policy "own streak" on public.user_streaks for select to authenticated using (user_id = auth.uid());

drop policy if exists "own state read" on public.user_state;
create policy "own state read" on public.user_state for select to authenticated using (user_id = auth.uid());
drop policy if exists "own state insert" on public.user_state;
create policy "own state insert" on public.user_state for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own state update" on public.user_state;
create policy "own state update" on public.user_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- user_boats / user_streaks have no write policies: they change only through the security-definer RPCs below.

-- ── New-user setup (idempotent) ───────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare want citext := nullif(new.raw_user_meta_data->>'username','');
begin
  if want is not null and (want !~ '^[A-Za-z0-9._]{3,20}$'
     or exists (select 1 from profiles where username = want)
     or exists (select 1 from reserved_usernames where name = want)) then
    want := null;  -- never block signup; onboarding asks again
  end if;
  insert into profiles(id, username, display_name)
    values (new.id, want, left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), 40))
    on conflict (id) do nothing;
  insert into user_boats(user_id, boat_id, active) values (new.id, 'drifter', true) on conflict do nothing;
  insert into user_streaks(user_id) values (new.id) on conflict do nothing;
  insert into user_state(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── RPCs ──────────────────────────────────────────────────────────────────
create or replace function public.username_available(candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select candidate ~ '^[A-Za-z0-9._]{3,20}$'
     and not exists (select 1 from reserved_usernames r where r.name = candidate::citext)
     and not exists (select 1 from profiles p where p.username = candidate::citext and p.id is distinct from auth.uid());
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.get_fleet() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'streak', coalesce(s.streak,0), 'best', coalesce(s.best,0), 'last_day', s.last_day, 'voyages', coalesce(s.voyages,0),
    'owned', coalesce((select json_agg(boat_id order by unlocked_at) from user_boats where user_id = auth.uid()), '[]'::json),
    'active', (select boat_id from user_boats where user_id = auth.uid() and active limit 1))
  from (select auth.uid() as uid) u left join user_streaks s on s.user_id = u.uid;
$$;
grant execute on function public.get_fleet() to authenticated;

-- A finished voyage is the qualifying activity for streaks. Server date, server rules.
create or replace function public.record_voyage(tz text default 'UTC') returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s user_streaks; today date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'UTC'; end if;
  today := (now() at time zone tz)::date;
  insert into user_streaks(user_id) values (uid) on conflict do nothing;
  select * into s from user_streaks where user_id = uid for update;
  if s.updated_at > now() - interval '20 seconds' and s.voyages > 0 then return get_fleet(); end if; -- anti-spam
  if s.last_day is distinct from today then
    s.streak := case when s.last_day = today - 1 then s.streak + 1 else 1 end;
    s.last_day := today;
  end if;
  s.voyages := s.voyages + 1; s.best := greatest(s.best, s.streak);
  update user_streaks set streak = s.streak, best = s.best, last_day = s.last_day, voyages = s.voyages, updated_at = now() where user_id = uid;
  insert into user_boats(user_id, boat_id)
    select uid, c.id from boat_catalog c
    where c.req_kind = 'start' or (c.req_kind = 'streak' and s.best >= c.req_value) or (c.req_kind = 'voyages' and s.voyages >= c.req_value)
  on conflict do nothing;
  return get_fleet();
end $$;
grant execute on function public.record_voyage(text) to authenticated;

create or replace function public.equip_boat(boat text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from user_boats where user_id = uid and boat_id = boat) then raise exception 'not_owned'; end if;
  update user_boats set active = false where user_id = uid and active and boat_id <> boat;
  update user_boats set active = true where user_id = uid and boat_id = boat;
end $$;
grant execute on function public.equip_boat(text) to authenticated;

-- ── Avatar storage ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatar write own folder" on storage.objects;
create policy "avatar write own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar update own folder" on storage.objects;
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
