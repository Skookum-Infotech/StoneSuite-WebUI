---
name: StoneSuite
description: Warm, grounded CRM platform for SMB sales teams and their managers
colors:
  brand-lime: "#c2f589"
  brand-lime-hover: "#99c466"
  brand-lime-dark: "#719c3b"
  accent-lime-light: "#ecfccb"
  accent-lime-text: "#365314"
  stone-bg: "#fafaf9"
  stone-950: "#1c1917"
  stone-100: "#f7f7f7"
  stone-300: "#e8e8e8"
  stone-400: "#8a8580"
  stone-500: "#6b6560"
  teal-tab: "#2c6e7f"
  destructive: "#d94f36"
  ink-strong: "#1c1917"
  ink: "#44403c"
  ink-muted: "#6b6560"
  danger-ink: "#b42318"
  warning-ink: "#b45309"
  success-ink: "#047857"
  link: "#4d7c0f"
  danger-solid: "#dc2626"
typography:
  page-title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.46875rem"
    fontWeight: 600
    lineHeight: 1.36
    letterSpacing: "-0.02em"
  display:
    fontFamily: "All Round Gothic, Geist Variable, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 400
    lineHeight: 1.23
    letterSpacing: "-0.01em"
  kpi:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  dialog-title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.47
  card-title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  field-label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.54
  cell:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  overline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.06em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  base: "10px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-lime}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.base}"
    height: "30px"
    padding: "0 12px"
    fontSize: "0.78125rem"
    fontWeight: 600
  button-primary-hover:
    backgroundColor: "{colors.brand-lime-hover}"
    textColor: "{colors.ink-strong}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    borderColor: "#d4d0cc"
    rounded: "{rounded.base}"
    height: "30px"
    padding: "0 10px"
    fontSize: "0.78125rem"
    fontWeight: 500
  button-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "#ffffff"
    rounded: "{rounded.base}"
    height: "30px"
    padding: "0 12px"
    fontSize: "0.78125rem"
    fontWeight: 600
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: "30px"
    padding: "0 10px"
    fontSize: "0.78125rem"
    fontWeight: 500
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.stone-950}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
---

# Design System: StoneSuite

## 1. Overview

**Creative North Star: "The Warm Command Center"**

StoneSuite lives at the intersection of warmth and capability. It is a tool for people who are in motion — managing leads, moving deals forward, reviewing team pipelines — and the interface should feel like a well-organized desk, not a boardroom. The stone-warm background (`#fafaf9`) and ink-dark text (`#1c1917`) establish a base that is neither cold-corporate nor playful-consumer. The lime-green brand accent (`#c2f589`) is the system's single point of energy: purposeful, confident, and used sparingly so every appearance counts.

This is a product surface through and through. Design serves the task, not the other way around. Every screen exists to help a user do something, not to demonstrate the platform's features. The interface should disappear into the workflow.

What this system explicitly rejects: the bloated, tab-heavy overwhelm of Salesforce; the generic shadcn-default look with no personality; anything that could pass for a 2015 enterprise admin panel.

**Key Characteristics:**
- Warm stone neutrals as the canvas, never cold gray
- Single lime-green accent used for primary actions and active states only
- Geist Variable for all UI text — clean, readable at dense information density
- All Round Gothic reserved for brand moments (headers, logos, display callouts)
- Flat surfaces by default; depth through tonal layering, not heavy shadows
- 150–250ms transitions conveying state, never decoration

## 2. Colors: The Stone & Lime Palette

A restrained two-tone system: warm stone neutrals carry the structure; one lime accent carries the energy.

### Primary
- **Lime Green** (`#c2f589`): The brand accent. Used exclusively for primary action buttons, active sidebar items, selected states, and focus indicators. Its rarity is the point — when it appears, it signals "this matters."
- **Lime Green Hover** (`#99c466`): Hover state of the primary accent. Slightly desaturated to convey responsiveness without aggression.
- **Lime Green Dark** (`#719c3b`): Active/pressed state. Also used for dark-mode accent text on light surfaces.

### Secondary
- **Accent Lime Light** (`#ecfccb`): Low-saturation lime for chip backgrounds, tag fills, and subtle highlights. Not a button color — a surface wash.
- **Accent Lime Text** (`#365314`): Text color on lime-light backgrounds. Passes WCAG AA.
- **Teal Tab** (`#2c6e7f`): Used for tab bar backgrounds in multi-step forms. A secondary accent that complements lime without competing.

### Neutral
- **Stone Background** (`#fafaf9`): The canvas. Warm white — not pure white, not gray. Every screen starts here.
- **Stone 950** (`#1c1917`): Primary text and icon color. Ink-dark brown-black, not neutral-gray-black.
- **Stone 100** (`#f7f7f7`): Secondary surfaces — sidebar background, card backgrounds, muted states.
- **Stone 300** (`#e8e8e8`): Borders and input outlines. Barely-there, non-intrusive.
- **Stone 400** (`#8a8580`): Icons and disabled states only — 3.6:1 on white, so never informational text.
- **Stone 500** (`#6b6560`): Muted text, secondary labels, placeholders.
- **Destructive** (`#d94f36`): Error fills, borders and icons only. Error *text* uses danger-ink.

### Text colors (`text-ink-*` and meaning inks, all ≥4.5:1 on white)
- **ink-strong** (`#1c1917`): Titles, key values, record numbers.
- **ink** (`#44403c`): Body, table text, labels, typed text.
- **ink-muted** (`#6b6560`): Secondary text, helper text, table headers, placeholders.
- **ink-faint** (`#8a8580`): Icons and disabled only.
- **danger-ink** (`#b42318`) error text · **warning-ink** (`#b45309`) · **success-ink** (`#047857`) · **link** (`#4d7c0f`, hover `#365314`).

### Named Rules
**The One Lime Rule.** The lime accent appears on ≤10% of any given screen. Buttons, active nav items, focus rings — that's the full list. Do not use it for decoration, section headers, or background fills. Its scarcity is what makes it communicate "action."

**The Warm Canvas Rule.** Never use pure white (`#ffffff`) as the page background. The stone-warm `#fafaf9` is the floor. Cards and modals can sit on white, but the canvas beneath is always warm.

## 3. Typography

**UI font:** Geist Variable · **Brand font:** All Round Gothic (Book 400 only — never bold) · **Mono:** IBM Plex Mono 400 (record numbers, IDs, code).

Every text role is one `type-*` class in `src/styles/typography.css` (sizes are rem, so they follow the root size). Pages use the role, not raw size/weight/color combinations. Approved in review, November 2026; the before/after reference lives in the "StoneSuite Type Redesign" artifact.

### Roles (laptop sizes)
| Role | Class | Size / weight | Notes |
|---|---|---|---|
| Page title | `type-page-title` | 23.5px / 600, -0.02em | Title Case |
| Page subtitle | `type-page-subtitle` | 13px / 400 muted | |
| Sign-in title | `type-display` | 26px / 400 brand font | Title Case; sign-in, onboarding cards |
| KPI figure | `type-kpi` | 28px / 700, tabular | Currency symbol smaller and muted (`type-kpi-currency`: 60%, 500, ink-muted) |
| Dialog / section title | `type-dialog-title` | 15px / 600 | Title Case |
| Card title | `type-card-title` | 14px / 600 | Title Case |
| Dialog message | `type-dialog-body` | 12.5px / 400 | |
| Body | `type-body` | 14px / 400 | Links inherit 14px (`type-link`) |
| Field label | `type-field-label` | 13px / 500 | |
| Typed text | `type-input` | 13px; **16px on touch screens** | Stops iOS/iPadOS Safari zooming into fields |
| Helper / error | `type-helper` / `type-error` | 12px / 400 | Error in danger-ink, with an icon |
| Table header | `type-th` | 12px / 600 caps, 0.05em | |
| Table text | `type-cell` / `type-cell-strong` | 12px / 400 · 600 | Names (vendor, customer) and amounts bold |
| Line under a value | `type-subline` | 11px / 400 muted | e.g. the email under a vendor |
| Record number | `type-record-id` | IBM Plex Mono 12px / 400 | Never bold |
| Status pill | `type-pill` / `StatusPill` | 12px / 500 | Tinted from the status color |
| Change vs last period | `type-delta` | 12px / 600 | Light green/amber pill with arrow |
| KPI label / overline | `type-overline` | 11px / 600 caps, 0.06em | |
| Sidebar item | `type-nav-item` | 12.5px / 600 | Casing as written |
| Sidebar section | `type-nav-section` | 12px / 600, ink | Casing as written |
| Notification | `type-toast-title` / `type-toast-body` | 14px / 500 green · 13px / 400 | Success keeps its green background |
| "Workspace portal" | `type-portal` | 10px / 700 caps, 0.35em | Decorative only |

### Screen sizes
Text keeps the same size on phones, tablets and laptops; only the page title (20 → 22 → 23.5px), sign-in title (22 → 24 → 26px) and KPI figure (24 → 26 → 28px) step down on small screens. Large monitors scale everything through the root size (106.25% at 1920px, 116.7% at 2560px, 125% at 3840px), set as a percentage so the user's browser text size still applies.

### Named Rules
**The One Family Rule.** All UI text uses Geist Variable. All Round Gothic is a brand accent (wordmark, sign-in titles), never bold, never in tables, labels or buttons. IBM Plex Mono is for record numbers, IDs and code.

**The Title Case Rule.** Titles (page, card, section, dialog, sign-in) use Title Case. Labels, buttons, menu items, messages, tooltips and sentences keep sentence case.

**The Role Rule.** Use a `type-*` role or a scale size (`text-micro` 11 · `text-caption` 12 · `text-button` 12.5 · `text-field` 13 · `text-body` 14). No `text-2xs`, no `text-[Npx]`, no `tracking-[…]`, no `text-red-*`/`text-destructive` text, no raw gray text (`text-stone-400`…`900`; use `text-ink-*`) — ESLint enforces this (`eslint.config.js`, "Design system guardrails").

## 4. Elevation

StoneSuite is flat by default. Depth is conveyed through tonal layering: the stone-100 (`#f7f7f7`) sidebar sits slightly behind the stone-background (`#fafaf9`) main area; cards lift through a white fill against the warm canvas; modals use a semi-transparent backdrop.

Shadows are reserved for floating elements (dropdowns, tooltips, popovers) and hover states on interactive cards. They are ambient and diffuse — never dark or structural.

### Shadow Vocabulary
- **Ambient low** (`0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`): Default card hover, popover containers. Barely perceptible — just enough to lift.
- **Ambient medium** (`0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)`): Modals, dropdown menus, floating panels.
- **Focus ring** (`0 0 0 2px #c2f589`): Keyboard focus indicator on interactive elements. Lime-green, 2px offset ring.

### Named Rules
**The Flat-By-Default Rule.** Every surface starts flat. Shadows appear only in response to state: hover lifts a card with ambient-low; a floating menu uses ambient-medium; a focused input uses the lime focus ring. No decorative shadows on static elements.

## 5. Components

### Buttons
One shared component (`components/ui/button.tsx`, or `buttonVariants()` for links and native buttons) — never hand-built button classes.

- **Kinds:** primary (lime `#c2f589`, ink-strong text, 600) · secondary/outline (white, `#d4d0cc` border, ink text, 500) · danger (`#dc2626`, white text, 600) · text-only/ghost (no border, ink text, 500, stone-100 hover).
- **Sizes:** small 26px (dialogs, table rows) · default 30px (everywhere else) · large 38px / 14px text (one-action screens: billing, onboarding). All other sizes use 12.5px text.
- **Sign-in button:** large, 44px tall, full width (`SIGN_IN_BUTTON`).
- **Touch screens:** every button is at least 40px tall.
- **No glow shadows,** no per-page padding or font overrides. Deliberate tones (e.g. amber Hold, red-outline Inactivate) keep their colors but use the approved size.
- **Disabled:** 50% opacity. Never change shape or size.

### Cards / Containers
- **Corner Style:** Rounded (14px, `rounded-xl`)
- **Background:** White (`#ffffff`) on stone-warm canvas
- **Shadow Strategy:** None at rest; ambient-low on hover for interactive cards
- **Border:** Stone-300 (`#e8e8e8`) 1px border, optional — use only where the card edge needs definition against a white parent
- **Internal Padding:** 16px standard, 24px for data-dense panels

### Inputs / Fields
- **Style:** White fill, stone-300 border (1px), 10px radius
- **Focus:** Lime focus ring (2px, `#c2f589`) + border brightens to stone-500
- **Typed text:** 13px (`type-input`), 16px on touch screens
- **Placeholder:** ink-muted (`#6b6560`)
- **Error:** Destructive-red border + 12px error message below in danger-ink (`#b42318`) with an icon
- **Disabled:** Stone-100 fill, stone-400 text, no interaction feedback

### Navigation (Sidebar)
- **Background:** Stone-100 (`#f7f7f7`)
- **Active item:** Lime-green background fill (`#ecfccb`), accent lime text (`#365314`), 8px radius
- **Hover:** Stone-200 background tint, 150ms ease
- **Items:** 12.5px Geist 600 (`type-nav-item`), ink. Active: accent lime text on lime-light.
- **Section labels:** 12px 600 in ink `#44403c`, 0.025em (`type-nav-section`), in their written casing (not capitals).
- **Collapsed state:** Icon-only, 40px width; tooltip on hover

### Form Tab Bar
- **Background:** Teal (`#2c6e7f`)
- **Active tab:** White text, bottom border indicator in lime (`#c2f589`)
- **Inactive tab:** White/70 opacity text
- **Used in:** Multi-section prospect/lead forms

### Status Chips / Tags
- **Status pill:** `StatusPill` (`components/ui/StatusPill.tsx`) — 12px Geist 500, 10% tint of the status color, text darkened from the same color, optional dot. The status color is the only inline value (as a `--pill` CSS variable).
- **Default:** Stone-100 background, ink text, 6px radius, 12px Geist 500
- **Active/success:** Accent lime light (`#ecfccb`) background, accent lime text (`#365314`)
- **Warning/pending:** Amber-50 background, amber-700 text
- **Error:** Destructive-red/10 background, destructive text

## 6. Do's and Don'ts

### Do:
- **Do** use `#fafaf9` as the page background on every screen. The warm canvas is non-negotiable.
- **Do** reserve the lime accent (`#c2f589`) for primary buttons, active nav items, and focus rings only. Maximum one prominent lime element per visible region.
- **Do** use All Round Gothic only at display scale (30px+) for brand moments and empty state headers.
- **Do** include all five interactive states on every component: default, hover, focus, active/selected, disabled.
- **Do** use 150–250ms ease transitions for all state changes. Anything slower feels sluggish for a task-focused tool.
- **Do** pair color-coded states with an icon or text label. Never communicate state by color alone.
- **Do** use skeleton loading states instead of spinners inside content areas.
- **Do** write empty states that teach the interface — explain what will appear here and how to create it.

### Don't:
- **Don't** use the lime accent as a background fill for non-interactive surfaces, section headers, or decorative stripes.
- **Don't** use pure white (`#ffffff`) as the page background. Cards can be white; the canvas must be warm stone.
- **Don't** build the "bloated tab-heavy overwhelm" of Salesforce/HubSpot. One primary action per screen. Progressive disclosure for everything else.
- **Don't** ship the generic shadcn-default look. The warm palette, All Round Gothic display headers, and lime accent are what differentiate this product — do not sand them down.
- **Don't** use modal dialogs as the first solution. Exhaust inline, drawer, and progressive alternatives before reaching for a modal.
- **Don't** use display fonts (All Round Gothic) in buttons, form labels, or table cells. Geist is the UI font.
- **Don't** use decorative motion. Transitions communicate state change, loading, or reveal — nothing else. No entrance animations for static content.
- **Don't** mix the lime accent with the teal tab color on the same surface. They are complementary accents from different contexts.
- **Don't** use font sizes below 11px. The only exception is the decorative "Workspace portal" label (10px).
- **Don't** write inline `style={}` for fixed values. Inline styles are only for values computed at runtime (status colors, progress widths, popup positions).
