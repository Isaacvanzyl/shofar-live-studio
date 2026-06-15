-- ============================================================
-- Shofar Broadcast Hub — Supabase Schema Setup
-- Run this in the Supabase SQL Editor (once, on a fresh project)
-- ============================================================

-- ── 1. Tables ────────────────────────────────────────────────

create table if not exists orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  created_at  timestamptz default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  org_id       uuid references orgs(id) on delete set null,
  role         text not null default 'operator'
                 check (role in ('admin', 'operator')),
  display_name text,
  created_at   timestamptz default now()
);

-- Create the broadcast_state table if it doesn't exist yet
-- (if you already have it, skip this block)
create table if not exists broadcast_state (
  id          text primary key,
  state       jsonb,
  updated_at  timestamptz default now()
);

-- ── 2. Helper: is_admin() ─────────────────────────────────────
-- security definer so it bypasses RLS on profiles (no recursion)

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- ── 3. RLS: orgs ─────────────────────────────────────────────

alter table orgs enable row level security;

create policy "admins manage orgs"
  on orgs for all
  using (is_admin());

create policy "members read own org"
  on orgs for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.org_id = orgs.id
    )
  );

-- ── 4. RLS: profiles ─────────────────────────────────────────

alter table profiles enable row level security;

create policy "admins manage all profiles"
  on profiles for all
  using (is_admin());

create policy "users read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "users update own profile"
  on profiles for update
  using (id = auth.uid());

-- ── 5. RLS: broadcast_state ───────────────────────────────────
-- Channel keys are prefixed: {org_id}:{channel}
-- e.g.  "abc-123:lower-third"
-- Admins see everything. Operators see only their org prefix.
-- The gpu_stats key and any un-prefixed legacy keys are public.

alter table broadcast_state enable row level security;

create policy "org members access their channels"
  on broadcast_state for all
  using (
    -- Not logged in: only allow keys without a colon (legacy / public)
    (auth.uid() is null and broadcast_state.id not like '%:%')

    -- Logged-in admin: full access
    or is_admin()

    -- Logged-in operator: rows prefixed with their org_id
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and broadcast_state.id like (p.org_id::text || ':%')
    )

    -- Un-prefixed rows (gpu_stats, legacy): anyone authenticated
    or (auth.uid() is not null and broadcast_state.id not like '%:%')
  );

-- ── 6. Auto-create profile on signup ─────────────────────────
-- Trigger: when a new auth.user is created, insert a stub profile.
-- The admin then assigns org_id + role via the admin panel.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (id, role)
  values (new.id, 'operator')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 7. First admin account ────────────────────────────────────
-- After running this SQL, go to Authentication → Users in the
-- Supabase dashboard and create your admin user manually.
-- Then run this in the SQL editor (replace the UUID):
--
--   update profiles
--   set role = 'admin'
--   where id = '<your-user-uuid>';
--
-- All other accounts should be created via the Admin Panel UI.
-- ============================================================
