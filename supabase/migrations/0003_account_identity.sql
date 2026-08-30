-- Account identity (plan: Accounts §1).
-- profiles gains full_name + date_of_birth for email signups and Google
-- profile completion. Columns stay NULLABLE so legacy rows, OAuth identities
-- awaiting completion, and migrate_guest_data()'s bare profiles(id) insert
-- (0002) remain valid — the APPLICATION requires them for new signups,
-- never the schema (PRD §52: 13+ gate lives in the app boundary).

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists date_of_birth date;

-- Bounded lengths for non-null identity text; null passes automatically.
alter table public.profiles
  add constraint profiles_full_name_length check (char_length(full_name) <= 100);
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 50);

-- Provision a profile row for every new auth.users row (email signup AND
-- Google first sign-in), seeding identity from raw_user_meta_data. Blank
-- strings become null; a missing or invalid Google birth date is tolerated
-- as null. `on conflict do nothing`: application writes own later edits.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_dob date;
begin
  begin
    v_dob := nullif(trim(coalesce(meta->>'date_of_birth', '')), '')::date;
  exception when others then
    v_dob := null;
  end;

  insert into public.profiles (id, full_name, display_name, date_of_birth)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(meta->>'full_name', '')), ''),
      nullif(trim(coalesce(meta->>'name', '')), '')
    ),
    nullif(trim(coalesce(meta->>'display_name', '')), ''),
    v_dob
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
