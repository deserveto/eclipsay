# Eclipsay

A private, chat-first AI reflection companion. Talk through what's on your mind, optionally draw Rider–Waite–Smith tarot cards as reflective prompts, save insights to a journal, build explicit AI memory, and revisit reflections via in-app follow-ups.

**Guest-first**: the full product works with no account — all data lives in your browser's `localStorage` until you explicitly create an account (Supabase, RLS-scoped) and migrate.

## How it works

- **Conversational reflection** — a guided companion listens first, asks one question at a time, and keeps everyday life conversation in scope. Task work (code, homework, translations…) gets a warm refusal and a reflection pivot.
- **AI-driven tarot, never AI-drawn** — the model decides when a reading serves, asks structured clarifying questions (`ask_user`), and recommends a spread sized by complexity (`recommend_reading`). You confirm with one click, pick the cards yourself in an animated draw bar, and the app draws them through a seeded, deterministic tarot engine. The LLM never selects or invents cards.
- **Propose-then-confirm** — insights, memories, and follow-ups are only written after you click confirm. Journal search returns titles only; entry bodies enter the conversation only after you approve them.
- **Safety gates** — a regex classifier detects high-stakes topics (health, legal, financial, abuse, self-harm). Those conversations get no tarot tools at all; crisis messaging injects support resources.
- **Journal, Explore, Memory** — curated journal with AI notes, the full 78-card RWS library with detail pages, and explicit user-managed AI memory.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 (CSS-first), shadcn/radix primitives, Lucide icons |
| LLM | OpenRouter via Vercel AI SDK (`ai` + `@ai-sdk/react`) |
| Data | Supabase (Postgres, RLS) for accounts; versioned localStorage for guests |
| Tests | Vitest (node environment) |

## Getting started

Prerequisite: **Node ≥ 22** (required by the AI SDK engines), npm.

```bash
npm install
cp .env.example .env.local   # then fill in the keys below
npm run dev                  # http://localhost:3000
```

The app runs fully in guest mode with zero credentials — Supabase and OpenRouter keys only unlock accounts/migration and AI replies.

| Env var | Required for |
|---|---|
| `OPENROUTER_API_KEY` | AI chat replies (`generation_failed` without it) |
| `OPENROUTER_MODEL` | Model id on OpenRouter |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts, cloud sync, journal search |
| `SUPABASE_SERVICE_ROLE_KEY` | Guest migration + account deletion (server only) |
| `NEXT_PUBLIC_APP_URL` | Auth redirect base URL (email links, OAuth return) |

Apply the SQL in `supabase/migrations/` (`0001_init.sql`, `0002_migrate_guest.sql`, `0003_account_identity.sql`) via the Supabase Dashboard SQL Editor — no CLI config lives in this repo. `0003` adds the nullable `profiles.full_name` / `profiles.date_of_birth` columns and the `on_auth_user_created` trigger that provisions a profile for every new `auth.users` row.

### Supabase Authentication setup (required for accounts)

1. **Email provider** — Dashboard → Authentication → Providers → Email: enable **Email** and turn on **Confirm email**. Signup expects verification; if the project is set to auto-confirm, the app follows the returned session instead, but production must confirm emails.
2. **URL Configuration** — Dashboard → Authentication → URL Configuration: set **Site URL** to your production `NEXT_PUBLIC_APP_URL` and add both `http://localhost:3000/**` and your production origin's auth destinations (`/auth/callback`, `/auth/confirm`, `/verify-email`, `/reset-password`, `/complete-profile`) to the **Redirect URLs** allow list.
3. **Confirm signup template** — Dashboard → Authentication → Emails → Templates, replace the link in "Confirm signup" with the token-hash format the `/auth/confirm` route expects:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
   ```

   Suggested subject: `Confirm your email for Eclipsay`. Body: a warm, plain-language one-liner — "Welcome to Eclipsay. Click the button below to confirm your email and unlock your account. The link works once and expires after a while." (The button's URL is the link above.)
4. **Reset password template** — same panel, replace the link in "Reset Password" with:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}
   ```

5. **Deliverability** — Supabase's built-in SMTP is rate-limited and for testing only. Configure **custom SMTP** (Dashboard → Authentication → Emails → SMTP) for production. No email-service SDK is added to this repository.

### Google sign-in setup

1. In [Google Cloud Console](https://console.cloud.google.com/), configure the **OAuth consent screen**, then create credentials for an **OAuth client ID** of type **Web application**.
2. Add **one** Authorized redirect URI — it is exactly your Supabase URL plus `/auth/v1/callback` (Supabase shows it in Dashboard → Authentication → Providers → Google). Example: `https://abcdefgh.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard → Authentication → Providers → Google: enable the provider and paste the Google **Client ID** and **Client Secret**.
4. Application return URLs stay in Supabase's redirect allow list (step 2 of the Supabase setup): `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`. No new environment variable is required.

## Scripts

```bash
npm run dev            # dev server (Turbopack, port 3000)
npm run build          # production build (type + lint validation included)
npm run lint           # eslint (flat config)
npm test               # vitest run
npm run validate:cards # tarot dataset gate (78 unique cards, fields non-empty)
npm run fetch:cards    # re-download card images (idempotent, throttled)
```

## Project structure

```
src/
  app/
    (app)/          # authed-shell route group: reflect, journal, explore,
                    # memory, profile, settings (wrapped by AppShell layout)
    api/            # chat, tarot draw/clarify, insights, memories,
                    # followups, events, migrate/guest, journal-assist, account/delete
    auth/callback/  # Google PKCE return
    auth/confirm/   # email link confirmation (token hash)
    (auth)/         # standalone auth pages: login, signup, verify-email,
                    # forgot-password, reset-password, complete-profile
  components/       # app-shell, chat/, tarot/, journal/, explore/, memory/,
                    # landing/, profile/, settings/, auth/, followups/, ui/
  lib/
    ai/             # provider, system prompt, safety classifier, tools
    tarot/          # pure seeded engine, 78-card dataset, spreads, draw service
    guest/          # versioned localStorage store
    journal/        # mode-aware journal CRUD
    chat/           # UIMessage conversion helpers
  hooks/            # use-data-mode (the single guest/account branch point)
supabase/migrations/
brand/              # logo master + design system docs
docs/PRD.md         # product requirements (§1–§80) — behavioral authority
```

## Documentation

- [`docs/PRD.md`](docs/PRD.md) — product requirements, §1–§80; the behavioral authority (code comments cite it).
- [`DESIGN.md`](DESIGN.md) — the design system: warm daylight palette, one copper voice, indigo reserved for tarot surfaces.
- [`PRODUCT.md`](PRODUCT.md) — product context summary.
- [`AGENTS.md`](AGENTS.md) — repository guidelines for coding agents working in this codebase.
- [`brand/`](brand/) — logo master (`eclipsay-master.png`) the app assets are generated from.

## Card art attribution

All tarot card images in `public/cards/rws/` are from the Rider–Waite–Smith deck illustrated by **Pamela Colman Smith (1909)**, public domain. Any surface displaying card art carries this attribution.
