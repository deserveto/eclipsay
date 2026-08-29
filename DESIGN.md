---
name: Eclipsay
description: A private, chat-first AI reflection companion — warm paper, one copper voice, and a tarot world that owns the night.
colors:
  background: "oklch(0.985 0.006 85)"
  foreground: "oklch(0.24 0.014 70)"
  card: "oklch(1 0.004 85)"
  card-foreground: "oklch(0.24 0.014 70)"
  primary: "oklch(0.54 0.085 55)"
  primary-foreground: "oklch(0.985 0.01 85)"
  secondary: "oklch(0.955 0.012 85)"
  secondary-foreground: "oklch(0.29 0.014 70)"
  muted: "oklch(0.95 0.01 85)"
  muted-foreground: "oklch(0.5 0.02 70)"
  accent: "oklch(0.94 0.02 80)"
  accent-foreground: "oklch(0.29 0.014 70)"
  destructive: "oklch(0.577 0.215 27.325)"
  border: "oklch(0.9 0.012 80)"
  input: "oklch(0.9 0.012 80)"
  ring: "oklch(0.68 0.07 60)"
  sidebar: "oklch(0.968 0.009 85)"
  sidebar-accent: "oklch(0.94 0.018 80)"
  sidebar-border: "oklch(0.9 0.012 80)"
  mystical-base: "oklch(0.26 0.035 275)"
  mystical-deep: "oklch(0.2 0.03 268)"
  mystical-glow: "oklch(0.42 0.06 285)"
  mystical-text: "oklch(0.96 0.008 85)"
  mystical-ring: "oklch(0.62 0.07 285)"
  mystical-glow-low: "oklch(0.35 0.05 265 / 0.35)"
  mystical-cardback-glow-a: "oklch(0.5 0.07 285 / 0.5)"
  mystical-cardback-glow-b: "oklch(0.42 0.06 260 / 0.5)"
  mystical-cardback-base: "oklch(0.3 0.045 275)"
  scrollbar-pill: "oklch(0.85 0.015 80)"
  scrollbar-pill-hover: "oklch(0.76 0.02 75)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4.5vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  reading:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.025em"
  micro:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
  micro-badge:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
  micro-tarot:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
  code-inline:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "16px"
  nav-link:
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  nav-link-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.sidebar-accent-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  chip-filter-active:
    backgroundColor: "oklch(0.54 0.085 55 / 0.1)"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  badge-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.4xl}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: Eclipsay

## Overview

**Creative North Star: "The Lamplit Study"**

Eclipsay is a warm, paper-lit room for thinking. Every surface sits in one tight warm range — paper backgrounds, warm ink text, clay hairlines — all sharing a single hue family (oklch hue 80–85), so nothing in the base app ever competes for attention. Spacious surfaces hold compact, precise controls: 32px buttons, 14px body text, tight 2px nav gaps inside generous page whitespace. Conversation is the room's furniture; chrome steps back.

Depth comes from light, not shadow: surfaces separate by 1px hairline rings, fields differentiate by tone, and a box-shadow must be earned by physicality (a tarot card) or overlay (a modal). One muted copper voice speaks at a time — primary actions, active tints, links, and the live "Reflecting…" pulse — and its scarcity is what makes it audible. When tarot enters, the study dims: a scoped indigo atmosphere (`.mystical`) with veiled radial glows takes over only inside tarot surfaces, and the base app never borrows it.

The system is one warm world in two appearances — "Lamplit Study by Day / After Hours": by day, the light palette below; after hours, a `.dark` override whose base is warm neutral charcoal with the same scarce copper accent — never blue, purple, pure black, or high-contrast neon. One type family, Geist, carries everything from the 48px landing headline down to 10px mystical micro-labels.

**Key Characteristics:**
- One warm monochrome (hue 80–85) + a single muted copper accent
- Flat at rest; hairline rings instead of shadows; shadows earned by overlays
- Compact, precise chrome (32px controls) inside spacious, calm layouts
- Indigo "mystical" atmosphere strictly scoped to tarot surfaces
- Geist Sans only; hierarchy by weight and size, never by family
- Reversed cards carry a text badge — never color-only meaning
- Every animation resolves instantly under `prefers-reduced-motion`

## Colors

A warm monochrome with one voice: everything except copper and the tarot indigo lives in a narrow warm band (oklch hue 80–85), so hierarchy is carried by lightness, not hue.

### Primary
- **Muted Copper** (`oklch(0.54 0.085 55)`): The only accent. Primary buttons (with `oklch(0.985 0.01 85)` text), text links, active filter tints (`oklch(0.54 0.085 55 / 0.1)` wash), icon tiles on the landing cards, focus ring (`oklch(0.68 0.07 60)` is its lighter sibling), and the live pulse dot. If copper appears more than once or twice per viewport, something is over-voiced.

### Neutral
- **Warm Paper** (`oklch(0.985 0.006 85)`): App background. Never pure white — the warmth is the identity.
- **Paper White** (`oklch(1 0.004 85)`): Cards, popovers, chat surfaces. One step brighter than the room, like a sheet on a desk.
- **Warm Ink** (`oklch(0.24 0.014 70)`): All primary text.
- **Fog** (`oklch(0.5 0.02 70)`): Secondary text, placeholders, idle nav labels, descriptions.
- **Oat** (`oklch(0.955 0.012 85)`): Secondary chips and soft fills.
- **Candle Glow** (`oklch(0.94 0.02 80)`): Hover/accent washes, sidebar active state.
- **Clay Path** (`oklch(0.9 0.012 80)`): All 1px borders and input strokes.
- **Sidebar Parchment** (`oklch(0.968 0.009 85)`): The nav rail, sitting between Paper and Oat.
- **Ember** (`oklch(0.577 0.215 27.325)`): Danger states only — destructive buttons render as a 10% Ember wash with Ember text, never a solid fill.

### Tarot (scoped)
- **Indigo Dusk** (`oklch(0.26 0.035 275)` → **Velvet Night** `oklch(0.2 0.03 268)`): The `.mystical` panel gradient base.
- **Veiled Glow** (`oklch(0.42 0.06 285)`, `oklch(0.5 0.07 285)`): Radial glows rising from the panel's top edge and lower corner.
- **Moonpaper** (`oklch(0.96 0.008 85)`): Text on mystical surfaces.
- **Wisp Ring** (`oklch(0.62 0.07 285)`): Focus/chosen outlines inside tarot surfaces.
- **Card-back Glow** (`oklch(0.5 0.07 285 / 0.5)`, `oklch(0.42 0.06 260 / 0.5)`): The twin radials inside `.mystical-card-back`, over the Card-back Base.
- **Card-back Base** (`oklch(0.3 0.045 275)` → `oklch(0.22 0.035 268)`): The 160° gradient behind card backs.
- **Low Veil** (`oklch(0.35 0.05 265 / 0.35)`): The `.mystical` panel's lower-corner radial glow.

### Dark neutral

After hours, the same warm family dims to charcoal: warm neutral surfaces, warm ink inverted to moonpaper text, and the identical scarce copper voice (brightened for low light). The dark base is never blue, purple, pure black, or high-contrast neon, and the indigo tarot atmosphere stays exclusive to tarot. These are the `.dark` token overrides in `src/app/globals.css`:

| Token | Dark value |
|---|---|
| `--background` | `oklch(0.18 0.012 70)` |
| `--foreground` | `oklch(0.92 0.012 85)` |
| `--card`, `--popover` | `oklch(0.22 0.014 75)` |
| `--card-foreground`, `--popover-foreground` | `oklch(0.92 0.012 85)` |
| `--primary` | `oklch(0.68 0.09 55)` |
| `--primary-foreground` | `oklch(0.18 0.012 70)` |
| `--secondary` | `oklch(0.27 0.014 75)` |
| `--secondary-foreground` | `oklch(0.9 0.012 85)` |
| `--muted` | `oklch(0.25 0.012 75)` |
| `--muted-foreground` | `oklch(0.7 0.018 80)` |
| `--accent` | `oklch(0.29 0.025 70)` |
| `--accent-foreground` | `oklch(0.92 0.012 85)` |
| `--destructive` | `oklch(0.68 0.18 27.325)` |
| `--border` | `oklch(0.32 0.014 75)` |
| `--input` | `oklch(0.34 0.014 75)` |
| `--ring` | `oklch(0.72 0.075 60)` |
| `--chart-1` | `oklch(0.68 0.09 55)` |
| `--chart-2` | `oklch(0.7 0.07 130)` |
| `--chart-3` | `oklch(0.7 0.07 260)` |
| `--chart-4` | `oklch(0.76 0.1 80)` |
| `--chart-5` | `oklch(0.65 0.08 300)` |
| `--sidebar` | `oklch(0.16 0.012 70)` |
| `--sidebar-foreground` | `oklch(0.9 0.012 85)` |
| `--sidebar-primary` | `oklch(0.68 0.09 55)` |
| `--sidebar-primary-foreground` | `oklch(0.18 0.012 70)` |
| `--sidebar-accent` | `oklch(0.25 0.02 70)` |
| `--sidebar-accent-foreground` | `oklch(0.92 0.012 85)` |
| `--sidebar-border` | `oklch(0.29 0.014 75)` |
| `--sidebar-ring` | `oklch(0.72 0.075 60)` |
| `--scrollbar-pill` | `oklch(0.42 0.018 75)` |
| `--scrollbar-pill-hover` | `oklch(0.52 0.02 75)` |

### Named Rules
**The One Voice Rule.** Muted Copper appears on ≤10% of any screen — primary action, active tint, link, pulse. Its rarity is the point; a second copper element within one glance dilutes both.

**The Tarot Owns Indigo Rule.** The indigo mystical atmosphere (`.mystical`, `.mystical-card-back`, `.mystical-ring`) may appear only inside tarot surfaces — even when the surrounding app is dark, the After Hours base stays warm-neutral charcoal and never borrows the indigo (PRD §67).

## Typography

**Display Font:** Geist (via `next/font`, `--font-sans`; fallback `ui-sans-serif, system-ui`)
**Body Font:** Geist — the same family; hierarchy is carried by weight and size alone
**Label/Mono Font:** Geist Mono is loaded but deliberately unused — do not introduce it for decoration

**Character:** One contemporary grotesk, quiet and even, set small and medium more often than large. Display sizes tighten tracking; eyebrows widen it. Nothing is ever set in a second family.

### Hierarchy
- **Display** (500, 36→48px, line-height 1.1, tracking −2.5%): The landing question "What's on your mind?" — one per surface, never repeated in-app.
- **Title** (500, 16px, line-height 1.375): Card titles, dialog headings, ceremony phase titles (18px inside mystical panels).
- **Body** (400, 14px, line-height 1.45): The default for everything — chat, descriptions, nav labels, buttons (buttons add weight 500). 14px is the base size, not 16px.
- **Label** (500, 12px, tracking +2.5%): Badges, micro-buttons; uppercase + wide tracking is reserved for the wordmark "ECLIPSAY" and spread titles.
- **Micro** (500, 11px, line-height 1.2): Tarot panel position and card names; the 9–10px uppercase "Reversed" badge and clarify buttons live at the floor of the scale.
- **Chat Reading** (400, 15px, line-height ~1.75): User bubbles, rendered assistant prose, and card meanings on Explore detail pages (traditional meaning, reflection, themes), plus 13px inline code — a deliberate legibility step above Body for long reflective reading (age 13+); the only sanctioned use above 14px in-app.

### Named Rules
**The Whispering Wordmark Rule.** The brand name is set small — 14px, wide tracking, copper — never as a monument. The room is the brand; the wordmark is a nameplate.

## Layout

A persistent sidebar (desktop ≥ md) holds navigation and recent sessions; content is a single focused column — conversation-first, one primary task per view. On mobile the sidebar becomes a Sheet drawer over a conversation-first viewport; it is never a shrunken sidebar (PRD §66). The landing is a centered `max-w-xl` (576px) column, `py-16` vertical breathing room, `space-y-10` between hero and actions, entry cards in a 12px grid. Spacing rides a 4px base rhythm: 16px inside cards (`--card-spacing`, 12px when `size="sm"`), 2px between nav items, 40px between landing sections. Reading panels scroll horizontally (`gap-4`/`gap-5`) rather than wrapping — a spread is one line, like cards laid on a table. Density rule: compact controls, generous whitespace.

## Elevation & Depth

Flat by default. Surfaces separate by tone and 1px hairline rings, never resting shadows. A box-shadow must be earned: physical objects (tarot cards) get `shadow-lg`, overlays (the draw ceremony) get `shadow-2xl`, and mystical focus earns a glow ring. Interaction adds motion, not depth: clickable landing cards lift 2px on hover; buttons press down 1px on click.

### Shadow Vocabulary
- **Hairline ring** (`ring-1` at `oklch(0.24 0.014 70 / 0.1)`): The default card/separator treatment — a drawn line, not a cast shadow.
- **Card physicality** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Tarot cards only, face and back.
- **Overlay** (`shadow-2xl`): The draw-ceremony modal only.
- **Mystical glow ring** (`box-shadow: 0 0 0 1px oklch(0.62 0.07 285 / 0.35), 0 0 24px oklch(0.5 0.08 285 / 0.25)`): Chosen cards in the ceremony; tarot focus moments.

### Named Rules
**The Ring, Not Shadow Rule.** At rest, surfaces separate by 1px hairline rings (ink at 10%) or tone steps — never by cast shadow. Shadows are earned by physicality or overlay, and a hover may lift (translate) but not cast.

## Shapes

A gentle, consistent radius ladder scales from a 10px base (`--radius: 0.625rem`): 6 / 8 / 10 / 14 / 18 / 22 / 26px, plus full pill. Controls use 10px (`rounded-lg`), nav items 8px, cards 14px, mystical panels 18px, badges and chips and switches full pill. Edges are 1px strokes in Clay Path; inside mystical surfaces strokes switch to white-alpha (`white/20–30`) so lines read as moonlight, not ink. Tarot cards hold a tall 2:3.4 aspect (`aspect-[2/3.4]`) with 3D flip perspective (900px); the ceremony fan uses a narrower card (56×96px). Icons are Lucide at 16px inline (18px in feature tiles), never decorative flourishes.

## Components

### Buttons
Compact and precise: 32px tall (24/28/36px steps for `xs`/`sm`/`lg` and icon variants), 10px radius, 14px/500 text, 1.5px icon gap, press sinks 1px (`translate-y-px`), focus is a 3px copper ring at 50% + copper border.
- **Primary:** Muted Copper fill, Warm Paper text, hover darkens 8% toward Warm Ink (`color-mix(in oklch, var(--primary), var(--foreground) 8%)`, 5.5:1) — never opacity, which would drop the fill under AA contrast.
- **Ghost:** Transparent, hover fills Candle Glow/Oat wash.
- **Outline:** 1px Clay Path on Warm Paper, hover wash.
- **Destructive:** Soft — 10% Ember wash, Ember text (20%/30% hover); never a solid red fill.
- **Link:** Copper text, 4px underline offset.

### Chips
Two kinds, both pill: **filter chips** (Explore) — 1px border, idle in Fog, active gets copper tint (`oklch(0.54 0.085 55 / 0.1)` fill, copper text, copper border); **context chips** (approved journal context) — Oat fill, Fog text, with an inline remove ×. Both 12px text.

### Badges
20px tall, full pill (26px `rounded-4xl`), 12px/500 text, 8px horizontal padding. Variants mirror buttons; default is copper fill, secondary is Oat.

### Cards / Containers
Paper White fill, 14px radius, hairline ring (ink 10%) instead of border, 16px internal padding (12px small). Child images auto-round to the card corners. A card wrapped in a link lifts 2px on hover — no shadow change.

### Inputs / Fields
32px tall, transparent fill on 1px Clay Path, 10px radius, 14px text (16px on mobile to prevent zoom), Fog placeholder. Focus: copper border + 3px copper ring at 50%. Invalid: Ember border + soft Ember ring. Disabled: 50% opacity, Clay Path fill at 50%.

### Navigation
Sidebar links: 8px radius, 6×12px padding, 14px text, 16px Lucide icon, 2px vertical gap. Idle in Fog; hover and active fill Candle Glow with Warm Ink text; active carries `aria-current="page"`. Bottom group (Profile, Settings) mirrors the treatment. Mobile: hamburger → Sheet drawer from the left, same link anatomy.

### Signature: Tarot Reading Panel
The one place the night enters. An 18px-radius `.mystical` panel: two veiled radial glows over a Dusk-to-Night 175° gradient, Moonpaper text. Uppercase wide-tracked 14px spread title at 90% opacity; "Reveal all" and "Clarify" micro-buttons are white-alpha outlined ghosts (`white/25` border, hover `white/10` fill). Cards deal face-down in a horizontally scrolling row (96→112px wide, 2:3.4, 16–20px gaps), then flip in sequence — first reveal at 500ms, +550ms per card, 700ms 3D rotateY per flip, instant under `prefers-reduced-motion`. Backs are `.mystical-card-back` (twin radial glows over 160° gradient) with `white/20` border; faces are the RWS image, `object-cover`, rotated 180° when reversed — always paired with the uppercase 9px "Reversed" text badge, never color alone. Alt text follows `"<name>, <orientation>"` (PRD §65). Attribution "Pamela Colman Smith (1909), public domain" accompanies card art (PRD §27).

### Signature: Interactive Draw Ceremony
Full-screen `black/50` scrim; centered mystical panel (`max-w-lg`, 18px radius, 24px padding, `shadow-2xl`). Phases run Focus → Shuffle → Cut → Choose (shuffle holds 1600ms; 150ms when motion is reduced). The Choose fan lays out `count + 8` card backs (56×96px, 10px radius, `white/25` borders); hover lifts 4px, chosen lifts 8px and takes the Wisp glow ring with `white/60` border; selection is `aria-pressed`, fan disables at quota. Cancel is a quiet underlined `white/70` link.

## Do's and Don'ts

### Do:
- **Do** keep all standard controls at 32px height with 10px radius; use the 24/28/36px steps only for dense/icon contexts.
- **Do** separate surfaces with hairline rings (ink at 10%) or tone steps; reserve `shadow-lg`/`shadow-2xl` for tarot cards and overlays.
- **Do** restrict copper to primary actions, active tints, links, and the live pulse — one voice per glance.
- **Do** scope `.mystical` classes to tarot surfaces only; the base app stays warm — Lamplit paper by day, warm-neutral charcoal after hours.
- **Do** pair every reversed card with its uppercase text badge, and set card alt text to `"<name>, <orientation>"`.
- **Do** make every animation resolve instantly under `prefers-reduced-motion` (ceremony ceiling: 150ms).
- **Do** set destructive states as a 10% Ember wash with Ember text, behind `window.confirm` for destructive actions.

### Don't:
- **Don't** turn the dark theme blue, purple, pure black, or high-contrast neon; it remains a warm-neutral Lamplit Study.
- **Don't** add resting shadows to base cards, inputs, or buttons; hover lifts with translate, not cast shadows.
- **Don't** decorate with gold borders, stars, gothic typography, or purple gradients — the indigo world belongs to tarot alone (PRD §67).
- **Don't** add a second accent hue; Ember is a danger state, not a palette member.
- **Don't** introduce a second text family or use the loaded-but-unused Geist Mono for decoration.
- **Don't** convey state through color alone (reversed cards, chosen cards, active filters all carry text/aria signals).
- **Don't** scale type above the Display role in-app; the 48px question lives on the landing only.
