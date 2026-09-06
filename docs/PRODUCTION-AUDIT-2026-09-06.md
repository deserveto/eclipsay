# Eclipsay production readiness audit

Audited 6–7 September 2026 (Asia/Jakarta; browser evidence timestamps use UTC). Target: working tree at `cfeab6f`, including existing uncommitted AI-provider/admin changes. Application code was not modified. This is a release assessment, not a certification that every deployment condition has been exercised.

**Release recommendation: do not launch publicly yet.** The interface has a coherent identity and the core guest loop works, but confirmed data loss, account/guest isolation defects, migration omissions, and insufficient failure handling require fixes. The migration RPC privilege issue requires verification against the actual database before release.

Final inventory: **36 findings — 1 P0 release gate, 18 P1, 17 P2.** The most urgent are A01 (database privilege boundary), A02–A05 (data integrity/privacy), A27–A28 (safety gates), and A30–A33 (account confirmation/retry and incomplete AI actions). IDs are stable; later-confirmed findings are appended below rather than renumbering earlier evidence.

## Scope and evidence

Reviewed chat/tarot, journal, memory, follow-ups, authentication, migration, account controls, admin configuration, schema/RLS, accessibility, responsive layouts, dependencies, and operational readiness against the repository PRD and design guidance. Independent reviews were delegated with Luna/Max requested. Findings below distinguish browser reproduction, source evidence, and deployment-dependent risks.

The browser used the compiled production application at `127.0.0.1:3000`, with an initially empty guest store and synthetic QA content. Real configured AI calls were used for an initial conversation, title, journal assist, and clarification interpretation. A tarot recommendation fixture bypassed one stalled model request; the actual draw and clarification used the real server engine. A delayed journal response and an interpretation HTTP 503 were deliberately injected to test failure behavior. No real user account was created, no email sent, and no deployed account data was changed.

| Check | Result |
|---|---|
| Production build | Passed; 112 pages generated |
| Unit tests | 32 files, 242 tests passed |
| Type check | Passed after build completed |
| ESLint | Exit 0, 0 errors, 584 warnings, predominantly local tooling trees |
| Card dataset | 78 unique valid cards |
| Card files | 78 matching JPEGs; Sharp could parse every file |
| Production dependency audit | 3 affected packages: 1 high, 2 moderate; exploitability not established |
| Impeccable source detector | No findings; does not prove behavioral or accessibility correctness |
| Mobile layout | 13 routes at 390×844, five at 320×640; no observed horizontal overflow |
| Automated accessibility | Eight light-theme routes, four dark-theme routes, and a draw state; two verified issue types |
| Keyboard spot checks | Mobile navigation opens/closes with Escape; Explore arrow-key tabs work |

Production first-load estimates: `/reflect` 420 kB, `/settings` 365 kB, shared 145 kB. These are build outputs, not measured field performance or a Core Web Vitals pass.

## Prioritized findings

P0 means an urgent security/release gate; P1 means fix before launch; P2 means a meaningful defect or hardening task; P3 means polish. Severity is based on impact, not the number of lines changed. Database/account findings are source-verified unless explicitly described as browser-reproduced.

### A01 · P0 release gate · Migration RPC lacks a safe privilege boundary

**Evidence:** [0002_migrate_guest.sql:6](C:/dev/eclipsay/supabase/migrations/0002_migrate_guest.sql:6) creates a public `SECURITY DEFINER` function accepting `p_user_id`; line 21 only rejects null. No checked-in migration revokes public execution or enforces caller ownership. The route's authentication check does not protect direct RPC calls.

**Impact:** Under default function privileges and normal API exposure, a caller can select another existing user's ID and write records with the function owner's privileges, bypassing the intended route/RLS boundary. Live grants and exposed schemas were not inspected; this is a confirmed unsafe migration definition with deployment-dependent exploitability, not evidence of a breached database.

**Fix/acceptance:** Explicitly restrict execution to the intended server role, use a safe schema/search path, and enforce the intended identity contract. Test direct calls as anonymous, user A, user B, and the server role. PostgreSQL explicitly documents the need to revoke default public privileges on restricted security-definer functions: [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html).

### A02 · P1 · A late journal assist overwrites newer saved text

**Browser reproduced.** [journal-composer.tsx:182](C:/dev/eclipsay/src/components/journal/journal-composer.tsx:182) captures `entry`; [entries.ts:81](C:/dev/eclipsay/src/lib/journal/entries.ts:81) later upserts the entire old object with the new note. Save remains available while assist is pending.

**Reproduction:** Open a saved entry → start an assist → edit its body → Save → release the delayed assist response. Stored body changed from `QA important latest edit saved while AI is working.` back to `QA draft: taking a little time to draw today.`

**Impact:** Silent loss of explicitly saved user writing. The same full-object upsert can recreate a deleted entry if the response arrives after deletion; that variant was source-traced, not browser-tested.

**Fix/acceptance:** Append notes atomically without replacing body/title/tags; reject a deleted entry and prevent conflicting mutations. Test delayed completion after Save and Delete in both data modes.

### A03 · P1 · Account tarot and assistant data can enter guest storage

**Evidence:** [chat-screen.tsx:418](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:418) calls `ensureGuestSession` in account mode; [line 398](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:398) stores the draw locally; [line 145](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:145) appends assistant output unconditionally. `appendMessage` only writes if a guest row exists, which `beginReading` creates. Clarification also writes locally.

**Impact:** Account reading/assistant content survives in the guest store and can appear after sign-out or be offered for import into a different account on a shared browser.

**Fix/acceptance:** Gate every guest write on resolved guest mode; authenticated persistence must use the account path. Verify an account tarot conversation leaves no corresponding guest record before and after sign-out.

### A04 · P1 · Migration drops reminders and memory preferences

**Evidence:** [migration-dialog.tsx:32](C:/dev/eclipsay/src/components/auth/migration-dialog.tsx:32) serializes sessions, readings, messages, journal and memories only; [line 86](C:/dev/eclipsay/src/components/auth/migration-dialog.tsx:86) sends that reduced payload, then clears guest data. Neither profile preferences nor `followUps` are imported. Account memory defaults to enabled in [0001_init.sql:9](C:/dev/eclipsay/supabase/migrations/0001_init.sql:9).

**Impact:** Scheduled reminders disappear. A guest who turned memory off can have imported memories used under the account's enabled default. Reflection goal and tarot familiarity also disappear.

**Fix/acceptance:** Migrate these fields in the same transaction, deliberately reconcile existing account preferences, and compare all source/destination records before clearing local data. Test migration with memory disabled and a pending reminder.

### A05 · P1 · Clarification destroys the original recorded seed

**Browser reproduced.** [chat-screen.tsx:479](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:479) saves the expanded reading with `seed: 0` and a new creation time.

**Evidence:** Reading `e0c9dcfd-3391-491e-a23c-501dc2b7781e` initially had seed `481662461`, created `14:12:01Z`. After clarification it had seed `0`, created `14:12:59Z`. The original Two of Swords and new King of Pentacles remained visible.

**Impact:** Breaks the seeded reproducibility/history invariant, including exported or migrated records.

**Fix/acceptance:** Preserve the original seed and creation time when appending clarification cards. Verify initial draw → clarify → reload → export retains both values and all cards.

### A06 · P1 · Chat payload validation accepts malformed messages

**Browser reproduced.** [api/chat/route.ts:25](C:/dev/eclipsay/src/app/api/chat/route.ts:25) uses `z.custom<UIMessage>()` without a predicate. `{ "messages": [null] }` and `{ "messages": [{"role":"user"}] }` each returned an empty HTTP 500, rather than the documented 400 JSON error. The route dereferences fields before a protective validation boundary.

**Impact:** Untrusted clients can trigger uncaught server failures; message, part, text, and metadata sizes are also unbounded.

**Fix/acceptance:** Validate the actual supported message/part shape and enforce request, message count, text, metadata, and context budgets. Malformed input must return structured 400 errors without invoking providers.

### A07 · P1 · Anonymous AI usage has no repository-level rate or spend controls

**Evidence:** [api/chat/route.ts:59](C:/dev/eclipsay/src/app/api/chat/route.ts:59), [api/journal-assist/route.ts:23](C:/dev/eclipsay/src/app/api/journal-assist/route.ts:23), and [title/route.ts:26](C:/dev/eclipsay/src/app/api/sessions/[sessionId]/title/route.ts:26) permit guest generation without a visible rate/quota layer. External firewall/provider controls were not inspected.

**Impact:** Automated callers can exhaust provider quotas, budget, or service capacity.

**Fix/acceptance:** Establish anonymous session/IP limits, account quotas, request/context bounds, concurrency limits, and provider budget alerts. Test 429/retry UX and prove controls on the deployed environment.

### A08 · P1 · Account export can report success with incomplete data

**Evidence:** [settings-form.tsx:105](C:/dev/eclipsay/src/components/settings/settings-form.tsx:105) ignores six query errors and converts missing results to empty arrays; profiles/preferences are omitted. [Line 136](C:/dev/eclipsay/src/components/settings/settings-form.tsx:136) announces success unconditionally.

**Impact:** A user relying on the export before deletion may keep an incomplete backup without knowing it. Large datasets also require explicit pagination rather than relying on backend default row limits.

**Fix/acceptance:** Include the defined full export scope, paginate, reject partial failures, and label schema/version. Test a failed table read and a dataset larger than the configured API row limit.

### A09 · P1 · Account drafts lack the protection promised by the editor

**Evidence:** [journal-composer.tsx:118](C:/dev/eclipsay/src/components/journal/journal-composer.tsx:118) saves drafts only in guest mode; [line 203](C:/dev/eclipsay/src/components/journal/journal-composer.tsx:203) nevertheless says the draft is kept on the device. Guest drafts use [sessionStorage](C:/dev/eclipsay/src/lib/journal/drafts.ts:14), which does not provide durable cross-tab/session retention.

**Impact:** Account users can lose unsaved work after following the editor's exit message. Guest users may overestimate how long a locally saved draft survives.

**Fix/acceptance:** Define a privacy-conscious draft policy for both modes, scope drafts by user and entry, and make navigation/storage failures explicit. Test navigation, reload, tab close, sign-out, and failed Save.

### A10 · P1 · Production dependencies require advisory triage

**Evidence:** `npm audit --omit=dev --json` reports high-severity nested PostCSS through Next, moderate Next propagation, and moderate `qs` through the production dependency tree. See [raw audit](C:/dev/eclipsay/.playwright-mcp/npm-audit.json) and [verification notes](C:/dev/eclipsay/.playwright-mcp/verification-audit.md).

**Impact:** Known vulnerable code is installed; this does not establish remote exploitability in Eclipsay. In particular, attacker-controlled CSS/source-map processing and CLI-only dependencies require reachability analysis.

**Fix/acceptance:** Determine runtime/build exposure, update supported dependency chains, move development-only tooling out of production dependencies where appropriate, and rerun audit/build/tests. Do not blindly apply npm's suggested major framework upgrade.

### A11 · P2 · Closing migration can permanently strand guest data

**Evidence:** [migration-dialog.tsx:20](C:/dev/eclipsay/src/components/auth/migration-dialog.tsx:20) checks a single browser-wide prompt key; [line 25](C:/dev/eclipsay/src/components/auth/migration-dialog.tsx:25) sets it on X/Escape. There is no visible later import action.

**Impact:** Dismissing once suppresses import for later guest data and other accounts on the same browser.

**Fix/acceptance:** Separate temporary dismissal from completed migration, scope state appropriately, and expose an explicit import action in Settings. Test dismiss → sign out → create new guest data → sign in.

### A12 · P2 · Guest deletion leaves linked reminders behind

**Evidence:** [store.ts:190](C:/dev/eclipsay/src/lib/guest/store.ts:190) and [line 205](C:/dev/eclipsay/src/lib/guest/store.ts:205) delete entries/sessions without deleting linked follow-ups.

**Impact:** A deleted reflection can still produce a reminder that opens an empty/deleted session.

**Fix/acceptance:** Match intended account cascade behavior for guest records. Delete a session and an entry with pending reminders, then advance the due time and verify no stale banner appears.

### A13 · P2 · Read failures masquerade as empty or guest data

**Evidence:** [entries.ts:33](C:/dev/eclipsay/src/lib/journal/entries.ts:33) falls back to guest entries when an authenticated query has no data; [memory-view.tsx:40](C:/dev/eclipsay/src/components/memory/memory-view.tsx:40) ignores account read errors and defaults empty. [use-data-mode.ts:12](C:/dev/eclipsay/src/hooks/use-data-mode.ts:12) starts as guest before authentication resolves.

**Impact:** Outages can look like lost data or expose a misleading guest view. Users can begin editing while identity/data is still resolving.

**Fix/acceptance:** Use explicit unresolved/loading/error states and never infer guest mode from an account data-read failure. Test slow authentication and denied/offline queries.

### A14 · P2 · Delete/dismiss actions can announce success despite failure

**Evidence:** [settings-form.tsx:139](C:/dev/eclipsay/src/components/settings/settings-form.tsx:139) ignores delete results before saying history was cleared. [followup-banner.tsx:93](C:/dev/eclipsay/src/components/followups/followup-banner.tsx:93) resolves even for HTTP failure, and dismissal clears the banner anyway. Account deletion has no network-exception recovery/busy guard at [line 153](C:/dev/eclipsay/src/components/settings/settings-form.tsx:153).

**Impact:** History remains after a success message; reminders return unexpectedly; repeated clicks can race.

**Fix/acceptance:** Propagate success/failure explicitly, retain actionable UI after errors, and make multi-table deletion atomic. Fault-inject each request failure and verify truthful feedback.

### A15 · P2 · A stalled generation has no Stop or local timeout recovery

**Browser observed:** A one-card request remained at “Reflecting…” for several minutes. The Send button was disabled; there was no Stop action. [ai-chat-input.tsx:146](C:/dev/eclipsay/src/components/ui/ai-chat-input.tsx:146) only disables Send while busy. The route's `maxDuration = 60` is not a local request abort mechanism.

**Impact:** A provider stall locks the conversation until navigation/reload. Hosting timeout behavior may differ from this local production run.

**Fix/acceptance:** Provide Stop, an explicit timeout/retry state, cancellation propagation, and preserved partial/user content. Test a never-resolving provider and navigation during streaming.

### A16 · P2 · Interpretation failure recovery disappears after reload

**Browser reproduced:** After a real card draw, a simulated interpretation 503 correctly showed Try again / Continue writing. Reload preserved the cards but removed the error/retry state, leaving an uninterpreted reading without its recovery action.

**Evidence:** [chat-screen.tsx:851](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:851) renders recovery from transient chat error state.

**Fix/acceptance:** Persist pending/failed generation state or derive an unanswered request on hydration. Verify reload after a failed interpretation preserves a clear retry path without redrawing.

### A17 · P2 · Child record ownership is not enforced by relationships

**Evidence:** [0001_init.sql:31](C:/dev/eclipsay/supabase/migrations/0001_init.sql:31) and [line 65](C:/dev/eclipsay/supabase/migrations/0001_init.sql:65) use separate owner and parent FKs. [api/followups/route.ts:33](C:/dev/eclipsay/src/app/api/followups/route.ts:33), [draw-service.ts:40](C:/dev/eclipsay/src/lib/tarot/draw-service.ts:40), and insight insertion do not establish parent ownership.

**Impact:** With a known foreign UUID, a caller can create a record owned by themselves but linked to another owner's record; RLS on the child's owner alone does not enforce relational consistency. This does not establish a cross-user read leak.

**Fix/acceptance:** Add ownership checks/composite constraints and test user A references user B's session/entry.

### A18 · P2 · Analytics retention and validation do not match the privacy contract

**Evidence:** [api/events/route.ts:14](C:/dev/eclipsay/src/app/api/events/route.ts:14) accepts arbitrary event names and metadata objects. [0001_init.sql:75](C:/dev/eclipsay/supabase/migrations/0001_init.sql:75) retains events with a null user ID after account deletion, while the UI promises deletion of all account data.

**Impact:** The runtime does not enforce metadata-only approved fields; accidental content can be retained. No actual private-text analytics event was observed.

**Fix/acceptance:** Validate event names and per-event metadata, bound sizes, and define a retention/deletion policy consistent with the UI. Test prohibited fields and deletion behavior.

### A19 · P2 · Guest storage failures are not recoverable consistently

**Evidence:** [store.ts:57](C:/dev/eclipsay/src/lib/guest/store.ts:57) accesses localStorage without guarding availability; [line 63](C:/dev/eclipsay/src/lib/guest/store.ts:63) trusts parsed collection shapes; [line 91](C:/dev/eclipsay/src/lib/guest/store.ts:91) writes without handling quota errors.

**Impact:** Storage denial, corrupt records, or a full browser store can throw out of chat/onboarding actions rather than preserving input and presenting a recovery path.

**Fix/acceptance:** Validate stored data, distinguish unavailable/corrupt/full states, and preserve unsaved text. Test injected SecurityError and QuotaExceededError without discarding valid data.

### A20 · P2 · Journal editing can start before the requested entry loads

**Evidence:** [journal-composer.tsx:59](C:/dev/eclipsay/src/components/journal/journal-composer.tsx:59) asynchronously loads an edit target, while the form remains usable. A missing entry resolves to null; Save then calls `makeEntry` at [line 146](C:/dev/eclipsay/src/components/journal/journal-composer.tsx:146).

**Impact:** Late hydration can overwrite typing; a stale edit link silently creates a new entry instead of explaining that the original is missing.

**Fix/acceptance:** Gate editing until loaded, present not-found/load-error states, and test delayed reads and invalid IDs.

### A21 · P2 · Tarot entry links lose user intent

**Evidence:** [journal-composer.tsx:299](C:/dev/eclipsay/src/components/journal/journal-composer.tsx:299) sends `tarot=1` plus `prefill`; [chat-screen.tsx:214](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:214) gives prefill priority and drops the tarot starter. Every [SpreadCard link](C:/dev/eclipsay/src/components/explore/explore-view.tsx:36) points to the same generic tarot URL.

**Impact:** “Reflect with tarot” can become plain journal text, and choosing a particular spread does not carry that spread into the conversation.

**Fix/acceptance:** Carry structured intent and the selected spread into the next surface, preserving user control over sending. Test each source CTA independently.

### A22 · P2 · Journal dates merge entries across different years

**Evidence:** [journal-view.tsx:20](C:/dev/eclipsay/src/components/journal/journal-view.tsx:20) formats month/day only and [line 32](C:/dev/eclipsay/src/components/journal/journal-view.tsx:32) uses that label as the group key.

**Impact:** September 6 in different years is grouped together, breaking chronological history as usage accumulates.

**Fix/acceptance:** Group by a full local calendar date, with an explicit display year when needed. Test two years and timezone boundaries.

### A23 · P2 · Save-to-journal repeats and can create duplicate captures

**Browser observed:** A guest save displayed duplicate success toasts. After reload the same assistant message was actionable again.

**Evidence:** [chat-screen.tsx:531](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:531) calls the guest success toast then an unconditional success toast; [line 542](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:542) tracks saved messages only in component state, without a pending lock or stable persisted capture key.

**Fix/acceptance:** One success notification; persist/idempotently identify captures and disable while saving. Test double-click and reload/re-save.

### A24 · P2 · Active Explore filter fails text contrast

**Browser/axe reproduced:** [explore-view.tsx:112](C:/dev/eclipsay/src/components/explore/explore-view.tsx:112) renders active All at **4.38:1**, foreground `#95613c` on `#f2ebe3`, 12px normal text. Required normal-text contrast is 4.5:1. Dark-theme equivalent passed this check.

**Fix/acceptance:** Adjust the active foreground/background tokens and remeasure all filter states. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

### A25 · P2 · Signup inline link relies only on color

**Browser/axe reproduced:** [signup-form.tsx:221](C:/dev/eclipsay/src/components/auth/signup-form.tsx:221) gives the Log in link hover-only underlining. Link/surrounding-text contrast is 1.16:1 in light mode and 1.1:1 in dark mode.

**Fix/acceptance:** Underline it in its resting state or provide another non-color distinction; recheck both themes and focus state. This is an accessibility release task despite its small implementation size.

### A26 · P2 · Release observability and automated gates are incomplete

**Evidence:** No checked-in CI workflow or product error boundary was found. [next.config.ts:3](C:/dev/eclipsay/next.config.ts:3) defines no header policy, and local production responses lacked CSP/frame/nosniff/referrer policy headers. Actual hosting headers and monitoring were not inspected. Lint passes with 584 warnings from local tooling directories.

**Impact:** Regressions can merge without checks; client failures may fall through to generic framework errors; no demonstrated production alert/recovery workflow exists.

**Fix/acceptance:** Add a reproducible CI gate for tests/types/lint/build/cards, focused browser regressions, application error recovery, redacted monitoring, and documented deploy/rollback checks. Verify security headers at the actual deployment boundary; do not treat a missing development header as proof of production exposure.

### A27 · P1 · Client-supplied metadata can bypass the application safety gate

**Source verified:** [api/chat/route.ts:77](C:/dev/eclipsay/src/app/api/chat/route.ts:77) excludes messages identified as system notices before classification. [convert.ts:49](C:/dev/eclipsay/src/lib/chat/convert.ts:49) treats user metadata containing any `readingId` or `clarify` as a notice. The metadata is client-controlled and not verified against a server-issued event.

**Impact:** High-stakes/crisis user text tagged with arbitrary reading metadata is omitted from application classification, leaving tarot tools available when they should be disabled. This establishes a gate bypass, not evidence that a provider actually returned harmful guidance.

**Fix/acceptance:** Classify user text independently of untrusted metadata. Validate app event shape, reading ownership and server-produced content. Test forged reading/clarification metadata on high-stakes text without calling a live model.

### A28 · P1 · Required multilingual and common high-stakes requests miss classification

**Executed classifier evidence:** [safety.ts:13](C:/dev/eclipsay/src/lib/ai/safety.ts:13) returned `{highStakes:false, crisis:false}` for `saya ingin bunuh diri`, `Should I stop taking my medication?`, `Should I invest all my savings in this stock?`, and `Will I die tomorrow?`. The English direct self-harm control returned both flags true.

**Impact:** The PRD's multilingual/safety behavior is not enforced for these direct examples. Model safety may provide additional protection, but the application's tarot gate cannot rely on it.

**Fix/acceptance:** Expand and evaluate conservative multilingual/high-stakes classification, including indirect language and uncertainty. Add a representative supported-language test corpus and verify both tool removal and grounded response instructions.

### A29 · P1 · Sticky safety state is not passed into response instructions

**Evidence:** [api/chat/route.ts:101](C:/dev/eclipsay/src/app/api/chat/route.ts:101) computes sticky session safety, but [line 217](C:/dev/eclipsay/src/app/api/chat/route.ts:217) passes only `currentSafety` into the system prompt. [system-prompt.ts:124](C:/dev/eclipsay/src/lib/ai/system-prompt.ts:124) conditionally adds specific medical/legal/financial/crisis rules from that narrower value.

**Impact:** A neutral follow-up after high-stakes content keeps tarot disabled but loses the explicit high-stakes/crisis instruction section intended for later replies.

**Fix/acceptance:** Apply the intended session-level safety policy consistently to tools, prompt and UI. Test high-stakes → neutral follow-up and crisis → neutral follow-up, including reload.

### A30 · P1 · Insight confirmation claims Saved before persistence succeeds

**Evidence:** [tool-parts.tsx:203](C:/dev/eclipsay/src/components/chat/tool-parts.tsx:203) marks the action resolved before invoking an asynchronous save. [chat-screen.tsx:523](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:523) can report failure, but the confirmation callback does not await its result.

**Impact:** An account HTTP save failure leaves the proposal labeled Saved and disabled although no journal entry exists.

**Fix/acceptance:** Await a success result before marking the proposal resolved; retain retry on failure and prevent duplicate submission. Test HTTP errors and network rejection for the confirmation card, not only the manual save button.

### A31 · P1 · Account confirmations are not persisted across reload

**Evidence:** [chat-screen.tsx:501](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:501) persists acted/declined metadata only for guests. Account history restores tool payloads without those decisions.

**Impact:** Insight/memory proposals can become actionable again after reload and write duplicates; dismissed choices are not durably respected. The temporary guest hydration flash observed during browser inspection is not evidence of this account defect; its basis is the account source path.

**Fix/acceptance:** Persist account action state using stable message/action identifiers and idempotent writes. Verify confirm/decline → reload remains settled.

### A32 · P1 · Account retries duplicate the user turn

**Evidence:** [api/chat/route.ts:179](C:/dev/eclipsay/src/app/api/chat/route.ts:179) inserts the last user message on every request without its stable client ID. [chat-screen.tsx:858](C:/dev/eclipsay/src/components/chat/chat-screen.tsx:858) invokes regeneration with the existing transcript.

**Impact:** Retry after a failed generation appends the same user content again to account history. Stable optimistic/server identifiers and request idempotency are absent.

**Fix/acceptance:** Persist a user turn once by stable client ID, distinguish submission from regeneration, and define retry replacement behavior. Test repeated failed/successful regeneration followed by history reload.

### A33 · P1 · AI follow-up proposal has no usable confirmation path

**Evidence:** [tools.ts:176](C:/dev/eclipsay/src/lib/ai/tools.ts:176) exposes `create_followup`, returning only a proposal. [tool-parts.tsx:345](C:/dev/eclipsay/src/components/chat/tool-parts.tsx:345) has no corresponding case; it renders “Preparing something…” indefinitely.

**Impact:** The model can suggest a scheduled follow-up, but the user cannot confirm it and nothing is scheduled. The separate manual Check in button works, which can hide this missing conversation path during basic testing.

**Fix/acceptance:** Add a real confirm card with validated due date and persistence, or remove the tool until supported. Test completed tool output, confirm, decline, failed save and reload.

### A34 · P1 · Model-invoked guest clarification lacks the existing deck

**Evidence:** [tools.ts:99](C:/dev/eclipsay/src/lib/ai/tools.ts:99) executes `clarifyReading` with `alreadyDrawn: []`. [draw-service.ts:63](C:/dev/eclipsay/src/lib/tarot/draw-service.ts:63) can obtain existing cards from account storage, but has no such lookup for guests.

**Impact:** This tool path can select a card already present in the guest reading because its exclusion set is empty. It also performs a draw as a model tool rather than a purely proposed action. Card identity still comes from the engine; the defect is missing prior-deck/confirmation context, not LLM-invented card identities.

**Fix/acceptance:** Route clarification through the explicit app action with validated current reading context, or define a supported tool contract that preserves consent and the exclusion set. Test every clarification path against duplicate cards.

### A35 · P1 · Direct-provider-only setup falls back to unconfigured OpenRouter

**Evidence:** [runtime-config.ts:30](C:/dev/eclipsay/src/lib/ai/runtime-config.ts:30) always defaults both slots to OpenRouter. [provider.ts:47](C:/dev/eclipsay/src/lib/ai/provider.ts:47) considers AI configured if any provider has a key; [line 115](C:/dev/eclipsay/src/lib/ai/provider.ts:115) resolves the runtime slot against a registry containing only configured providers.

**Impact:** With only a direct provider key and no valid DB configuration, AI surfaces pass the environment guard but fail model resolution. A removed provider key can likewise invalidate a persisted slot.

**Fix/acceptance:** Define an explicit usable default for the configured provider set or fail setup with an actionable configuration message; validate persisted slots after key changes. Test each single-provider environment and stale config without exposing secrets.

### A36 · P2 · Guest access does not establish age-aware behavior

**Evidence:** [onboarding-dialogs.tsx:26](C:/dev/eclipsay/src/components/chat/onboarding-dialogs.tsx:26) asks only optional preferences; guest mode is immediately usable. [api/chat/route.ts:223](C:/dev/eclipsay/src/app/api/chat/route.ts:223) derives teen behavior from an account profile, which guests lack.

**Impact:** The 13+ product requirement and conservative 13–17 behavior have no explicit guest implementation. This is a product-policy gap, not a legal-compliance conclusion.

**Fix/acceptance:** Choose a proportionate guest eligibility/teen policy without collecting unnecessary personal information. Verify underage, teen, adult and unspecified cases against the PRD.

## UI/UX assessment

**Implementation integrity: visual pass, production-behavior fail.** The warm palette, restrained typography, mobile drawer, and scoped tarot treatment form a coherent product. A visual redesign is not the primary need. Truthful status feedback, reliable capture, and continuity across modes are the priority.

| Dimension | Provisional score | Evidence and limitation |
|---|---:|---|
| Accessibility | 2/4 | Labels, tabs and dialogs show deliberate work; two automated violations; full screen-reader review remains |
| Performance | 2/4 | Optimized build and valid assets; 420 kB chat first load; no field metrics/throttled-device benchmark |
| Responsive design | 3/4 | No observed overflow at tested widths; real iOS keyboard and zoom remain untested |
| Theming | 3/4 | Coherent light/dark tokens; active light filter contrast needs adjustment |
| Implementation integrity | 2/4 | Distinct product system; misleading success/draft states and dropped navigation intent |
| Total | **12/20** | Significant work needed; heuristic score, not certification |

Mobile controls are often compact (roughly 26–32px). Prefer comfortable touch areas when fixing these surfaces, but do not label every control below 44px a WCAG AA violation: WCAG 2.2 AA uses 24px with spacing/other exceptions. [Target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Secondary improvements: preserve destination through password recovery; provide a visible password-toggle focus indicator; stop offering dead signup actions in intentionally unconfigured deployments; align guest preference controls with onboarding; use motion-reduction variants for hover transforms. These are not reasons to replace the current visual identity.

## What worked

- Landing entry paths and mobile app navigation loaded successfully from the production build.
- Real guest chat generated a reply and a readable session title.
- Explicit insight capture, freeform journal save/reopen, and manual memory save survived reload.
- Guest draft survived within-tab navigation in the tested case.
- Real server draw produced a persisted seed/card; reload before clarification retained the reading.
- Clarification produced a real additional card and an interpretation; the separate seed mutation defect is A05.
- A failed interpretation displayed useful immediate recovery actions.
- Reduced-motion drawing completed; mobile navigation Escape and Explore arrow-key tabs worked.
- Reminder scheduling persisted; a controlled due reminder appeared, and Later remained snoozed after reload.
- Dataset and image completeness checks passed; reviewed card-art surfaces include attribution.

## Coverage remaining before sign-off

| Area | Required staging verification |
|---|---|
| Authentication | Signup/verification, Google OAuth, recovery email, expired links, sign-out, destination continuity, under-13 and teen behavior |
| Account CRUD | Real RLS reads/writes, retries, failures, concurrent tabs, history reload and deletion |
| Migration | Actual RPC grants; all records/preferences; existing-account merge; failure/rollback; retry; data created while import is running |
| Account data controls | Full paginated export, interrupted export, deletion cascades, analytics retention, backups |
| Admin AI | Non-admin denial, provider-key absence, invalid/catalog-stale model, persistence/cache refresh, reasoning behavior per configured provider |
| AI reliability/safety | Slow/failed/malformed provider responses; multilingual and indirect high-stakes expressions; teen policy; long sessions/context limits; prompt/tool tampering |
| Accessibility | Screen reader, keyboard-only full journey, zoom/reflow, forced colors, real mobile virtual keyboard |
| Production operations | HTTPS/header policies, rate limits, secrets handling, redacted logs, uptime/error alerts, backup/restore and rollback drill |

Tests passing is not evidence that these staging conditions pass. The audit did not perform a destructive live security test or a formal compliance assessment.

## Recommended implementation order

1. Close A01's database privilege boundary and prove denial tests. Fix A02–A05 data loss/isolation/migration integrity and A27–A29 safety gate/instruction defects.
2. Add request/spend controls and dependency remediation; fix export/draft contracts.
3. Fix A30–A35 confirmation, account retry, incomplete tool and provider-configuration paths. Add account/guest failure-state regressions, persisted recovery, deletion consistency, and intent-preserving navigation.
4. Use `$impeccable harden` for error/loading/draft UX, `$impeccable clarify` for truthful labels, `$impeccable adapt` for touch ergonomics, then `$impeccable polish` after functional fixes.
5. Rerun this audit's reproductions and complete the staging matrix before release approval.

The UI commands can be run separately or together; rerun `$impeccable audit` after fixes. No fixes or deployment were performed during this audit.

## Evidence files

- [Verification details](C:/dev/eclipsay/.playwright-mcp/verification-audit.md)
- [Dependency audit JSON](C:/dev/eclipsay/.playwright-mcp/npm-audit.json)
- [Impeccable detector JSON](C:/dev/eclipsay/.playwright-mcp/impeccable-audit.json)
- [Mobile reflection](C:/dev/eclipsay/.playwright-mcp/audit-mobile-reflect.png)
- [Mobile memory](C:/dev/eclipsay/.playwright-mcp/audit-mobile-memory.png)
- [Mobile signup](C:/dev/eclipsay/.playwright-mcp/audit-mobile-signup.png)
- [Stalled request](C:/dev/eclipsay/.playwright-mcp/audit-tarot-pending.png)
- [Interpretation error](C:/dev/eclipsay/.playwright-mcp/audit-mobile-reading-error.png)
