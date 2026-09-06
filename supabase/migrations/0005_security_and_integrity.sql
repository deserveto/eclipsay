-- Production-readiness remediation (audit 2026-09-06, findings A01/A04/A17/A18/A32).
-- Forward-only: applies on top of 0001–0004 via the Dashboard SQL Editor.
--
-- A01 (P0): migrate_guest_data was a public SECURITY DEFINER accepting a
--   caller-controlled p_user_id — under Postgres default privileges any
--   anon/authenticated caller could invoke it via PostgREST and write with
--   the owner's privileges. The function is replaced with a locked-down
--   definition (empty search_path, fully qualified names) and EXECUTE is
--   revoked from PUBLIC/anon/authenticated and granted to service_role only.
-- A04 (P1): migration now imports guest follow-ups and reconciles profile
--   preferences in the same transaction. Reconciliation policy: the guest's
--   explicit choices win — non-null reflection_goal/tarot_familiarity and
--   the guest memory_enabled flag overwrite the account profile row, because
--   the migrating user just deliberately set them locally (PRD §13, §41).
-- A17 (P2): composite (user_id, id) foreign keys bind every child row to a
--   parent owned by the SAME user, so an RLS-passing insert that references
--   another user's session/entry/reading is rejected by the database.
--   Uses PG15+ column-list ON DELETE SET NULL (Supabase runs PG15+).
-- A18 (P2): analytics events now cascade-delete with the account, matching
--   the UI's promise that account deletion removes all account data.
-- A32 (P1): messages.client_id + a partial unique index make user-turn
--   persistence idempotent per session (retries/regeneration never duplicate).
-- Extra (verification audit): migrate_guest_data's return value now counts
--   every imported row (it previously only counted sessions), and history
--   clearing gains an atomic SECURITY DEFINER helper (settings-form previously
--   issued two independent deletes and could half-clear).

-- ── A32: idempotent user turns ─────────────────────────────────────────
alter table public.messages add column if not exists client_id text;
create unique index if not exists messages_session_client_id_key
  on public.messages (session_id, client_id)
  where client_id is not null;

-- ── A17: parent uniqueness prerequisites for composite FKs ─────────────
alter table public.reflection_sessions add constraint reflection_sessions_user_id_id_key unique (user_id, id);
alter table public.journal_entries    add constraint journal_entries_user_id_id_key    unique (user_id, id);
alter table public.tarot_readings     add constraint tarot_readings_user_id_id_key     unique (user_id, id);

-- Child rows may only reference parents owned by the same user.
alter table public.messages
  add constraint messages_owner_session_fk
  foreign key (user_id, session_id) references public.reflection_sessions (user_id, id) on delete cascade;

alter table public.tarot_readings
  add constraint tarot_readings_owner_session_fk
  foreign key (user_id, session_id) references public.reflection_sessions (user_id, id) on delete cascade;

alter table public.follow_ups
  add constraint follow_ups_owner_session_fk
  foreign key (user_id, session_id) references public.reflection_sessions (user_id, id) on delete cascade;

alter table public.follow_ups
  add constraint follow_ups_owner_entry_fk
  foreign key (user_id, journal_entry_id) references public.journal_entries (user_id, id) on delete cascade;

-- PG15+ column-list SET NULL: only the source column is nulled (user_id is
-- not null and must survive the parent row's deletion).
alter table public.journal_entries
  add constraint journal_entries_owner_source_session_fk
  foreign key (user_id, source_session_id) references public.reflection_sessions (user_id, id)
  on delete set null (source_session_id);

alter table public.journal_entries
  add constraint journal_entries_owner_source_reading_fk
  foreign key (user_id, source_reading_id) references public.tarot_readings (user_id, id)
  on delete set null (source_reading_id);

alter table public.journal_entries
  add constraint journal_entries_owner_parent_fk
  foreign key (user_id, parent_entry_id) references public.journal_entries (user_id, id)
  on delete set null (parent_entry_id);

-- ── A18: analytics events die with the account ─────────────────────────
alter table public.events drop constraint events_user_id_fkey;
alter table public.events
  add constraint events_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- ── A14 support: atomic history clear (owner-scoped) ───────────────────
create or replace function public.clear_my_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  delete from public.follow_ups where user_id = auth.uid();
  delete from public.reflection_sessions where user_id = auth.uid();
end;
$$;
revoke execute on function public.clear_my_history() from public, anon, authenticated;
grant execute on function public.clear_my_history() to authenticated;

-- ── A01 + A04: locked-down, extended migration RPC ─────────────────────
-- Replaces the 0002 definition (drop first: the parameter list changes, and
-- create-or-replace would silently keep the vulnerable old overload).
drop function if exists public.migrate_guest_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function public.migrate_guest_data(
  p_user_id uuid,
  p_sessions jsonb,
  p_readings jsonb,
  p_messages jsonb,
  p_journal jsonb,
  p_memories jsonb,
  p_followups jsonb default '[]'::jsonb,
  p_profile jsonb default null::jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  imported integer := 0;
  rows integer := 0;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;

  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;

  -- A04: profile preferences reconcile to the guest's explicit choices.
  -- memory_enabled is always applied; goal/familiarity only when the guest
  -- actually set them (non-null), leaving untouched account values alone.
  if p_profile is not null then
    update public.profiles set
      reflection_goal   = coalesce(nullif(p_profile->>'reflection_goal', ''), reflection_goal),
      tarot_familiarity = coalesce(nullif(p_profile->>'tarot_familiarity', ''), tarot_familiarity),
      memory_enabled    = coalesce((p_profile->>'memory_enabled')::boolean, memory_enabled)
    where id = p_user_id;
  end if;

  insert into public.reflection_sessions (id, user_id, title, created_at, updated_at)
  select
    (e->>'id')::uuid,
    p_user_id,
    coalesce(e->>'title', 'New Reflection'),
    coalesce((e->>'created_at')::timestamptz, now()),
    coalesce((e->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(p_sessions) as e
  on conflict (id) do nothing;
  get diagnostics rows = row_count;
  imported := imported + rows;

  insert into public.tarot_readings (id, session_id, user_id, spread_id, seed, cards, created_at)
  select
    (e->>'id')::uuid,
    (e->>'session_id')::uuid,
    p_user_id,
    coalesce(e->>'spread_id', 'one_card'),
    coalesce((e->>'seed')::bigint, 0),
    coalesce(e->'cards', '[]'::jsonb),
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(p_readings) as e
  on conflict (id) do nothing;
  get diagnostics rows = row_count;
  imported := imported + rows;

  insert into public.messages (id, session_id, user_id, role, content, meta, created_at)
  select
    (e->>'id')::uuid,
    (e->>'session_id')::uuid,
    p_user_id,
    e->>'role',
    coalesce(e->>'content', ''),
    coalesce(e->'meta', '{}'::jsonb),
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(p_messages) as e
  on conflict (id) do nothing;
  get diagnostics rows = row_count;
  imported := imported + rows;

  insert into public.journal_entries (
    id, user_id, entry_type, title, body, mood, tags, ai_notes,
    source_session_id, source_reading_id, parent_entry_id, created_at, updated_at
  )
  select
    (e->>'id')::uuid,
    p_user_id,
    coalesce(e->>'entry_type', 'freeform'),
    e->>'title',
    coalesce(e->>'body', ''),
    e->>'mood',
    coalesce((select array_agg(x::text) from jsonb_array_elements_text(e->'tags') x), '{}'),
    coalesce(e->'ai_notes', '[]'::jsonb),
    (e->>'source_session_id')::uuid,
    (e->>'source_reading_id')::uuid,
    (e->>'parent_entry_id')::uuid,
    coalesce((e->>'created_at')::timestamptz, now()),
    coalesce((e->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(p_journal) as e
  on conflict (id) do nothing;
  get diagnostics rows = row_count;
  imported := imported + rows;

  insert into public.memories (id, user_id, category, content, source, active, created_at, updated_at)
  select
    (e->>'id')::uuid,
    p_user_id,
    coalesce(e->>'category', 'context'),
    coalesce(e->>'content', ''),
    coalesce(e->>'source', 'Imported'),
    coalesce((e->>'active')::boolean, true),
    coalesce((e->>'created_at')::timestamptz, now()),
    coalesce((e->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(p_memories) as e
  on conflict (id) do nothing;
  get diagnostics rows = row_count;
  imported := imported + rows;

  -- A04: scheduled reminders cross the migration boundary (PRD §45–§47).
  insert into public.follow_ups (id, user_id, session_id, journal_entry_id, due_at, status, created_at)
  select
    (e->>'id')::uuid,
    p_user_id,
    (e->>'session_id')::uuid,
    (e->>'journal_entry_id')::uuid,
    coalesce((e->>'due_at')::timestamptz, now()),
    coalesce(e->>'status', 'pending'),
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(p_followups) as e
  on conflict (id) do nothing;
  get diagnostics rows = row_count;
  imported := imported + rows;

  return imported;
end;
$$;

-- A01: the RPC is reachable only through the server's service role. Without
-- these revokes Postgres grants EXECUTE to PUBLIC by default and PostgREST
-- would expose the definer function to anon/authenticated callers.
revoke execute on function public.migrate_guest_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.migrate_guest_data(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;
