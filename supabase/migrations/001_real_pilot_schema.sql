create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('tenant', 'agent', 'landlord', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.title_status as enum ('verified', 'pending', 'disputed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.escrow_status as enum ('draft', 'awaiting_payment', 'paid', 'held', 'release_requested', 'released', 'disputed', 'cancelled', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  phone text,
  role public.user_role not null default 'tenant',
  nin_status public.approval_status not null default 'draft',
  nin_last4 text,
  rent_score integer not null default 620 check (rent_score between 300 and 900),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  lasrera_number text,
  scuml_number text,
  association text,
  neighbourhoods text[] not null default '{}',
  bio text not null default '',
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  deal_count integer not null default 0,
  approval_status public.approval_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  title text not null,
  location text not null,
  lga text not null,
  price_kobo bigint not null check (price_kobo >= 0),
  rent_period text not null check (rent_period in ('monthly', 'yearly', 'sale')),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  property_type text not null,
  description text not null,
  amenities text[] not null default '{}',
  image_url text not null default 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=80',
  source text not null check (source in ('agent', 'landlord')),
  title_status public.title_status not null default 'pending',
  registry_reference text,
  escrow_enabled boolean not null default true,
  rent_monthly_enabled boolean not null default false,
  approval_status public.approval_status not null default 'pending_review',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  preferred_time text,
  status text not null default 'new' check (status in ('new', 'contacted', 'viewing_booked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  kind text not null check (kind in ('nin', 'lasrera', 'scuml', 'title', 'landlord_direct')),
  subject_reference text not null,
  status public.approval_status not null default 'pending_review',
  consent_text text not null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo >= 0),
  fee_kobo bigint not null check (fee_kobo >= 0),
  total_kobo bigint generated always as (amount_kobo + fee_kobo) stored,
  status public.escrow_status not null default 'draft',
  paystack_reference text unique,
  paystack_access_code text,
  paystack_authorization_url text,
  idempotency_key text not null unique,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  response text,
  response_at timestamptz,
  transaction_gated boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists agent_profiles_touch_updated_at on public.agent_profiles;
create trigger agent_profiles_touch_updated_at before update on public.agent_profiles for each row execute function public.touch_updated_at();
drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at before update on public.listings for each row execute function public.touch_updated_at();
drop trigger if exists enquiries_touch_updated_at on public.enquiries;
create trigger enquiries_touch_updated_at before update on public.enquiries for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.watchlists enable row level security;
alter table public.enquiries enable row level security;
alter table public.verification_requests enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_actions enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "agent_profiles_read_public_approved" on public.agent_profiles;
create policy "agent_profiles_read_public_approved" on public.agent_profiles for select using (approval_status = 'approved' or user_id = auth.uid() or public.is_admin());

drop policy if exists "listings_read_approved_or_owner" on public.listings;
create policy "listings_read_approved_or_owner" on public.listings for select using (approval_status = 'approved' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "listings_owner_insert" on public.listings;
create policy "listings_owner_insert" on public.listings for insert with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists "listings_owner_update" on public.listings;
create policy "listings_owner_update" on public.listings for update using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "watchlists_owner_all" on public.watchlists;
create policy "watchlists_owner_all" on public.watchlists for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "enquiries_participants" on public.enquiries;
create policy "enquiries_participants" on public.enquiries for all using (
  tenant_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
) with check (tenant_id = auth.uid() or public.is_admin());

drop policy if exists "verification_owner_or_admin" on public.verification_requests;
create policy "verification_owner_or_admin" on public.verification_requests for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "escrow_participants" on public.escrow_transactions;
create policy "escrow_participants" on public.escrow_transactions for select using (tenant_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists "reviews_visible_to_listing_participants" on public.reviews;
create policy "reviews_visible_to_listing_participants" on public.reviews for select using (
  public.is_admin()
  or reviewer_id = auth.uid()
  or reviewee_id = auth.uid()
  or exists (select 1 from public.listings l where l.id = listing_id and l.approval_status = 'approved')
);

drop policy if exists "admin_actions_admin_only" on public.admin_actions;
create policy "admin_actions_admin_only" on public.admin_actions for all using (public.is_admin()) with check (public.is_admin());

create index if not exists listings_search_idx on public.listings using gin (
  to_tsvector('english', title || ' ' || location || ' ' || lga || ' ' || property_type || ' ' || description)
);
create index if not exists listings_approval_idx on public.listings (approval_status, created_at desc);
create index if not exists enquiries_listing_idx on public.enquiries (listing_id, created_at desc);
create index if not exists escrow_reference_idx on public.escrow_transactions (paystack_reference);

