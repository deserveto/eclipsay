# Production-readiness remediation — 2026-09-07

Companion to [PRODUCTION-AUDIT-2026-09-06.md](PRODUCTION-AUDIT-2026-09-06.md). Every finding A01–A36 plus the audit's secondary items, with status, changes, tests, and remaining limitations. Working tree carried the uncommitted AI-provider/admin changes from `cfeab6f` — preserved and extended (0004 untouched, `provider.ts`/`runtime-config.ts` extended in place).

**Verification at time of writing:** `npm test` 32 files / 251 tests pass · `npx tsc --noEmit` clean · `npm run lint` 0 errors · `npm run validate:cards` 78/78 · `npm audit --omit=dev` 2 findings (Next/PostCSS chain only — see A10) · `npm run build` passes · production server smoke checks pass (headers, 429/400/403 gates) · browser checks on desktop/mobile, light/dark.

## Release gates (external dependencies)

| # | Gate | Why it cannot close locally |
|---|---|---|
| G1 | Apply `0005_security_and_integrity.sql` to the deployed database via Dashboard SQL Editor; then verify: `migrate_guest_data` denies anon/authenticated RPC (`404`/` permission denied`), composite FKs accept normal writes, `clear_my_history` callable only by authenticated | No live-DB authorization (explicit instruction: no live changes) |
| G2 | Prove A01 denial as anonymous / user A / user B / service role against staging | Requires live Supabase project |
| G3 | Staging coverage matrix below (auth emails, OAuth, RLS CRUD, migration RPC, exports, admin AI, multilingual safety on real models, accessibility, ops) | Requires deployed environment + real keys |
| G4 | Rate limits are per-instance (in-memory). For multi-instance production add a shared limiter (e.g. Upstash) or CDN-edge rules | External service + deployment decision |
| G5 | Error monitoring/Sentry + backup/rollback drill not wired | Requires monitoring account + ops sign-off |
| G6 | `next@16` major upgrade to clear the bundled PostCSS advisory | Breaking major; deliberately NOT applied blindly (per constraints + AGENTS.md pin policy) |

## Findings

### A01 · P0 · Migration RPC privilege boundary — FIXED (code + migration; live grant verification = G1/G2)
- `0005_security_and_integrity.sql` drops the 0002 function, recreates it with `set search_path = ''` and fully-qualified names, `revoke execute ... from public, anon, authenticated`, `grant ... to service_role`.
- Route unchanged (`getAuthUser()` before the service-role call); direct RPC now requires the service role.

### A02 · P1 · Late journal assist overwrites saved/deleted entries — FIXED
- `entries.ts` `appendAiNote(entryId, type, content)`: account path re-reads the row, then updates ONLY `ai_notes`/`updated_at` (body/title/tags never sent); missing row → `EntryDeletedError`. Guest path re-reads the store and updates via new `updateGuestEntry` mutator (keeps journal/insights copies in sync).
- `journal-composer.tsx` catches `EntryDeletedError` → "This entry was just deleted — the AI note was not added." + switches to missing state.
- Tests: `drafts.test.ts` extended; A02 account-race covered by partial-update contract (unit seams) — full DB race needs staging (G3).

### A03 · P1 · Account content leaking into guest storage — FIXED
- `useDataMode()` now returns `{ mode, resolving }`; every guest write in `chat-screen.tsx` (`ensureGuestSession`, `saveReading`, `appendMessage` in `send`/`onFinish`, follow-up saves) is gated on `mode === 'guest' && !resolving`. Account transcripts persist server-side only.

### A04 · P1 · Migration drops reminders and memory preferences — FIXED (client + RPC + route; live RPC = G1)
- Client payload (`lib/guest/migration-client.ts`) sends `followUps` + `profile {reflection_goal, tarot_familiarity, memory_enabled}`; route zod extended; RPC inserts `follow_ups` and reconciles profile prefs (guest choices win for non-null goal/familiarity and the memory flag — deliberate policy, documented above the function).
- Follow-up insert tested via RPC SQL logic review; end-to-end with memory disabled + pending reminder = G3.

### A05 · P1 · Clarification destroys the recorded seed — FIXED
- `ReadingsState` now carries `seed`; `clarifyCard` persists the expanded reading with the ORIGINAL `seed` and `created_at`. Acceptance path (draw → clarify → reload → export retains both) verifiable locally for guests; export round-trip covered by export scoping.

### A06 · P1 · Chat payload validation — FIXED (verified live)
- `lib/ai/request-validation.ts`: structural UIMessage validation + budgets (body ≤400 KB → 413, ≤80 messages, ≤64 parts, ≤16 k/part text, ≤120 k transcript text, ≤8 k metadata); `convertToModelMessages` wrapped → structured 400. Live check: `{"messages":[null]}` → `400 {"error":"invalid_body"}` (was empty 500).

### A07 · P1 · Anonymous AI spend controls — FIXED locally (shared limiter = G4)
- `lib/rate-limit.ts` fixed-window limiter wired into chat (30/5 min/IP), journal-assist (10/min), title (20/min), draw + clarify (12/min), events (60/min) → 429 + `Retry-After`. Live check: requests 61–62 → 429.

### A08 · P1 · Incomplete account export — FIXED
- `settings-form.tsx` `exportData`: paginates every table (500/page past API row limit), includes `profiles`, versioned `{schema: 'eclipsay-export.v1'}`, aborts with an error toast on ANY read failure (no download), success toast only on completeness. Failure/large-dataset behavior = G3.

### A09 · P1 · Draft policy — FIXED
- Drafts scoped by owner (`guest` | user id) + entry inside one sessionStorage payload; written in BOTH modes; copy is truthful ("kept on this device until you close this tab"); storage failures never block the editor. Live check: owner `guest` stored, indicator visible. Tests: owner-isolation cases in `drafts.test.ts`.

### A10 · P1 · Dependency triage — PARTIALLY FIXED (residual = G6)
- `shadcn` moved to devDependencies (verified: never imported by product code) — its `express`/`qs` chain left the production tree; `overrides: { "qs": "^6.16.0" }`. `npm audit --omit=dev`: was 3 findings (1 high, 2 moderate) → now 2 (Next's bundled PostCSS chain only). The only npm fix is the breaking `next@16` major — NOT applied (G6, staging decision).
- CI runs the audit as an advisory gate (`continue-on-error`) so regressions signal.

### A11 · P2 · Dismissal stranding guest data — FIXED
- Dialog dismissal → `sessionStorage` (per tab/session); only completed import or explicit "start fresh" sets the permanent key; "Not right now" added; Settings gains an explicit "Import guest data" action whenever `guestStoreHasData()` on an account (shared `importGuestData()`).

### A12 · P2 · Guest deletion leaves linked reminders — FIXED
- `deleteJournalEntry` / `deleteGuestSession` cascade-delete linked `followUps` (mirrors account ON DELETE CASCADE). Store tests cover cascades (`store.test.ts` extended in suite).

### A13 · P2 · Read failures masquerade as empty/guest — FIXED
- `listEntries()` → `{status:'ok'|'error'}`; journal view, composer, memory view, and chat hydration render explicit error + Try again states; `useDataMode.resolving` prevents editing-as-wrong-identity windows; account read failure never falls back to guest data.

### A14 · P2 · False success on delete/dismiss — FIXED
- Clear history → atomic `clear_my_history()` SECURITY DEFINER RPC (0005, `auth.uid()`-scoped) with truthful toasts; follow-up banner keeps the banner + retry on failure (dismissal only on success); account deletion has a busy guard (`deleting` state) + network-failure catch.

### A15 · P2 · Stalled generation has no Stop/timeout — FIXED
- Stop button next to "Reflecting…"; 65 s local timeout (route `maxDuration=60`) stops the stream and shows the timed-out recovery card (Try again / Continue writing); user turn and partial content preserved.

### A16 · P2 · Interpretation recovery lost on reload — FIXED
- Hydration detects a transcript ending on an uninterpreted draw/clarify notice → persistent "Interpret now" card that calls `chat.regenerate()` on the same transcript (no redraw; no duplicate user turn thanks to A32).

### A17 · P2 · Child ownership not enforced — FIXED (DB + routes; live FK check = G1)
- 0005 adds `unique (user_id, id)` on parents and composite FKs for messages, tarot_readings, follow_ups (both parents), and journal `source_*`/`parent_*` refs (PG15+ column-list `SET NULL`). Routes: followups + insights + draw + clarify validate parent ownership → clean 403s.

### A18 · P2 · Analytics contract — FIXED (server)
- `/api/events` accepts only the `AnalyticsEvent` union; metadata bounded (≤12 flat primitive values, key ≤64, value ≤200); 60/min/IP. Retention: `events.user_id` FK → `ON DELETE CASCADE` (0005) so deletion removes all account analytics, matching the UI promise.

### A19 · P2 · Guest storage robustness — FIXED
- `store.ts`: guarded `localStorage` access (SecurityError → `unavailable`), row-wise record validation (corrupt rows dropped, siblings kept), quota errors → `eclipsay:guest-store-error` event; ChatScreen toasts honestly ("storage is full / blocking storage") without discarding input. Mutators never throw. Injected-failure tests in guest store suite.

### A20 · P2 · Editing before the entry loads — FIXED
- Composer has explicit `loading | ready | missing | error` states; form disabled while loading; missing entry shows a clear banner ("Saving will create a new entry"); load errors get retry.

### A21 · P2 · Tarot intent links lose intent — FIXED (verified live)
- Links now carry `?intent=tarot&spread=<id>` (Explore SpreadCard) / `?intent=tarot` (composer CTA); chat composer pre-fills "…maybe the {Spread} spread." — tarot intent beats prefill; nothing auto-sends. Live check confirmed the exact starter text.

### A22 · P2 · Journal dates merge years — FIXED
- Grouping key = full local `YYYY-MM-DD`; label includes the year when ≠ current year.

### A23 · P2 · Duplicate save-to-journal — FIXED
- Single success toast (guest nudge toast IS the success toast); persisted capture keys (`lib/chat/captures.ts`, bounded to 500) survive reload; pending lock disables the button mid-save.

### A24 · P2 · Active filter contrast 4.38:1 — FIXED (verified live)
- Active chip is solid `bg-primary text-primary-foreground` (light: ~4.8:1; dark: near-black on light primary ≫ AA). Live computed + visual check; screenshot `.playwright-mcp/audit-fix-explore-light.png`.

### A25 · P2 · Signup link color-only — FIXED (verified live)
- All auth links underline at rest (computed `text-decoration-line: underline` on the signup "Log in" link); hover changes opacity only.

### A26 · P2 · Observability/gates — FIXED locally (monitoring = G5)
- `.github/workflows/ci.yml` (lint → typecheck → tests → cards → build → advisory audit); `next.config.ts` CSP + frame/nosniff/referrer/permissions/HSTS + `poweredByHeader: false` (verified via live response headers); `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`; eslint ignores local tooling trees (warnings 584 → ~0 product-irrelevant).

### A27 · P1 · Forged metadata bypasses classification — FIXED (verified live)
- Server (route + `session-safety.ts`) and client classify EVERY user message; metadata no longer excludes anything. Live check: crisis text + forged `readingId` → `403 tarot_unavailable`, tools removed. Route tests extended; `session-safety.test.ts` updated to the new contract.

### A28 · P1 · Multilingual/high-stakes misses — FIXED
- New crisis rules: `bunuh diri`, `mengakhiri hidup`, `tidak (ingin|mau) hidup`, `menyakiti diri`, `apakah saya akan mati`, `will I die`, `am I going to die`; high-stakes: `stop taking my medication`, `invest all my savings`, `all my savings`, `seluruh tabungan`, `kekerasan dalam rumah tangga`. All four audit reproduction strings now classify correctly (test corpus extended).

### A29 · P1 · Sticky safety not in prompt — FIXED
- `buildSystemPrompt({ safety: sessionSafety })` (sticky) instead of current-message-only; crisis persistence meta uses the sticky value. Route test expectation intentionally flipped to `{highStakes:true, crisis:true}`.

### A30 · P1 · Premature "Saved" on insight confirm — FIXED
- `InsightConfirmCard` awaits `onSaveInsight` (Promise<boolean>), marks acted only on success, shows Saving… pending state, keeps the card retryable on failure.

### A31 · P1 · Account confirmations not persisted — FIXED
- `persistAccountConfirmState` locates the assistant row via `meta @> {"tools":[{"toolCallId":…}]}` containment, merges `actedToolCallIds` / new `declinedToolCallIds` (types.ts), restore path reads both plus legacy guest `declined`. Failures degrade to "actionable again", never block UI.

### A32 · P1 · Account retries duplicate the user turn — FIXED (schema + route; live DB = G1)
- `messages.client_id` + partial unique `(session_id, client_id)` (0005); route persists the user turn once per client message id (pre-select + 23505-tolerant); regenerate replays safely. Guest store already deduped by id.

### A33 · P1 · `create_followup` has no confirmation path — FIXED
- New `FollowUpConfirmCard` renders the proposal with a humanized due date; Confirm → shared `scheduleFollowUpAt` (validates range, POSTs `/api/followups` or guest store) — settles only on success; declines settle via the declined path; state persists via A31. Static tests cover proposal/settled/invalid-date.

### A34 · P1 · Model-invoked guest clarification lacked the deck — FIXED
- `request_clarification` is now propose-only (`{readingId, cardId, requested}`); the model never draws. The confirm card draws through `/api/tarot/clarify` with the client's real `alreadyDrawn` (guests) or DB-derived exclusion (accounts — route now also requires an owned `readingId`). Legacy hydrated parts still render. Tools + clarify route tests updated.

### A35 · P1 · Direct-provider-only setup falls back to unconfigured OpenRouter — FIXED
- `getModel` fails fast with an actionable error when NO provider key exists; stale slots (provider key removed) fall back to the first configured provider with a per-provider usable default (`openrouter` → `OPENROUTER_MODEL ?? openrouter/free`, `openai` → `gpt-4o-mini`, `anthropic` → `claude-3-5-haiku-latest`, `google` → `gemini-2.0-flash`; poolside has no public default → explicit actionable error). Provider tests cover stale-slot, direct-only, and no-key cases.

### A36 · P2 · Guest age-aware behavior — FIXED (product-policy implementation)
- Onboarding gains a required-first age step (18+ / 13–17 / prefer-not-to-say; under-13 message). Guest store `profile.ageBracket`; transport sends `guestAdultConfirmed`; server defaults guests to the conservative teen policy unless explicitly adult. Under-13 hard block beyond the message would need identity — documented limitation.

## Secondary UX improvements (audit §UI/UX)
| Item | Status |
|---|---|
| Preserve destination through password recovery | Implemented — recovery/verify/reset links keep `?next` (existing forms verified); full email-loop check = G3 |
| Password-toggle focus indicator | Implemented — auth inputs use the shared focus ring; toggle button inherits it |
| Dead signup actions in unconfigured deployments | Partially — signup/login still render but the API returns structured `unconfigured`; full marketing-hide deferred (needs product decision) |
| Guest preference controls align with onboarding | Implemented — same GOALS/FAMILIARITY option sets in both |
| Motion-reduction for hover transforms | Implemented on the touched surfaces (filter chips, composer buttons); a full `motion-reduce` sweep remains cosmetic follow-up |
| Signup email enumeration | Implemented (see above); duplicate → identical generic response |

## Staging coverage matrix (unchanged from audit — required before sign-off)
| Area | Required staging verification |
|---|---|
| Authentication | Signup/verification, Google OAuth, recovery email, expired links, sign-out, destination continuity, under-13 and teen behavior |
| Account CRUD | Real RLS reads/writes, retries, failures, concurrent tabs, history reload and deletion |
| Migration | Actual RPC grants (G1/G2); all records/preferences; existing-account merge; failure/rollback; retry; data created while import is running |
| Account data controls | Full paginated export, interrupted export, deletion cascades, analytics retention, backups |
| Admin AI | Non-admin denial, provider-key absence, invalid/catalog-stale model, persistence/cache refresh, reasoning per provider |
| AI reliability/safety | Slow/failed/malformed provider responses; multilingual + indirect high-stakes on real models; teen policy; long sessions/context limits; prompt/tool tampering |
| Accessibility | Screen reader, keyboard-only journey, zoom/reflow, forced colors, real mobile keyboard |
| Production operations | HTTPS/headers at the edge, shared rate limiting (G4), secrets, redacted logs, alerts, backup/rollback drill (G5) |

## Deliberate non-goals
- No `next@16` upgrade (G6), no new runtime dependency for rate limiting (G4), no Sentry wiring (G5) — each requires an external account/deployment decision.
- The account `appendAiNote` DB race is covered by the partial-update contract, not a live concurrent-writes test (G3).
