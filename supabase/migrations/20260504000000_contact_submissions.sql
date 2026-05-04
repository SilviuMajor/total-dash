-- Marketing site contact form submissions.
-- Inserts come from the contact-form-submit Edge Function via service role,
-- so RLS only needs a read policy for super admin review.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  company text,
  message text not null,
  user_agent text,
  ip_hash text
);

alter table public.contact_submissions enable row level security;

drop policy if exists "super_admin_read_contact_submissions" on public.contact_submissions;
create policy "super_admin_read_contact_submissions"
  on public.contact_submissions
  for select
  using (public.is_super_admin(auth.uid()));

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);
