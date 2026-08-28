-- Eclipsay initial schema (PRD §75).
-- All user-owned tables are RLS-enabled; a row is visible/writable only by its owner.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  reflection_goal text check (reflection_goal in ('feelings','decisions','relationships','growth','exploring')),
  tarot_familiarity text check (tarot_familiarity in ('new','some','very')),
  memory_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table reflection_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Reflection',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references reflection_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  meta jsonb not null default '{}',  -- tool events: spread suggestions, reading refs, confirm cards, context chips
  created_at timestamptz not null default now()
);

create table tarot_readings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references reflection_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  spread_id text not null,
  seed bigint not null,
  cards jsonb not null,  -- DrawnCard[]: {cardId,name,arcana,suit,orientation,position,drawOrder,clarifies?}
  created_at timestamptz not null default now()
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('freeform','reflection','tarot','insight','mood','followup','intention')),
  title text, body text not null, mood text,
  tags text[] not null default '{}',
  ai_notes jsonb not null default '[]', -- [{id,type:'unpack'|'prompts'|'insight'|'summary'|'tarot',content,createdAt}]
  source_session_id uuid references reflection_sessions(id) on delete set null,
  source_reading_id uuid references tarot_readings(id) on delete set null,
  parent_entry_id uuid references journal_entries(id) on delete set null, -- follow-up chain §47
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('preference','goal','recurring_situation','context','project','relationship','reflection_preference')),
  content text not null, source text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references reflection_sessions(id) on delete cascade,
  journal_entry_id uuid references journal_entries(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','revisited','dismissed')),
  created_at timestamptz not null default now()
);

create table events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null, meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on messages (session_id, created_at);
create index on journal_entries (user_id, created_at desc);
create index on follow_ups (user_id, due_at) where status = 'pending';
create index on reflection_sessions (user_id, updated_at desc);

-- ── Row Level Security ────────────────────────────────────────────────

alter table profiles             enable row level security;
alter table reflection_sessions  enable row level security;
alter table messages             enable row level security;
alter table tarot_readings       enable row level security;
alter table journal_entries      enable row level security;
alter table memories             enable row level security;
alter table follow_ups           enable row level security;
alter table events               enable row level security;

create policy "profiles_owner_all" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "sessions_owner_all" on reflection_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages_owner_all" on messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "readings_owner_all" on tarot_readings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "journal_owner_all" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memories_owner_all" on memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "followups_owner_all" on follow_ups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Events are append-only analytics; guests may log with a null user_id.
create policy "events_owner_insert" on events
  for insert with check (user_id is null or auth.uid() = user_id);
