# Repository Guidelines

## Project Overview

Eclipsay — a private, chat-first AI reflection companion (Next.js 15 App Router, TypeScript strict). Users talk through what's on their mind, optionally draw Rider–Waite–Smith tarot cards as reflective prompts, save insights to a journal, build explicit AI memory, and revisit reflections via in-app follow-ups. Guest-first: all data lives in `localStorage` until an account (Supabase, RLS) is created. LLM access runs through OpenRouter via Vercel AI SDK v7 — the LLM never selects or invents tarot cards.

**`docs/PRD.md` is the behavioral authority** (~2200 lines, sections §1–§80). Code comments cite its section numbers; when behavior is ambiguous, match the PRD.

## Architecture & Data Flow

**Guest vs Account branching happens in exactly one place: `src/hooks/use-data-mode.ts`** (`useDataMode()` → `{ mode: 'guest' | 'account' }`). Every data surface consumes it.

- **Guest mode**: versioned `GuestStore` in localStorage key `eclipsay.guest.v1` (`src/lib/guest/store.ts`). All mutators are synchronous write-through and dispatch `window` CustomEvent `eclipsay:guest-store-changed`; listeners (AppShell recent list, FollowUpBanner) re-read on it. Nothing is ever uploaded until migration.
- **Account mode**: Supabase with RLS (`auth.uid() = user_id` on every table). Browser client `src/lib/supabase/client.ts`, route-handler client `src/lib/supabase/server.ts` (`getAuthUser()` returns `User | null` — null = guest), service-role client `src/lib/supabase/admin.ts` used ONLY by `/api/migrate/guest` and `/api/account/delete`.

**Chat flow**: `src/components/chat/chat-screen.tsx` (`useChat<ChatMessage>` + `DefaultChatTransport` → `POST /api/chat`) → route classifies the last user message (`src/lib/ai/safety.ts`) → **tarot tools are registered only when `!highStakes`** (crisis additionally injects crisis-resource copy) → `streamText` with `stopWhen: isStepCount(5)` → account mode persists user + assistant rows fire-and-forget after streaming, extracting `MessageMeta` from tool-result parts (`readingRecommendation` for `recommend_reading`, `clarify` for `request_clarification`).

**Reading flow (conversational, model-driven)**: the MODEL clarifies and recommends but NEVER draws — `ask_user` carries one batch of 1–3 grouped questions (0 when intent is clear; never a second batch) plus an optional `freeformLabel` (model-authored in the user's language, English fallback) for the panel's free-text answer field, and renders as a composer-attached progressive panel (`ComposerClarification`), docked above the input only after streaming; non-docked batches render as settled `Answered`/`Continued in chat` history. `recommend_reading` renders a mystical recommendation panel (with card-count-diverse alternates from `pickReading`). Assistant prose always renders before tool action surfaces. One click on "Begin reading" → `POST /api/tarot/draw` (real seed) → the docked `DrawBar` (`src/components/tarot/draw-bar.tsx`, separate `Reading positions` + `Choose from the deck` insets) → on completion the client sends a `[Cards drawn · …]` summary message → the model interprets only those cards. The old `suggest_spread`/`draw_tarot_cards` tools and the spread-picker dialog/`DrawCeremony` are gone — don't reintroduce them.

**Tarot engine purity (invariant)**: `src/lib/tarot/engine.ts` is pure and seeded (mulberry32); card identities and orientations are ALWAYS computed there — never by the LLM, never client-side. `src/lib/tarot/draw-service.ts` is the only DB writer (authed inserts `tarot_readings` with the seed; guests persist client-side). Hydration renders persisted readings verbatim — never re-draw (PRD §26). `getCard()` throws on unknown ids so the model can't introduce cards.

**Propose-then-confirm**: `propose_insight` / `propose_memory` / `create_followup` tools only return payloads; UI renders confirm cards; writes happen only on explicit click → REST routes (account) or guest-store mutators. `search_journal` returns titles only; body text enters the prompt only after "Bring it in" → `approvedContext` in message metadata → route injects it into the system prompt.

**Guest migration**: `MigrationDialog` flattens the store → `POST /api/migrate/guest` → admin `.rpc('migrate_guest_data')` (one SQL transaction, `supabase/migrations/0002_migrate_guest.sql`) → `clearGuestData()` only on 200.

**Analytics**: `track(name, meta)` posts to `/api/events` — event names from the `AnalyticsEvent` union, metadata only, never message/journal text (PRD §68).

## Key Directories

| Path | Purpose |
|---|---|
| `src/app/` | Routes. Landing at `src/app/page.tsx`; all app pages live in the `src/app/(app)/` route group (shared `layout.tsx` wraps them in `AppShell`): `/reflect` + `/reflect/[sessionId]` (chat), `/journal` + `/journal/new` (timeline/composer), `/memory`, `/explore` + `/explore/cards/[cardId]`, `/profile`, `/settings`. API: `src/app/api/{chat,tarot/draw,tarot/clarify,insights,memories,followups,events,migrate/guest,journal-assist,account/delete,sessions/[sessionId]}/route.ts` + `src/app/api/sessions/[sessionId]/title/route.ts` (AI title). PKCE callback lives at `src/app/auth/callback/route.ts` — NOT under `api/`. `src/app/icon.png` is the favicon (generated from `brand/eclipsay-master.png`).|
| `src/lib/ai/` | OpenRouter provider, system-prompt builder (all behavioral rules + safety injection), safety classifier, tool factories. |
| `src/lib/tarot/` | Pure engine, static 78-card dataset (`cards.ts` + `data/{majors,wands,cups,swords,pentacles}.ts`), spreads, server-only draw service, domain types. |
| `src/lib/guest/store.ts` | Entire guest data layer (versioned localStorage). |
| `src/lib/journal/entries.ts` | Mode-aware journal CRUD + `appendAiNote` (never rewrites body). |
| `src/lib/chat/convert.ts` | `ChatMessage = UIMessage<MessageMeta>`; `storedToUi()` / `joinUiText()`. |
| `src/lib/types.ts` | All row shapes, snake_case, mirroring `supabase/migrations/0001_init.sql` exactly (guest records must stay 1:1 insertable). |
| `src/components/` | `app-shell.tsx` (collapsible ChatGPT-style sidebar + mobile Sheet), `chat/` (ChatScreen, tool-part renderers, markdown, crisis resources), `tarot/` (spread panel, draw bar, detail dialog), `auth/`, `followups/`, `explore/`, `journal/`, `landing/`, `memory/`, `profile/`, `settings/`, `ui/` (vendored shadcn — don't hand-edit style conventions). |
| `brand/` | `eclipsay-master.png` — the logo master (transparent). `public/logo.webp` (512) and `src/app/icon.png` (256 favicon) are generated from it via sharp (trim → pad 5% → resize); regenerate rather than editing the derived assets. |
| `public/` | `cards/rws/` — exactly 78 jpgs named by card id, attribution "Pamela Colman Smith (1909), public domain" on every surface showing card art; `logo.webp`. |
| `scripts/` | `fetch-card-images.ts` (idempotent Commons downloader), `validate-cards.ts` (dataset gate). |
| `supabase/migrations/` | `0001_init.sql` (8 RLS tables), `0002_migrate_guest.sql`. No supabase CLI config in-repo — migrations apply via Dashboard SQL Editor. |

## Development Commands

```bash
npm run dev            # next dev --turbopack (port 3000)
npm run build          # next build --turbopack
npm run lint           # eslint (flat config)
npm test               # vitest run
npx tsc --noEmit       # typecheck — NO package script exists; run directly
npm run validate:cards # tarot dataset gate (78 unique, 22 major + 14×4, fields non-empty)
npm run fetch:cards    # re-download card images (idempotent, throttled; only sharp consumer)
```

Windows fallback if npm can't spawn the binary: `node node_modules/next/dist/bin/next dev`.

## Code Conventions & Common Patterns

- **Naming**: component files kebab-case (`chat-screen.tsx`); components use named exports (default only for pages); API `route.ts` files export named verbs (`POST`, `PATCH`) — never defaults; hooks live in `use-*.ts` files exporting `useXxx`.
- **Imports**: `@/*` → `src/*` everywhere; only `lib/tarot` and `lib/guest` use relative `../types`.
- **Field naming**: DB-row types in `src/lib/types.ts` are snake_case mirroring SQL (`source_session_id`, `due_at`); API/tool payloads are camelCase (`readingId`, `dueAt`).
- **Error contract**: API routes return `{ error: 'snake_case_code' }` with 400/401/500 (`invalid_body`, `unauthenticated`, `draw_failed`, `generation_failed`, …). All request bodies are zod-validated.
- **Async**: chat persistence after streaming is fire-and-forget (`void (async () => …)()` with try/catch) — never block the stream on DB writes. Next 15 route params are `Promise`-typed and awaited.
- **Server/client boundary**: pages touching `localStorage`/`useChat`/`window` are `'use client'` (directive on first line); server components only render/redirect. Everything env-guarded: `isSupabaseConfigured()` / `isSupabaseServerConfigured()` / `isAiConfigured()` let the whole app run guest-only without credentials.
- **State**: no global state library — React state + the guest store CustomEvent. Lookup tables are `Record` (never `Map` for static string keys). No tiny wrapper functions; extract only meaningful units.
- **TypeScript**: `strict` on, zero `any` in `lib/` — cross untyped Supabase rows as `as unknown as T` at the boundary only.
- **UI rules**: warm oklch tokens in `globals.css`; `.mystical`/`.mystical-card-back` classes used ONLY inside tarot surfaces (PRD §67); every animation respects `prefers-reduced-motion` (flip reveal → instant); reversed cards = rotated image + text badge, never color-only; card alt text = `"<name>, <orientation>"`; destructive actions always behind `window.confirm`; the sidebar collapses ChatGPT-style (logo-only rail; hover swaps logo → expand button) with the choice persisted in `localStorage` key `eclipsay.sidebar.collapsed`; scrollbars are globally styled in `globals.css` (thin warm pills, moonpaper-white inside `.mystical`).
- **Env guards in middleware** (`src/middleware.ts`): missing Supabase vars → pass through unchanged (everyone is a guest); matcher skips `_next/static`, `favicon.ico`, `cards/`, and image extensions.

## Important Files

| File | Why it matters |
|---|---|
| `src/lib/tarot/engine.ts` | Deterministic engine — §25/§26 guarantees live here; everything tarot calls it. |
| `src/lib/ai/tools.ts` | `ask_user` + `recommend_reading` (via `pickReading` alternates) + `request_clarification` + propose-then-confirm payloads (§62 model–app boundary). The model NEVER draws — no draw tool exists. |
| `src/lib/ai/system-prompt.ts` | All companion behavioral rules; safety injection point. |
| `src/lib/ai/safety.ts` | `classify()` regex gates; crisis implies highStakes. Over-match OK, under-match not. |
| `src/lib/ai/tools.ts` | Tool schemas + propose-then-confirm payloads (§62 model–app boundary). |
| `src/lib/guest/store.ts` | Versioned guest store; every mutator takes an optional trailing `storage?: Storage` (test seam — keep it). |
| `src/lib/types.ts` | Shared row shapes + `MessageMeta`; keep in lockstep with migrations. |
| `src/components/chat/chat-screen.tsx` | Client core: chat, clarify/confirm handlers, chips, recommendation → draw-bar flow (`beginReading`/`completeDraw`), error UI. |
| `src/components/app-shell.tsx` | Shell: collapsible sidebar (persisted), logo header, mobile Sheet, custom-scroll surfaces. |
| `src/middleware.ts` | Session refresh + env-guarded guest fallback. |
| `supabase/migrations/0001_init.sql` | Schema — `src/lib/types.ts` must mirror it. |
| `DESIGN.md`, `PRODUCT.md` (repo root) | Design system + product context; read alongside the PRD. |

## Runtime/Tooling Preferences

- **Node ≥ 22** (required by `ai@7` / `@ai-sdk/react` engines; not compiler-enforced), **npm** as package manager (lockfile only, no yarn/pnpm).
- **Turbopack in both `dev` and `build`, sharing the same `.next` dir**: never run `npm run build` while `npm run dev` is running — it corrupts `.next` vendor chunks. Stop dev → build → restart dev.
- `next` / `eslint-config-next` are exact-pinned `15.5.24` (upgrade in lockstep). React must stay `≥19.2.1` (peer range of `@ai-sdk/react@4` — 19.1.0 fails install with ERESOLVE).
- Tailwind v4 is CSS-first (`@tailwindcss/postcss` only, no `tailwind.config` file); shadcn primitives via `components.json` (style radix-nova, lucide icons).
- `vitest` runs in `environment: 'node'` — no jsdom installed; component tests would need explicit setup.
- `vitest.config.ts` resolves the `@/*` alias to `src/` — keep it in sync if the alias ever moves.
- `zod@4` satisfies the AI SDK peer range — don't downgrade to zod 3.

## Testing & QA

```bash
npm test              # vitest run (src/**/*.test.ts, colocated beside sources)
npx tsc --noEmit      # typecheck (no npm script — remember it manually)
npm run lint
npm run validate:cards
npm run build         # includes type + lint validation
```

Conventions: behavior-focused assertions only (never assert source text or internals); engine tests lock seeded determinism (`same seed → deep-equal draw`); safety tests iterate curated positive/negative case tables with `expect(classify(text), text)` so the failing input shows in the message; guest-store tests inject a `MemoryStorage` shim plus a one-method `window` shim (`dispatchEvent` only) — never switch the suite to jsdom.

Known gaps (add tests when touching these): AI layer (`provider`, `system-prompt`), `draw-service`, all API route handlers, and all components are untested (`src/lib/ai/tools.ts` is covered by `tools.test.ts`). `validate-cards.ts` covers the dataset but not the 78 image files in `public/cards/rws/`.
