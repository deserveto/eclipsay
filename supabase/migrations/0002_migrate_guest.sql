-- Transactional guest→account migration (PRD §13, §64).
-- Called by /api/migrate/guest with the service-role client after verifying
-- auth.uid(); SECURITY DEFINER lets one call insert across all owner tables
-- atomically. Local guest data is cleared by the client ONLY on success.

create or replace function public.migrate_guest_data(
  p_user_id uuid,
  p_sessions jsonb,
  p_readings jsonb,
  p_messages jsonb,
  p_journal jsonb,
  p_memories jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  imported integer := 0;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;

  insert into profiles (id) values (p_user_id) on conflict (id) do nothing;

  insert into reflection_sessions (id, user_id, title, created_at, updated_at)
  select
    (e->>'id')::uuid,
    p_user_id,
    coalesce(e->>'title', 'New Reflection'),
    coalesce((e->>'created_at')::timestamptz, now()),
    coalesce((e->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(p_sessions) as e
  on conflict (id) do nothing;
  get diagnostics imported = row_count;
  imported := imported + 0;

  insert into tarot_readings (id, session_id, user_id, spread_id, seed, cards, created_at)
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

  insert into messages (id, session_id, user_id, role, content, meta, created_at)
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

  insert into journal_entries (
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

  insert into memories (id, user_id, category, content, source, active, created_at, updated_at)
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

  return imported;
end;
$$;
