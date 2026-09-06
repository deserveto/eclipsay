-- Admin-controlled runtime configuration (plan: AI admin config).
-- Holds non-secret operational settings: the active AI model slots. Readable
-- by anyone — server routes read it with the anon key because the chat route
-- serves guests too — but writable only through the service-role client from
-- /api/admin/ai-config, which is gated by ADMIN_EMAILS.

create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;

create policy "app_config is readable by everyone"
  on app_config for select
  using (true);

-- No insert/update/delete policies: writes bypass RLS only via the service
-- role (SUPABASE_SERVICE_ROLE_KEY), never from browser clients.
