-- RLS for C2 tables (profiles, tenants).
--
-- Defense-in-depth for the Supabase anon/browser path. Our server code uses
-- Prisma (DB owner role), which BYPASSES RLS — so these policies do NOT relax
-- the app-level ownerId scoping; they harden the anon path on top of it.
--
-- With RLS enabled and only owner-scoped policies, the anon/authenticated
-- roles can read/modify ONLY their own rows; everything else is denied.
-- Applied as a Prisma migration (prisma migrate dev --create-only, then edit).

alter table public.profiles enable row level security;
alter table public.tenants  enable row level security;

-- profiles: a user can see and update only their own profile row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- tenants: an owner can do anything to their own tenant, nothing to others'.
-- NOTE: ownerId has no @map, so the column is the quoted camelCase "ownerId".
create policy "tenants_all_own" on public.tenants
  for all using (auth.uid() = "ownerId") with check (auth.uid() = "ownerId");
