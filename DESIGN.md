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
  stone-400: "#ababab"
  stone-500: "#787878"
  teal-tab: "#2c6e7f"
  destructive: "#d94f36"
typography:
  display:
    fontFamily: "All Round Gothic, Nunito, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono:
    fontFamily: "IBM Plex Mono, Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
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
    textColor: "{colors.stone-950}"
    rounded: "{rounded.base}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.brand-lime-hover}"
    textColor: "{colors.stone-950}"
  button-secondary:
    backgroundColor: "{colors.stone-100}"
    textColor: "{colors.stone-950}"
    rounded: "{rounded.base}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.stone-950}"
    rounded: "{rounded.base}"
    padding: "8px 16px"
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
- **Stone 400** (`#ababab`): Dividers and placeholder text.
- **Stone 500** (`#787878`): Muted body text, secondary labels, disabled states.
- **Destructive** (`#d94f36`): Errors and destructive actions only. Never repurposed.

### Named Rules
**The One Lime Rule.** The lime accent appears on ≤10% of any given screen. Buttons, active nav items, focus rings — that's the full list. Do not use it for decoration, section headers, or background fills. Its scarcity is what makes it communicate "action."

**The Warm Canvas Rule.** Never use pure white (`#ffffff`) as the page background. The stone-warm `#fafaf9` is the floor. Cards and modals can sit on white, but the canvas beneath is always warm.

## 3. Typography

**Display Font:** All Round Gothic (with Nunito fallback, then sans-serif)
**Body/UI Font:** Geist Variable (with system-ui, sans-serif fallbacks)
**Mono Font:** IBM Plex Mono (with Geist Mono, ui-monospace fallbacks)

**Character:** Geist Variable handles everything in the product UI — it is clean, technically precise, and readable at dense sizes. All Round Gothic appears only at display scale: page titles, empty state callouts, and brand-facing surfaces. The combination is warm without being casual, structured without being cold.

### Hierarchy
- **Display** (All Round Gothic, 400, 30px / 1.2): Page-level display only. Section titles in marketing-facing views, empty state headers, brand callouts. Never in data tables or form labels.
- **Headline** (Geist Variable, 600, 20px / 1.3): Screen-level headings. Sidebar section headers, modal titles, card headers.
- **Title** (Geist Variable, 600, 16px / 1.4): Component-level headings. Panel titles, tab labels, section headers within forms.
- **Body** (Geist Variable, 400, 14px / 1.5): Default text for all prose, descriptions, and data cells. Max line length 65ch for prose; data tables can run wider.
- **Label** (Geist Variable, 500, 11px / 1.4, +0.01em tracking): Form field labels, column headers, compact UI tags, status chips. Never below 11px.
- **Mono** (IBM Plex Mono, 400, 13px / 1.6): Code, IDs, tokens, API keys. Not for UI labels.

### Named Rules
**The One Family Rule.** All UI text uses Geist Variable. All Round Gothic is a display accent, not a body substitute. IBM Plex Mono is for code and data IDs. Mixing fonts in UI labels or buttons is forbidden.

**The Fixed Scale Rule.** No fluid/clamp sizing in the product UI. Users work at consistent DPI; a heading that shrinks in a narrow sidebar looks broken, not responsive. Responsive behavior is structural (collapsing panels), not typographic.

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
Clean, undecorated, state-rich. The primary action is lime-on-stone; everything else recedes.

- **Shape:** Gently curved (10px radius)
- **Primary:** Lime green background (`#c2f589`), stone-950 text. Padding 8px 16px. Font: Geist 14px 500.
- **Hover:** `#99c466` background, 150ms ease transition.
- **Focus:** 2px lime focus ring (`box-shadow: 0 0 0 2px #c2f589`).
- **Secondary:** Stone-100 background, stone-950 text. Same shape and padding.
- **Ghost:** Transparent background, stone-950 text. Subtle hover: stone-100 background.
- **Destructive:** Destructive red (`#d94f36`) background, white text.
- **Disabled:** 40% opacity on any variant. Never change shape or size.

### Cards / Containers
- **Corner Style:** Rounded (14px, `rounded-xl`)
- **Background:** White (`#ffffff`) on stone-warm canvas
- **Shadow Strategy:** None at rest; ambient-low on hover for interactive cards
- **Border:** Stone-300 (`#e8e8e8`) 1px border, optional — use only where the card edge needs definition against a white parent
- **Internal Padding:** 16px standard, 24px for data-dense panels

### Inputs / Fields
- **Style:** White fill, stone-300 border (1px), 10px radius
- **Focus:** Lime focus ring (2px, `#c2f589`) + border brightens to stone-500
- **Placeholder:** Stone-400 (`#ababab`)
- **Error:** Destructive-red border + error message below in destructive red, 12px Geist
- **Disabled:** Stone-100 fill, stone-400 text, no interaction feedback

### Navigation (Sidebar)
- **Background:** Stone-100 (`#f7f7f7`)
- **Active item:** Lime-green background fill (`#ecfccb`), accent lime text (`#365314`), 8px radius
- **Hover:** Stone-200 background tint, 150ms ease
- **Icon + label:** 14px Geist 500, stone-950. Active: accent lime text.
- **Collapsed state:** Icon-only, 40px width; tooltip on hover

### Form Tab Bar
- **Background:** Teal (`#2c6e7f`)
- **Active tab:** White text, bottom border indicator in lime (`#c2f589`)
- **Inactive tab:** White/70 opacity text
- **Used in:** Multi-section prospect/lead forms

### Status Chips / Tags
- **Default:** Stone-100 background, stone-950 text, 6px radius, 11px Geist 500
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
- **Don't** use font sizes below 11px for any visible label. 10px is captions only, never interactive labels.
