# Repository Guidelines

## Project Overview

Eclipsay — a private, chat-first AI reflection companion (Next.js 15 App Router, TypeScript strict). Users talk through what's on their mind, optionally draw Rider–Waite–Smith tarot cards as reflective prompts, save insights to a journal, build explicit AI memory, and revisit reflections via in-app follow-ups. Guest-first: all data lives in `localStorage` until an account (Supabase, RLS) is created. LLM access runs through Vercel AI SDK v7 behind a multi-provider registry (`src/lib/ai/provider.ts`): OpenRouter by default (`openrouter/free`), with direct OpenAI, Anthropic, Google, and Poolside enabled whenever their API key is set — the LLM never selects or invents tarot cards.

**`docs/PRD.md` is the behavioral authority** (~2200 lines, sections §1–§80). Code comments cite its section numbers; when behavior is ambiguous, match the PRD.

## Architecture & Data Flow

**Guest vs Account branching happens in exactly one place: `src/hooks/use-data-mode.ts`** (`useDataMode()` → `{ mode: 'guest' | 'account', resolving }`). Every data surface consumes it.

- **Guest mode**: versioned `GuestStore` in localStorage key `eclipsay.guest.v1` (`src/lib/guest/store.ts`). All mutators are synchronous write-through and dispatch `window` CustomEvent `eclipsay:guest-store-changed`; listeners (AppShell recent list, FollowUpBanner) re-read on it. Nothing is ever uploaded until migration. Storage failures (`unavailable`/`quota`/`corrupt`) dispatch `eclipsay:guest-store-error` instead of throwing — ChatScreen surfaces them; deleting a session/entry cascade-deletes its guest follow-ups.
- **Account mode**: Supabase with RLS (`auth.uid() = user_id` on every table). Browser client `src/lib/supabase/client.ts`, route-handler client `src/lib/supabase/server.ts` (`getAuthUser()` returns `User | null` — null = guest), service-role client `src/lib/supabase/admin.ts` used ONLY by `/api/migrate/guest` and `/api/account/delete`. `useDataMode()` returns `{ mode, resolving }` — no component writes guest data while `resolving` or outside guest mode.

**Chat flow**: `src/components/chat/chat-screen.tsx` (`useChat<ChatMessage>` + `DefaultChatTransport` → `POST /api/chat`) → route validates shape/budgets (`src/lib/ai/request-validation.ts`), rate-limits per IP (`src/lib/rate-limit.ts` — in-memory, single-instance; shared limiter required for multi-instance deploys), and classifies EVERY user message's text (`src/lib/ai/safety.ts`; client-controlled metadata never gates classification) → sticky session safety (`sessionSafety`) drives tools AND the prompt → **tarot tools are registered only when `!highStakes`** → `streamText` with `stopWhen: isStepCount(5)` → account user rows persist idempotently by `messages.client_id` (the client message id) and assistant rows fire-and-forget after streaming, extracting `MessageMeta` from tool-result parts.

**Reading flow (conversational, model-driven)**: the MODEL clarifies and recommends but NEVER draws — `ask_user` carries one batch of 1–3 grouped questions (0 when intent is clear; never a second batch) plus an optional `freeformLabel` (model-authored in the user's language, English fallback) for the panel's free-text answer field, and renders as a composer-attached progressive panel (`ComposerClarification`), docked above the input only after streaming; non-docked batches render as settled `Answered`/`Continued in chat` history. `recommend_reading` renders a mystical recommendation panel (with card-count-diverse alternates from `pickReading`). Assistant prose always renders before tool action surfaces. One click on "Begin reading" → `POST /api/tarot/draw` (real seed) → the docked `DrawBar` (`src/components/tarot/draw-bar.tsx`, separate `Reading positions` + `Choose from the deck` insets) → on completion the client sends a `[Cards drawn · …]` summary message → the model interprets only those cards. The old `suggest_spread`/`draw_tarot_cards` tools and the spread-picker dialog/`DrawCeremony` are gone — don't reintroduce them.

**Tarot engine purity (invariant)**: `src/lib/tarot/engine.ts` is pure and seeded (mulberry32); card identities and orientations are ALWAYS computed there — never by the LLM, never client-side. `src/lib/tarot/draw-service.ts` is the only DB writer (authed inserts `tarot_readings` with the seed; guests persist client-side). Hydration renders persisted readings verbatim — never re-draw (PRD §26). `getCard()` throws on unknown ids so the model can't introduce cards.

**Propose-then-confirm**: `propose_insight` / `propose_memory` / `request_clarification` / `create_followup` tools only return payloads; UI renders confirm cards (`tool-parts.tsx`); writes happen only on explicit click → REST routes (account) or guest-store mutators. Confirm/decline state persists for BOTH modes (`actedToolCallIds` / `declinedToolCallIds` in message meta; accounts locate rows via `meta.tools` jsonb containment). `search_journal` returns titles only; body text enters the prompt only after "Bring it in" → `approvedContext` in message metadata → route injects it into the system prompt. Chat payload + safety invariants: malformed payloads → structured 400 (`request-validation.ts`), every user text classified regardless of metadata (A27), sticky session safety in tools AND prompt (A29), user turns idempotent by client id (A32).

**Guest migration**: `MigrationDialog` (or the Settings "Import guest data" action) → `importGuestData()` (`src/lib/guest/migration-client.ts`) sends sessions/readings/messages/journal/memories/followUps/profile → `POST /api/migrate/guest` → service-role `.rpc('migrate_guest_data')` (one transaction, `0002` + `0005`; `0005` locks EXECUTE to `service_role` only) → `clearGuestData()` only on 200. Dismissing the dialog is session-scoped (`sessionStorage`); only completed import/start-fresh is permanent.

**Analytics**: `track(name, meta)` posts to `/api/events` — names restricted to the `AnalyticsEvent` union, flat bounded metadata only, never message/journal text (PRD §68). `events.user_id` cascades on account deletion.

**AI model configuration (admin)**: the active model per surface (`chat`, `utility`) lives in `app_config` key `'ai'` (`0004_app_config.sql`: public-read RLS, service-role writes only), edited from `/settings` by an admin — `ADMIN_EMAILS` gate (`src/lib/auth/admin.ts`); unset disables the surface entirely. Reads layer DB → `OPENROUTER_MODEL` → `openrouter/free` behind a 60s in-memory cache (`src/lib/ai/runtime-config.ts`); `getModel(usage)` resolves slots against a registry built only from key-configured providers (openrouter, openai, anthropic, google, poolside). Thinking is a chat-only affordance mapped per provider (OpenRouter `reasoning.effort`, OpenAI `reasoningEffort`, Anthropic `thinking.budgetTokens` + `maxOutputTokens` ceiling, Google `thinkingBudget`); reasoning text is never streamed or stored (`exclude: true`). Utility (session titles, journal notes) never reasons.

## Key Directories

| Path | Purpose |
|---|---|
| `src/app/` | Routes. Landing at `src/app/page.tsx`; all app pages live in the `src/app/(app)/` route group (shared `layout.tsx` wraps them in `AppShell`): `/reflect` + `/reflect/[sessionId]` (chat), `/journal` + `/journal/new` (timeline/composer), `/memory`, `/explore` + `/explore/cards/[cardId]`, `/profile`, `/settings`. API: `src/app/api/{chat,tarot/draw,tarot/clarify,insights,memories,followups,events,migrate/guest,journal-assist,account/delete,sessions/[sessionId],admin/{ai-config,models}}/route.ts` + `src/app/api/sessions/[sessionId]/title/route.ts` (AI title). PKCE callback lives at `src/app/auth/callback/route.ts` — NOT under `api/`. `src/app/icon.png` is the favicon (generated from `brand/eclipsay-master.png`).|
| `src/lib/ai/` | Multi-provider registry (`provider.ts` — the `getModel(usage)` model seam), runtime AI config (`runtime-config.ts`), per-provider model catalog (`model-catalog.ts`), system-prompt builder (all behavioral rules + safety injection), safety classifier, tool factories. |
| `src/lib/tarot/` | Pure engine, static 78-card dataset (`cards.ts` + `data/{majors,wands,cups,swords,pentacles}.ts`), spreads, server-only draw service, domain types. |
| `src/lib/guest/store.ts` | Entire guest data layer (versioned localStorage). |
| `src/lib/journal/entries.ts` | Mode-aware journal CRUD + `appendAiNote` (never rewrites body). |
| `src/lib/chat/convert.ts` | `ChatMessage = UIMessage<MessageMeta>`; `storedToUi()` / `joinUiText()`. |
| `src/lib/types.ts` | All row shapes, snake_case, mirroring `supabase/migrations/0001_init.sql` exactly (guest records must stay 1:1 insertable). |
| `src/components/` | `app-shell.tsx` (collapsible ChatGPT-style sidebar + mobile Sheet), `chat/` (ChatScreen, tool-part renderers, markdown, crisis resources), `tarot/` (spread panel, draw bar, detail dialog), `auth/`, `followups/`, `explore/`, `journal/`, `landing/`, `memory/`, `profile/`, `settings/`, `ui/` (vendored shadcn — don't hand-edit style conventions). |
| `brand/` | `eclipsay-master.png` — the logo master (transparent). `public/logo.webp` (512) and `src/app/icon.png` (256 favicon) are generated from it via sharp (trim → pad 5% → resize); regenerate rather than editing the derived assets. |
| `public/` | `cards/rws/` — exactly 78 jpgs named by card id, attribution "Pamela Colman Smith (1909), public domain" on every surface showing card art; `logo.webp`. |
| `scripts/` | `fetch-card-images.ts` (idempotent Commons downloader), `validate-cards.ts` (dataset gate). |
| `supabase/migrations/` | `0001_init.sql` (8 RLS tables), `0002_migrate_guest.sql`, `0003_account_identity.sql` (profiles identity + auth-user trigger), `0004_app_config.sql` (admin AI runtime config), `0005_security_and_integrity.sql` (A01 RPC lockdown to `service_role`, A04 followups+profile import, A17 composite owner FKs, A18 events cascade, A32 `messages.client_id`, atomic `clear_my_history()`). No supabase CLI config in-repo — migrations apply via Dashboard SQL Editor; `0005` MUST be applied before any production migration/account flows. |

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

- **Naming**: component files kebab-case (`chat-screen.tsx`); components use named exports (default only for pages); API `route.ts` files export named verbs (`POST`, `PATCH`) — never defaults, and NEVER anything else: Next's generated route types reject non-verb exports, so test seams and helpers live in `lib/` modules (see `model-catalog.ts`). Hooks live in `use-*.ts` files exporting `useXxx`.
- **Imports**: `@/*` → `src/*` everywhere; only `lib/tarot` and `lib/guest` use relative `../types`.
- **Field naming**: DB-row types in `src/lib/types.ts` are snake_case mirroring SQL (`source_session_id`, `due_at`); API/tool payloads are camelCase (`readingId`, `dueAt`).
- **Error contract**: API routes return `{ error: 'snake_case_code' }` with 400/401/403/500 (`invalid_body`, `unauthenticated`, `forbidden`, `admin_disabled`, `draw_failed`, `generation_failed`, `not_configured`, `save_failed`, `unsupported_provider`, `fetch_failed`, …). All request bodies are zod-validated.
- **Async**: chat persistence after streaming is fire-and-forget (`void (async () => …)()` with try/catch) — never block the stream on DB writes. Next 15 route params are `Promise`-typed and awaited.
- **Server/client boundary**: pages touching `localStorage`/`useChat`/`window` are `'use client'` (directive on first line); server components only render/redirect. Everything env-guarded: `isSupabaseConfigured()` / `isSupabaseServerConfigured()` / `isSupabaseAdminConfigured()` / `isAiConfigured()` (true when ANY LLM provider key is set) let the whole app run guest-only without credentials.
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
| `src/lib/ai/provider.ts` | The model seam: registry built from env-configured providers; `getModel(usage)` resolves chat/utility slots + reasoning provider options. |
| `src/lib/ai/runtime-config.ts` | Active model slots (`app_config` key `'ai'`) with 60s cache and env fallback; `saveAiRuntimeConfig` is service-role only. |
| `src/lib/auth/admin.ts` | `ADMIN_EMAILS` gate (`adminGate()`) backing `/api/admin/*` and the `/settings` admin section. |
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
- `next` / `eslint-config-next` are exact-pinned `15.5.24` (upgrade in lockstep). React must stay `≥19.2.1` (peer range of `@ai-sdk/react@4` — 19.1.0 fails install with ERESOLVE). AI SDK provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`) are the same generation as `ai` — upgrade them in lockstep.
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

Known gaps (add tests when touching these): AI layer (`system-prompt` — `provider`, `runtime-config`, `model-catalog`, and the `admin/ai-config` + `admin/models` route handlers are covered), `draw-service`, the insights/memories/followups/events/migrate route handlers, and all components are untested (`src/lib/ai/tools.ts` is covered by `tools.test.ts`). `validate-cards.ts` covers the dataset but not the 78 image files in `public/cards/rws/`.
