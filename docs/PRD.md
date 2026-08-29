# Product Requirements Document — AI Tarot Reflection Companion

## 1. Document Overview

**Product Type:** AI-powered self-reflection and journaling web application  
**Platform:** Web  
**MVP Business Model:** Completely free  
**Primary Interface:** Conversational AI / chat-first experience  
**Primary Audience:** General audience, ages 13+  
**Primary Persona:** Reflective Explorer  
**Tarot System:** Rider–Waite–Smith, 78-card deck  
**Primary Product Positioning:** Self-reflection and journaling companion using conversation and tarot as reflective tools

---

# 2. Product Vision

Build an AI-powered personal reflection companion that helps people understand their thoughts, emotions, decisions, relationships, and recurring patterns through conversation, tarot, and journaling.

The application should feel as easy to use as ChatGPT, Gemini, or similar conversational products, but instead of being a general-purpose assistant, it is designed specifically around introspection.

Tarot is not positioned as an unquestionable predictor of the future.

Instead, cards act as symbolic prompts that help users explore perspectives they may not have considered.

The product should gradually become more valuable as the user uses it over time.

A first-time user may initially see it as:

> “An AI that can help me reflect using tarot.”

A returning user should eventually see it as:

> “The place where I understand and keep track of my thoughts, readings, patterns, and personal growth.”

### Product Vision Statement

> **An AI-powered reflection companion that uses conversation, tarot, and journaling to help people understand themselves over time.**

### Short Positioning Statement

> **Reflect through conversation, tarot, and journaling.**

---

# 3. Problem Statement

People often have thoughts or emotions that they want to explore but do not necessarily know how to structure.

Traditional journaling can help, but it presents a blank-page problem.

AI chatbots reduce this friction through conversation, but generic assistants do not provide a purpose-built framework for long-term reflection.

Tarot provides a powerful symbolic structure for introspection, but existing tarot applications commonly focus on:

- fortune telling;
- generic card definitions;
- one-off readings;
- predetermined spreads;
- static AI-generated interpretations.

Most do not create meaningful continuity between:

- conversations;
- tarot readings;
- journal entries;
- personal insights;
- recurring themes;
- future reflections.

The product aims to connect these experiences into one continuous personal reflection system.

---

# 4. Product Philosophy

The product follows five fundamental principles.

## 4.1 Reflection Before Prediction

Tarot should help users explore possibilities and perspectives.

The system must avoid presenting cards as deterministic evidence of future outcomes.

Bad:

> “This relationship will end.”

Preferred:

> “The Tower may point toward instability, a significant change, or something that can no longer continue in its current form.”

---

## 4.2 User Agency

The AI may guide but must not dominate the reflection process.

Users must always be able to:

- continue talking without tarot;
- skip tarot suggestions;
- reject an interpretation;
- reinterpret cards;
- decline journaling;
- decline memory;
- dismiss follow-ups;
- delete stored content.

---

## 4.3 Private by Default

Reflection data may contain highly personal information.

Therefore:

> **Private by default, intentional by design.**

History, journal entries, memories, and reflections are private unless explicitly exported or shared by the user.

---

## 4.4 User Voice Over AI Voice

The journal should primarily represent the user's own thoughts.

AI should assist with reflection rather than replacing the user as the author of their personal journal.

---

## 4.5 Value Increases Over Time

The product should become more useful as meaningful history accumulates.

The long-term product value comes from:

- previous reflections;
- recurring themes;
- saved insights;
- tarot patterns;
- journal history;
- intentional memory;
- follow-up reflections.

---

# 5. Target Users

## 5.1 Primary Persona — Reflective Explorer

The primary user is someone interested in understanding themselves.

They may be thinking about:

- relationships;
- uncertainty;
- work;
- career;
- identity;
- emotional situations;
- difficult decisions;
- personal growth;
- changing life circumstances.

They may have little or no previous knowledge of tarot.

They do not necessarily believe tarot literally predicts the future.

What they want is:

- perspective;
- structure;
- a safe place to think;
- interesting prompts;
- continuity;
- a way to capture meaningful thoughts.

### Example

A user may arrive saying:

> “I don't know whether I'm actually unhappy at work or just exhausted.”

The product should help them unpack the situation conversationally before optionally introducing tarot as another reflective lens.

---

# 6. Secondary Personas

## 6.1 Casual Tarot User

Interested in tarot but not deeply knowledgeable.

Needs:

- simple spreads;
- card explanations;
- visual readings;
- approachable interpretation.

---

## 6.2 Tarot Enthusiast

Already understands tarot terminology and common card meanings.

Needs:

- less over-explanation;
- meaningful card interactions;
- clarification cards;
- different spread structures;
- historical readings;
- journaling.

---

## 6.3 Existing Journaler

Already enjoys journaling but struggles with:

- finding prompts;
- exploring topics deeply;
- seeing recurring patterns.

Tarot becomes an optional reflection mechanism rather than the primary attraction.

---

## 6.4 Physical Tarot User

Draws cards outside the application and may eventually want AI-assisted interpretation.

Manual card input is desirable after the MVP or if scope permits.

Camera-based card recognition is not part of MVP.

---

# 7. MVP Goals

The MVP must test whether the core behavioral loop provides enough value to create repeated usage.

The primary loop is:

> **Talk → Understand → Reflect → Optionally Draw → Interpret → Capture Insight → Journal → Revisit**

The MVP should validate:

1. Whether users engage in reflection conversations.
2. Whether users use tarot as part of those conversations.
3. Whether users save meaningful content.
4. Whether users return to previous reflections.
5. Whether journal/history continuity creates retention.
6. Whether users value guided reflection enough to return.

---

# 8. MVP Non-Goals

The MVP does not need:

- subscriptions;
- payments;
- premium tiers;
- multiple tarot decks;
- custom artwork decks;
- tarot marketplace;
- voice mode;
- audio journaling;
- native mobile apps;
- social network;
- public profiles;
- public tarot feeds;
- community readings;
- creator marketplace;
- camera tarot recognition;
- advanced analytics dashboards;
- complex gamification;
- streak pressure;
- AI-generated monthly psychological reports;
- custom spread builder;
- professional tarot reader marketplace.

Architecture should avoid making these impossible later, but they should not influence MVP complexity unnecessarily.

---

# 9. Core Product Pillars

The product is built around four core pillars.

## 9.1 Conversation

The primary interface.

Users can begin by simply describing what is on their mind.

No tarot knowledge is required.

---

## 9.2 Tarot Reflection

Tarot is a reflective tool available inside conversations.

AI can suggest tarot when useful, but tarot is never mandatory.

---

## 9.3 Journal

Users intentionally save thoughts, readings, insights, and reflections that matter to them.

---

## 9.4 Personal Continuity

History, explicit memories, and previous journal entries provide continuity between sessions without making the AI feel invasive.

---

# 10. Information Architecture

Primary navigation:

```text
New Reflection

Recent
 ├─ Reflection Session
 ├─ Reflection Session
 └─ Reflection Session

────────────────

Journal
Explore
Memory

────────────────

Profile
Settings
```

## Main destinations

### New Reflection

Primary chat experience.

### Recent / History

Automatically stored reflection conversations.

### Journal

Curated reflections and user-written entries.

### Explore

Contains:

- Card Library;
- Spread Library.

### Memory

Shows information the user has explicitly allowed the companion to remember.

### Settings

Includes:

- profile;
- privacy;
- data controls;
- tarot familiarity;
- AI preferences;
- account actions.

---

# 11. First-Run Experience

## 11.1 Guest-First Access

Users should not need an account before receiving value.

Landing experience:

> **What's on your mind?**

Possible entry actions:

- Talk something through
- Reflect with tarot
- Write privately

A guest may immediately start a reflection.

---

# 12. Micro Onboarding

Before or during the first session, the application may ask no more than two optional onboarding questions.

Every question must include **Skip**.

## Question 1 — Reflection Goal

Example:

> What would you like this space to help you with?

Possible answers:

- Understand my feelings
- Think through decisions
- Relationships
- Personal growth
- Just exploring

This is preference information rather than a permanent psychological label.

---

## Question 2 — Tarot Familiarity

> How familiar are you with tarot?

Options:

- New to tarot
- A little familiar
- Very familiar

This determines interpretation detail.

### Beginner

Explain traditional meaning and terminology.

### Intermediate

Moderate explanation.

### Experienced

Avoid repeatedly explaining basic card definitions unless relevant.

---

# 13. Guest Data Model

Guest activity should be stored locally in the browser.

Examples:

- conversation sessions;
- drawn cards;
- session metadata;
- temporary journal drafts;
- saved guest insights.

Guest data must not automatically be uploaded to the server.

When the user creates an account:

> **Bring your existing reflections with you?**

Options:

- Import reflections
- Start fresh

If imported, local guest records are migrated to the user's account.

Users should also have:

> **Clear guest data**

---

# 14. Authentication

Authentication is required for persistent cloud functionality.

Account benefits include:

- cloud history;
- journal;
- memory;
- cross-session continuity;
- check-ins;
- search;
- cross-device access.

Authentication should be presented as a value moment rather than a barrier.

Example trigger:

User chooses:

> Save to Journal

Then:

> **Create an account to keep this reflection.**

---

# 15. Main Reflection Interface

The default logged-in home screen is the conversational reflection interface.

It should resemble modern AI applications in usability without visually copying any single competitor.

Layout:

```text
┌──────── Sidebar ────────┐
│ New Reflection          │
│ Recent Sessions         │
│                        │
│ Journal                 │
│ Explore                 │
│ Memory                  │
└─────────────────────────┘

         Conversation

AI message
User message
Tarot interaction
AI reflection

──────────────────────────
 What’s on your mind?
──────────────────────────
```

The interface should remain calm and readable.

Tarot visuals should become prominent when a reading occurs without permanently dominating the chat interface.

---

# 16. Guided Companion Behavior

The default AI behavior is **Guided Companion**.

The AI should:

- listen first;
- identify what the user is trying to explore;
- ask useful follow-up questions;
- summarize when helpful;
- identify tensions or patterns;
- suggest tarot when appropriate;
- allow the user to decline;
- help capture meaningful realizations;
- avoid excessive questioning;
- avoid making every conversation a tarot reading.

Example:

User:

> “I'm thinking about my ex again.”

The AI should not immediately draw cards.

It may first explore:

- what brought the thought back;
- whether the user misses the person or the past;
- what feels unresolved.

Later it may suggest:

> “It sounds like part of what you're trying to understand is whether this is nostalgia or something that still needs closure. Want to explore that with a few cards?”

Actions:

**Reflect with cards**  
**Keep talking**

---

# 17. Soft-Structured Sessions

The session should feel freeform to the user.

Internally, the system may recognize states such as:

```text
Opening
   ↓
Exploration
   ↓
Optional Tarot
   ↓
Deeper Reflection
   ↓
Insight
   ↓
Optional Intention
   ↓
Closure
```

Not every session must pass through every stage.

The user must never feel required to “complete” a reflection.

---

# 18. AI Response Philosophy

The companion should be:

- warm;
- thoughtful;
- curious;
- calm;
- non-judgmental;
- conversational;
- adaptive to user language;
- lightly mystical around tarot;
- grounded around consequential topics.

It should not sound:

- excessively clinical;
- like a therapist impersonation;
- like a fortune teller claiming certainty;
- artificially cheerful;
- preachy;
- dependent on repetitive disclaimers.

---

# 19. Multilingual Behavior

The MVP UI is English-first.

The AI conversation itself is multilingual.

The companion should automatically respond in the language primarily used by the user.

Examples:

Indonesian input → Indonesian response.

English input → English response.

Informal Indonesian should permit reasonably informal responses.

The companion may adapt tone but should not excessively imitate slang or user idiosyncrasies.

---

# 20. Tarot Interpretation Style

The selected style is:

> **Reflective with mystical flavor**

The AI may use traditional tarot language and symbolism.

However, it must distinguish symbolic interpretation from certainty.

Example:

Preferred:

> “The Moon can point toward uncertainty, intuition, or situations where everything isn't fully visible yet.”

Avoid:

> “The Moon means this person is lying to you.”

---

# 21. Tarot Interpretation Structure

The AI should conceptually reason through three layers.

## Layer 1 — Traditional Meaning

What the card commonly symbolizes.

## Layer 2 — Meaning in This Reading

How it relates to:

- the user's question;
- spread position;
- surrounding cards;
- previous discussion.

## Layer 3 — Reflection

What perspective or question the user might consider.

Example:

### The Hermit — Upright

**Traditional meaning**

Introspection, solitude, inner guidance.

**In this reading**

The card may suggest stepping away from external opinions long enough to understand what you actually want.

**Reflection**

> If nobody else had an opinion about this decision, what would you choose?

These sections do not always need to appear as literal headings. They describe the reasoning framework.

---

# 22. Tarot Engine

The LLM must not independently invent cards.

Card selection is controlled by a separate Tarot Engine.

Architecture:

```text
User
 ↓
Reflection Conversation
 ↓
Tarot Requested
 ↓
Tarot Engine
 ↓
Structured Card Result
 ↓
LLM Interpretation
 ↓
Rendered Reading
```

---

# 23. Tarot Engine Requirements

The engine must support the complete 78-card Rider–Waite–Smith structure.

## Major Arcana

22 cards.

## Minor Arcana

56 cards across:

- Wands;
- Cups;
- Swords;
- Pentacles.

Each draw should include structured data such as:

```json
{
  "cardId": "the_moon",
  "name": "The Moon",
  "arcana": "major",
  "orientation": "upright",
  "position": "What I may be overlooking"
}
```

---

# 24. Card Orientation

MVP supports:

- Upright
- Reversed

Orientation selection must be part of the Tarot Engine rather than generated by the LLM.

---

# 25. Duplicate Handling

Cards cannot repeat within the same active deck draw unless explicitly supported by a future special mode.

Drawing a clarification card should use the remaining deck state.

---

# 26. Reading Reproducibility

Once a card has been drawn, the result must remain stable.

Refreshing the page or reopening history must not redraw the reading.

The following should be persisted:

- selected cards;
- orientations;
- spread positions;
- draw order;
- timestamp;
- session ID;
- optional deck state or seed if required by implementation.

---

# 27. Rider–Waite–Smith Artwork

MVP uses classic Rider–Waite–Smith imagery.

Before production launch, all actual image assets must be verified for licensing/public-domain suitability.

Do not assume every online scan of Rider–Waite artwork is free to redistribute.

The product may still create a unique visual identity around the artwork using:

- background;
- typography;
- card frame;
- animation;
- spacing;
- lighting;
- transitions;
- layout.

---

# 28. Tarot Interaction Modes

The MVP supports Adaptive Tarot Interaction.

## Quick Draw

The system automatically shuffles and draws the requested number of cards.

Ideal for users prioritizing speed.

## Interactive Draw

The user participates in a more immersive sequence.

Possible flow:

```text
Focus on your question
      ↓
Shuffle
      ↓
Cut the deck
      ↓
Choose cards
      ↓
Reveal
```

The interaction should remain optional. In the current build the Interactive Draw is a docked bar at the bottom of the conversation (no separate picker dialog); Quick Draw remains only as the retry path when an automated draw fails.

---

# 29. Tarot Visual Experience

Cards should initially appear face-down when appropriate.

Potential actions:

- Shuffle
- Cut
- Draw
- Reveal
- Reveal all

Cards should flip visually.

After reveal, each card shows:

- image;
- name;
- orientation;
- spread position.

Clicking a card should open detailed card information.

Animations must not significantly delay the user.

Accessibility settings should respect reduced-motion preferences.

---

# 30. Tarot Suggestions

The AI recommends a spread sized by the complexity of what the user is exploring.

Example:

User:

> “I don't know whether to quit my job.”

AI may recommend:

### Decision Reflection

1. Where I am now
2. What keeps me here
3. What draws me elsewhere
4. What I may be overlooking
5. What deserves my attention

The recommendation renders as a one-click confirmation card; the user can:

- confirm the recommendation (one click on "Begin reading");
- pick an alternate spread of a different card count;
- decline ("Not now").

The app draws the cards in its docked Interactive Draw bar — the AI never draws cards itself. After the reveal, the AI interprets the drawn cards.

The AI should not re-recommend tarot after a decline unless the user asks for cards again.

---

# 31. Basic Spread Library

MVP should contain a modest number of well-designed spreads.

Suggested initial library:

## One Card

Single perspective.

## Three Card Reflection

- Situation
- What deserves attention
- Possible direction

## Past / Present / Future

Traditional structure, interpreted reflectively.

## Situation / Challenge / Guidance

General reflection.

## Relationship Reflection

- Me
- Them
- Dynamic

## Decision Reflection

- Current position
- What supports option A
- What supports option B
- What I may be overlooking
- Guidance

More specialized spreads belong in later releases.

---

# 32. Clarification Cards

Users should be able to request a clarification card.

Example:

> “Can we clarify The Moon?”

The engine draws another card from the remaining deck.

The relationship should be visually represented.

```text
The Moon
   ↓
Clarified by
   ↓
Queen of Swords
```

The AI then interprets the pair together.

---

# 33. Manual Interpretation Feedback

Users must be allowed to reject an interpretation.

Examples:

- “That doesn't resonate.”
- “I think this card refers to something else.”
- “Can you read it differently?”

The AI should respond flexibly rather than defending its original interpretation.

---

# 34. History

Every account-based reflection session should automatically appear in History.

History represents:

> **Everything I have done.**

History can contain:

- normal conversation;
- tarot sessions;
- reflection sessions.

A user should not need to manually save every session.

---

# 35. Journal

Journal represents:

> **What I intentionally decided matters.**

Journal is not equivalent to History.

Journal content types include:

- freeform journal entry;
- saved reflection;
- saved tarot session;
- saved insight;
- mood check-in;
- follow-up reflection;
- intention.

---

# 36. Journal Timeline

Journal should be presented as a chronological personal timeline.

Example:

```text
August 25

INSIGHT
“I realized that I'm more afraid of uncertainty
than I am attached to this job.”

TAROT REFLECTION
Decision Reflection
Eight of Cups
Two of Swords
The Fool

JOURNAL
“I've been thinking about work a lot today.”

────────────────────

August 21

MOOD CHECK-IN
Anxious

“Deadline week.”
```

---

# 37. Freeform Journal

Users can create journal entries without using AI or tarot.

The editor should prioritize user writing.

Basic functionality:

- title optional;
- body;
- timestamp;
- tags optional;
- mood optional;
- edit;
- delete.

---

# 38. AI-Assisted Journal

AI is available as an assistant within the journal but does not automatically rewrite content.

Possible actions:

- Help me unpack this
- Give me reflection prompts
- Extract an insight
- Summarize what I'm feeling
- Reflect with tarot
- Save something as Memory

Any AI-generated content should remain visually distinguishable from the user's original writing.

The original entry must remain unchanged unless the user explicitly edits it.

---

# 39. Insight Capture

A core MVP feature.

During conversation, users can save meaningful statements as an Insight.

Example user statement:

> “I think I'm not actually afraid of losing them. I'm afraid of being alone.”

AI/UI may provide:

**Save insight**

Saved Insight:

> I realized that what I'm afraid of isn't losing them, but being alone.

Where possible, preserve the user's wording.

The AI should avoid heavily rewriting a personal realization without the user's request.

---

# 40. History → Journal → Memory Model

These represent three levels of intentionality.

```text
HISTORY
Everything automatically stored
      ↓
JOURNAL
Things the user intentionally values
      ↓
MEMORY
Things the user explicitly allows AI
to use across future sessions
```

---

# 41. Memory

Long-term memory must be explicit.

The AI must not automatically convert arbitrary conversation claims into permanent memory.

Users can choose:

**Remember this**

Potential memory categories:

- preference;
- goal;
- recurring situation;
- important context;
- ongoing project;
- relationship context;
- reflection preference.

Memory should not be framed as an immutable fact about the user's personality.

---

# 42. Memory Management

The Memory screen must allow users to:

- view memories;
- edit memory;
- delete memory;
- disable memory;
- understand why a memory exists.

Example:

```text
You prefer shorter tarot explanations.

Saved August 12
Source: Reflection preferences

[Edit] [Forget]
```

---

# 43. Contextual Journal Retrieval

The AI may detect that a previous saved reflection appears relevant.

It must not automatically expose the contents.

Instead:

> “There's an older reflection that seems related to what you're describing. Want to bring it into this conversation?”

Actions:

- Bring it in
- Not now

Only after explicit approval should that specific journal context enter the active AI conversation.

---

# 44. Memory vs Journal Retrieval

These concepts must remain distinct.

## Memory

Approved information available across sessions.

## Journal Retrieval

Specific historical content discovered as potentially relevant.

Journal content requires user approval before being injected into the active conversation context.

---

# 45. Follow-Up Reflections

Users can intentionally schedule a check-in on a reflection.

Example action:

**Check in with me later**

Options:

- Tomorrow
- In 3 days
- In 1 week
- Custom date

MVP delivery channel:

**In-app only.**

No email or push notification required.

---

# 46. Follow-Up UX

When the user returns:

> **A reflection is ready to revisit**

> You asked to check in on this reflection after one week.

Actions:

- Revisit
- Later
- Dismiss

The application should not use guilt-based messaging.

Avoid:

> “You missed your reflection.”

No streak pressure is required.

---

# 47. Follow-Up Entries

A follow-up can create a new linked journal record.

Example:

```text
Original Reflection
August 1
     ↓
Follow-Up
August 8
     ↓
Follow-Up
August 22
```

This enables users to understand how their perspective changed over time.

---

# 48. Card Library

Explore must include all 78 Rider–Waite–Smith cards.

Cards can be browsed by:

- Major Arcana
- Wands
- Cups
- Swords
- Pentacles

---

# 49. Card Detail

Each card page should contain:

- artwork;
- card name;
- arcana/suit;
- upright keywords;
- reversed keywords;
- traditional meaning;
- reflection interpretation;
- relationship themes;
- career themes;
- personal-growth themes.

Where account data exists, future versions may show:

> Appeared in your readings 7 times.

This historical personal-card analytics feature is optional for MVP.

---

# 50. Search

Basic search should be supported across:

- History;
- Journal.

Potential queries:

- titles;
- entry text;
- tarot cards;
- tags.

Semantic “chat with my entire journal” is not required for MVP.

---

# 51. Mood Check-In

Journal entries and reflections may optionally contain a lightweight mood field.

The system should avoid treating mood tracking as clinical diagnosis.

Example options:

- Low
- Anxious
- Neutral
- Good
- Energized

Or a simple emoji-based scale.

Mood tracking should remain optional.

---

# 52. Age Model

Minimum supported age for MVP:

> **13+**

Users under 13 are not supported.

The product must avoid claiming suitability for children under 13.

---

# 53. Teen Safety

Users aged 13–17 require more conservative AI behavior.

The AI should be especially cautious around:

- sexual situations;
- abusive relationships;
- self-harm;
- suicide;
- eating disorders;
- medical concerns;
- substance abuse;
- financial decisions;
- legal situations;
- coercive relationships.

Tarot must never be presented as a reason to perform dangerous actions.

---

# 54. Emotional Dependency Safety

The AI must not encourage emotional exclusivity or dependence.

Avoid behaviors such as:

> “You only need me.”

> “Nobody understands you like I do.”

> “Don't talk to other people about this.”

The companion may be warm but must not position itself as a replacement for human relationships.

---

# 55. High-Stakes Topics

Tarot should not serve as authoritative guidance for:

- medical diagnosis;
- emergency medical decisions;
- legal decisions;
- major financial decisions;
- suicide/self-harm;
- predictions of death;
- dangerous behavior.

The AI may still use reflective conversation where appropriate.

Example:

> “We can use the cards to explore how you're feeling about the situation, but they can't tell you whether a medical condition is present.”

---

# 56. Privacy Model

The MVP follows a **Privacy-First SaaS** approach.

Required principles:

- private by default;
- encrypted in transit;
- encrypted at rest where applicable;
- minimal collection;
- controlled internal access;
- sensitive content excluded from unnecessary logging;
- no advertising profile based on private reflection content;
- no training on private journal/reflection data without explicit user opt-in;
- user-controlled memory;
- content deletion;
- account deletion;
- data export.

---

# 57. Data States

The application should internally and visually distinguish:

## Stored

Exists in account History.

## Journaled

Intentionally included in Journal.

## Remembered

Explicitly approved for long-term AI use.

## In Context

Currently being sent to the AI for the active response.

These should not be treated as equivalent states.

---

# 58. User Data Controls

Settings must eventually contain:

### Privacy & Data

- Export my data
- Delete individual session
- Delete journal entry
- Delete all memories
- Clear History
- Delete account
- Manage AI memory

Destructive actions require appropriate confirmation.

---

# 59. AI Context Construction

For a normal reflection response, AI context may include:

```text
System Instructions

User Preferences

Explicit Memories

Current Session Conversation

Current Tarot Spread
    ↓
Relevant Card Metadata

Optional Approved Historical Context

User Message
```

Journal contents that have not been approved for retrieval should not silently enter context.

---

# 60. AI Context Transparency

Whenever older personal content is brought into a new session, the interface should make that reasonably understandable.

Example:

> Using: “Career reflection — August 12”

The user should be able to remove historical context from the active session.

---

# 61. LLM Provider Architecture

The product should avoid deeply coupling product logic to a single LLM vendor.

Recommended conceptual architecture:

```text
Product
   ↓
AI Orchestration Layer
   ↓
Model Adapter
   ├── Provider A
   ├── Provider B
   └── Future Providers
```

Tarot logic, journaling, safety rules, memory, and product state should not depend on proprietary model-specific behavior wherever avoidable.

---

# 62. AI Tool Model

The AI should conceptually have explicit product tools rather than simulating actions in prose.

Examples:

```text
recommend_reading()
ask_user()
save_insight()
search_memory()
suggest_journal_context()
create_followup()
```

Draws are app-initiated via the draw service — the model never draws cards.

The LLM decides when a tool might help.

The application controls the actual action.

Actions that affect long-term user data require appropriate explicit user interaction.

---

# 63. Core Session Example

User:

> “I feel like my relationship is going nowhere.”

AI explores the situation.

User describes uncertainty.

AI:

> “It sounds like you're trying to separate two things: how you feel about them and whether the relationship itself is actually moving. If you want, we could explore that with a three-card reflection.”

Actions:

**Reflect with cards**  
**Keep talking**

User selects tarot.

Spread:

1. What I'm bringing into this relationship
2. What the relationship is showing me
3. What deserves my attention

Cards are drawn.

AI interprets them in context.

AI asks one meaningful reflection question.

User responds:

> “Maybe I'm mostly waiting for them to make the decision for me.”

UI:

**Save insight**

The user saves it.

Later:

**Check in with me in one week**

The follow-up becomes available in-app one week later.

This represents the intended core product experience.

---

# 64. Error Handling

## AI Response Failure

The user's message must remain intact.

Show:

> Something went wrong while generating this reflection.

Actions:

- Try again
- Continue writing

---

## Tarot Draw Failure

Never silently generate substitute cards with the LLM.

If the Tarot Engine fails:

> We couldn't draw the cards right now.

Allow retry.

---

## Save Failure

User-written content should not disappear.

If cloud saving fails:

- preserve draft locally;
- show unsaved state;
- allow retry.

---

## Guest Migration Failure

Do not delete local guest records until cloud migration is confirmed successful.

---

# 65. Accessibility

MVP should include:

- keyboard-accessible navigation;
- sufficient text contrast;
- readable font sizing;
- semantic buttons;
- accessible card names;
- alt text for card images;
- reduced motion support;
- no information conveyed solely through color;
- responsive layout.

Tarot flip animations should respect `prefers-reduced-motion`.

---

# 66. Responsive Design

The website must work on:

- desktop;
- tablet;
- mobile browser.

Mobile should not simply shrink the desktop sidebar.

Recommended mobile navigation:

- collapsible navigation;
- conversation-first viewport;
- tarot spreads that horizontally scroll or adapt vertically.

Native mobile apps are not required.

---

# 67. UX Design Direction

The application should feel:

- calm;
- intimate;
- reflective;
- contemporary;
- spacious;
- warm;
- trustworthy.

Avoid stereotypical tarot design that overuses:

- excessive purple gradients;
- gold borders everywhere;
- stars on every component;
- gothic typography;
- mystical visual clutter.

Mystical elements can appear primarily during tarot interactions.

The base application should still feel like a modern reflection product.

---

# 68. Analytics Philosophy

Analytics must not ingest raw private journal/reflection text merely for product metrics.

Prefer event metadata.

Examples:

```text
reflection_started
reflection_completed
tarot_suggested
tarot_started
tarot_completed
insight_saved
journal_entry_created
journal_entry_revisited
memory_created
followup_created
followup_revisited
signup_started
signup_completed
guest_data_imported
```

Do not send the user's actual reflection content inside analytics events.

---

# 69. MVP Success Metrics

The primary question is not:

> How many people visit?

It is:

> Do people find enough reflective value to come back?

Suggested metrics:

## Activation

Percentage of new users who complete one meaningful reflection.

## Tarot Engagement

Percentage of reflection sessions where tarot is intentionally used.

## Insight Save Rate

Percentage of completed reflections resulting in at least one saved insight.

## Journal Save Rate

Percentage of active users who create or save journal content.

## Reflection Return Rate

Users returning within:

- 1 day;
- 7 days;
- 30 days.

## Journal Revisit Rate

How often users reopen previous journal entries.

## Follow-Up Completion

Percentage of scheduled check-ins that are eventually revisited.

## Session Depth

Meaningful conversational turns per session.

This should not incentivize artificially long AI responses.

---

# 70. Qualitative Validation

During MVP testing, ask users questions such as:

- Did this help you think differently?
- Did the tarot feel useful or distracting?
- Did the AI ask useful questions?
- Did anything feel judgmental?
- Did anything feel too mystical?
- Did anything feel too clinical?
- Did you understand what was being saved?
- Would you want to return to this reflection later?
- Would you use this instead of or alongside ordinary journaling?

---

# 71. Key MVP Hypotheses

## H1

Conversation makes journaling easier than a blank-page experience.

## H2

Tarot symbolism creates useful new reflection angles.

## H3

Users will save meaningful insights instead of only consuming AI responses.

## H4

A curated Journal provides greater long-term value than raw chat History.

## H5

Explicit memory creates personalization without creating privacy discomfort.

## H6

Users will return to follow up on meaningful previous reflections.

---

# 72. MVP Feature Priority

## P0 — Required

- guest-first access;
- micro onboarding;
- reflection chat;
- multilingual AI;
- Guided Companion;
- account authentication;
- guest local storage;
- guest migration;
- history;
- Tarot Engine;
- RWS 78-card dataset;
- upright/reversed;
- visual tarot cards;
- Quick Draw;
- basic Interactive Draw;
- basic spreads;
- AI spread suggestions;
- clarification cards;
- journal;
- freeform journal entries;
- save session to journal;
- save insight;
- explicit memory;
- memory management;
- in-app follow-up;
- card library;
- privacy controls;
- teen/high-stakes safety behavior.

---

## P1 — Strongly Desired

- journal search;
- history search;
- mood attachment;
- card-specific personal history;
- better session titles;
- richer journal filtering;
- entry linking;
- export user data.

---

## P2 — Later

- semantic journal search;
- monthly reflection summaries;
- recurring-theme dashboards;
- multiple decks;
- original visual deck;
- manual physical-card reading workflow;
- custom spreads;
- voice;
- camera recognition;
- native applications.

---

# 73. MVP Acceptance Criteria

The MVP is considered functionally complete when a new user can:

1. Visit the website without an account.
2. Complete optional micro onboarding.
3. Start a reflection conversation.
4. Continue entirely without tarot.
5. Receive an optional contextual tarot suggestion.
6. Confirm the AI-recommended reading (or pick another size).
7. Draw cards through the Tarot Engine.
8. Visually reveal cards.
9. Receive context-aware AI interpretation.
10. Ask follow-up questions.
11. Draw a clarification card.
12. Save guest history locally.
13. Create an account.
14. Import guest reflections.
15. View automatic History.
16. Save a meaningful insight.
17. Save a reflection to Journal.
18. Create a freeform journal entry.
19. Use optional AI assistance in Journal.
20. Explicitly create a Memory.
21. View/edit/delete that Memory.
22. Receive a contextual historical-content suggestion.
23. Explicitly approve historical context before it is used.
24. Create a future in-app check-in.
25. Revisit that reflection later.
26. Browse all tarot cards.
27. Delete personal entries.
28. Use the application on mobile and desktop.
29. Receive age-appropriate safety responses.
30. Understand that tarot interpretations represent reflection and possibility rather than certainty.

---

# 74. Proposed Main User Journey

```text
Landing
   ↓
“What’s on your mind?”
   ↓
Optional Micro Onboarding
   ↓
Guest Reflection
   ↓
Conversation
   ├───────────────→ Keep Talking
   │
   └→ Tarot Suggested
          ↓
     Quick / Interactive
          ↓
        Spread
          ↓
       Card Draw
          ↓
    Interpretation
          ↓
      Reflection
          ↓
    Meaningful Insight
          ↓
       Save?
      /     \
    No       Yes
             ↓
        Create Account
             ↓
      Import Guest Data
             ↓
           Journal
             ↓
       Optional Memory
             ↓
     Optional Follow-Up
             ↓
         Return Later
```

---

# 75. Conceptual Data Entities

This section defines product-level concepts rather than database implementation.

## User

Represents an authenticated account.

## GuestProfile

Local-only anonymous user state.

## ReflectionSession

Conversation container.

Properties may include:

- session ID;
- user/guest owner;
- title;
- created date;
- updated date;
- session status;
- conversation messages.

## TarotReading

Associated with a ReflectionSession.

Contains:

- deck;
- spread;
- cards;
- orientations;
- positions;
- draw order;
- created time.

## JournalEntry

Curated personal content.

Entry type:

- freeform;
- reflection;
- tarot;
- insight;
- mood;
- follow-up;
- intention.

## Memory

Explicit user-approved persistent AI context.

## FollowUp

Contains:

- source reflection;
- target date;
- status;
- eventual follow-up entry.

## TarotCard

Canonical card definition.

## Spread

Reusable spread definition.

---

# 76. Conceptual Product Relationships

```text
User
 ├── Reflection Sessions
 │      ├── Messages
 │      └── Tarot Readings
 │
 ├── Journal
 │      ├── Journal Entries
 │      ├── Insights
 │      └── Follow-Ups
 │
 ├── Memories
 │
 └── Preferences

Tarot Reading
 ├── Spread
 └── Cards
```

---

# 77. Long-Term Product Direction

If MVP validates the behavior, the product can evolve into a deeper personal reflection system.

Potential future capabilities:

### Personal Patterns

Identify recurring topics across saved reflections.

### Tarot Pattern Analysis

Examples:

- frequently appearing cards;
- recurring suits;
- recurring themes.

### Monthly Reflection

AI-assisted summary of intentionally saved journal material.

### Personal Reflection Search

> “Show me everything I've written about changing jobs.”

### Conversational Journal Retrieval

> “What patterns have I noticed about relationships this year?”

### Multiple Decks

Including original branded artwork.

### Physical Card Mode

User manually chooses cards from their deck.

### Camera Recognition

Recognize physical cards from photos.

### Voice Reflection

Speak rather than type.

### Custom Spread Builder

Design personal tarot spreads.

These should only be pursued after evidence that the core reflection loop retains users.

---

# 78. Product Identity

The product should ultimately be understood as:

> **A reflection companion that happens to use tarot extremely well.**

Not:

> **A tarot generator with an AI chat box attached.**

That distinction should guide every future feature decision.

When evaluating a new feature, ask:

> Does this help the user understand themselves, capture something meaningful, or revisit their perspective later?

If the answer is no, the feature is probably outside the core product.

---

# 79. MVP Definition in One Sentence

> **A private, chat-first AI reflection companion where users can talk through what is on their mind, optionally use Rider–Waite–Smith tarot as a reflective tool, capture meaningful insights into a personal journal, intentionally build AI memory, and revisit their thinking over time.**

---

# 80. Final Core Loop

The product's most important loop is:

> **Express → Explore → Reframe → Capture → Revisit**

Tarot supports **Reframe**.

AI supports **Explore**.

Journal supports **Capture**.

History and follow-ups support **Revisit**.

The user remains at the center of all four.