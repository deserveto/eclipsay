# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the **Reflective Explorer** (PRD §5) — someone trying to understand themselves (relationships, work, identity, decisions, growth). Usually little or no tarot knowledge; does not necessarily believe tarot predicts the future. Wants perspective, structure, a safe place to think, interesting prompts, continuity, and a way to capture meaningful thoughts. General audience, ages 13+.

Secondary personas (PRD §6): casual tarot user, tarot enthusiast, existing journaler, physical tarot user (manual card input is post-MVP; camera recognition is not in MVP).

## Product Purpose

A private, chat-first AI reflection companion (PRD §79): users talk through what is on their mind, optionally draw Rider–Waite–Smith tarot as reflective prompts, capture meaningful insights into a personal journal, intentionally build explicit AI memory, and revisit their thinking over time via scheduled follow-ups.

Success means the core loop creates repeated usage: **Express → Explore → Reframe → Capture → Revisit** (PRD §80). Tarot supports Reframe; AI supports Explore; Journal supports Capture; History and follow-ups support Revisit. A first-time user sees "an AI that can help me reflect using tarot"; a returning user sees "the place where I understand and keep track of my thoughts, readings, patterns, and personal growth" (PRD §2).

## Positioning

**"A reflection companion that happens to use tarot extremely well" — never "a tarot generator with an AI chat box attached"** (PRD §78). Every feature decision passes the test: does it help the user understand themselves, capture something meaningful, or revisit their perspective later?

The mechanism neighboring products cannot truthfully copy: one continuous personal reflection system that connects conversation, seeded-deterministic tarot, a curated journal, explicit user-approved memory, and follow-ups — with guest-first privacy (nothing leaves the browser until the user migrates). Generic chatbots have no reflection framework; tarot apps are one-off fortune-telling; journaling apps have blank-page friction and no continuity (PRD §3).

## Operating Context

- Primary surfaces (PRD §10): New Reflection (chat-first home), Recent/History, Journal (timeline + freeform + AI-assisted), Explore (78-card library with card details), Memory (explicit, user-managed), Settings (privacy, data controls, data states).
- Core behavioral loop (PRD §7): Talk → Understand → Reflect → Optionally Draw → Interpret → Capture Insight → Journal → Revisit.
- Tarot interaction (PRD §28–§32): Quick Draw or Interactive Draw, face-down reveal ceremony, clarification cards, AI-suggested spreads from a fixed library (one card; three-card reflection; past/present/future; situation/challenge/guidance; relationship reflection; decision reflection).
- Four distinct data states, never treated as equivalent (PRD §57): Stored (history) / Journaled (intentional) / Remembered (explicitly approved for AI) / In Context (sent for the active response).
- Three levels of intentionality: History → Journal → Memory (PRD §40).
- `docs/PRD.md` (§1–§80) is the behavioral authority; code comments cite its section numbers.

## Capabilities and Constraints

- **Guest-first**: full value with no account; all data in versioned browser localStorage (`eclipsay.guest.v1`) until an explicit one-transaction migration to a Supabase account (RLS). Guest data is never uploaded uninvited; local records survive migration failure (PRD §11, §13, §64).
- **LLM never selects or invents tarot cards.** Card identities and orientations come from a pure, seeded, deterministic engine; a drawn reading is reproducible and hydrates verbatim — never re-drawn (PRD §22, §25, §26). Deck is the complete 78-card RWS structure; duplicate cards cannot repeat within one draw.
- **Propose-then-confirm** (PRD §4.2, §62): AI proposes insights, memories, follow-ups, and spread suggestions as payloads; UI renders confirm cards; nothing is written without explicit user action. Users can skip tarot, reject interpretations, reinterpret cards, decline memory, dismiss follow-ups, delete content.
- **Safety gating** (PRD §53–§55): crisis/high-stakes topics (medical, legal, financial, suicide/self-harm, death predictions) remove tarot tools and inject crisis resources; teens 13–17 get more conservative behavior; no emotional-dependency framing ("you only need me" is banned).
- **Explicit memory only** (PRD §41–§44): long-term memory is opt-in per item, master-toggleable, and kept conceptually distinct from journal retrieval (titles only until the user approves "Bring it in").
- **User voice over AI voice** (PRD §38): AI assists the journal but never rewrites the user's body text.
- **Analytics** (PRD §68): named events + metadata only; raw reflection/journal text never enters analytics.
- **Business model**: completely free (PRD §1). English-first UI (PRD §19).
- **Provider decoupling** (PRD §61): LLM access via OpenRouter through the Vercel AI SDK; product logic must not deeply couple to one vendor.
- **Deliberately out of MVP / undecided** (PRD §8, §72, §77): semantic journal search, monthly reflection summaries, multiple decks, physical card input, camera recognition, voice reflection, custom spread builder.

## Brand Commitments

- **Name**: Eclipsay — binding. Currently a text wordmark in the app shell and page titles (`Eclipsay` / `%s · Eclipsay`); no logo or wordmark asset exists yet, and that is a deliberate open decision, not an omission.
- **Voice**: warm, thoughtful, curious, calm, non-judgmental; "lightly mystical only when tarot is actually in play; otherwise grounded and contemporary." Never a clinical-therapist impersonation, a fortune teller claiming certainty, artificially cheerful, preachy, or a vending machine for disclaimers (companion system prompt; PRD §16, §18).
- **UX direction** (PRD §67): calm, intimate, reflective, contemporary, spacious, warm, trustworthy. Avoid stereotypical tarot design: excessive purple gradients, gold borders everywhere, stars on every component, gothic typography, mystical clutter. Mystical elements appear primarily during tarot interactions; the base application feels like a modern reflection product.
- **Artwork attribution**: every surface showing card art carries "Pamela Colman Smith (1909), public domain" (PRD §27).

## Evidence on Hand

- `docs/PRD.md` — behavioral authority, 80 sections, cited by code comments.
- 78 RWS card images at `public/cards/rws/<card-id>.jpg`, gated by `npm run validate:cards` (78 unique; 22 majors + 14×4 minors; non-empty fields).
- Runnable Next.js 15 App Router app (TypeScript strict): `npm run dev` on port 3000; runs guest-only without any credentials via env guards.
- **Pre-launch**: no testimonials, user quotes, metrics, press, case studies, or brand kit beyond the text wordmark. Future work must not fabricate any of these.

## Product Principles

1. **Reflection before prediction.** Cards are symbolic prompts for exploring perspectives, never deterministic evidence of outcomes (PRD §4.1).
2. **User agency over AI guidance.** The AI may guide but never dominates; every persistence is an explicit user act (PRD §4.2, §62).
3. **Private by default, intentional by design.** Reflection data is highly personal; nothing leaves the browser or enters AI context without consent (PRD §4.3, §56).
4. **User voice over AI voice.** The journal represents the user's own thinking; AI assists rather than authors (PRD §4.4).
5. **Value compounds over time.** Previous reflections, recurring themes, saved insights, tarot patterns, intentional memory, and follow-ups make the product more useful as meaningful history accumulates (PRD §4.5).

## Accessibility & Inclusion

Keyboard-accessible navigation; sufficient text contrast; readable font sizing; semantic buttons; accessible card names; alt text for card images (`"<name>, <orientation>"`); `prefers-reduced-motion` respected (tarot flip reveals render instantly); no information conveyed solely through color; responsive on desktop, tablet, and mobile with conversation-first mobile navigation — never a shrunken desktop sidebar (PRD §65–§66). Minimum age 13+, with teen-conservative behavior for 13–17 (PRD §52–§53). The companion stays warm without positioning itself as a replacement for human relationships (PRD §54).
