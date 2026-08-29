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
| `NEXT_PUBLIC_APP_URL` | Auth redirect base URL |

Apply the SQL in `supabase/migrations/` (`0001_init.sql`, `0002_migrate_guest.sql`) via the Supabase Dashboard SQL Editor — no CLI config lives in this repo.

## Scripts

```bash
npm run dev            # dev server (Turbopack, port 3000)
npm run build          # production build (type + lint validation included)
npm run lint           # eslint (flat config)
npm test               # vitest run
npx tsc --noEmit       # typecheck (no npm script — run directly)
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
    auth/callback/  # PKCE callback
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
