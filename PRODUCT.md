# Product

## Register

product

## Users

Two overlapping personas who often share the same screen:

- **Sales & BD reps** — opening the app to move a lead forward, log an update, or fill in a form. They are in flow; they need fast, frictionless data entry and clear pipeline state.
- **Managers & business owners** — reviewing pipeline health, checking team activity, approving or reassigning records. They are in overview mode; they need legible summaries and quick drill-down.

Both groups are non-technical SMB professionals. They trust familiar app patterns and distrust anything that feels unfamiliar or slow.

## Product Purpose

StoneSuite is a multi-tenant, white-label CRM platform. It lets businesses manage leads, prospects, and customers through dynamic, configurable workflows — without needing a developer. The platform owner (Skookum) sells it to tenants who each get a fully isolated workspace with custom fields, roles, and state machines.

Success looks like: a tenant's team adopts the tool without training, moves records through their pipeline without friction, and trusts the data they see.

## Brand Personality

Warm, approachable, modern. Friendly but capable — like Attio or Clay. Three words: **grounded, clear, alive**.

The lime-green brand accent (`#c2f589`) and warm stone neutrals (`#fafaf9` / `#1c1917`) already set a personality that is neither cold-enterprise nor playful-consumer. That balance should be protected and extended.

## Anti-references

- **Salesforce / HubSpot**: Bloated, tab-heavy, overwhelmed with options. StoneSuite should feel focused — one clear action at a time.
- **Generic SaaS**: Cookie-cutter shadcn/bootstrap look with no personality. The warm palette and brand font (All Round Gothic) are differentiators — don't let them go unused.

## Design Principles

1. **The tool disappears into the task.** Users are in a workflow, not admiring the UI. Every interaction should feel as short as possible.
2. **Warmth is structural, not decorative.** The lime accent and stone neutrals are not cosmetic — they signal approachability. Use them purposefully, not just for buttons.
3. **Clarity at density.** CRM data is dense. Typography hierarchy and spacing matter more than whitespace. Information should be scannable at a glance.
4. **Consistent affordances across surfaces.** StoneSuite is a white-label product — predictability is a feature. The same button, the same form control, the same icon everywhere.
5. **Progressive disclosure.** The workflow engine is powerful and configurable. The UI should show what's needed now, not everything at once.

## Accessibility & Inclusion

Target: **WCAG 2.1 AA**.

- Minimum 4.5:1 contrast for text, 3:1 for UI components and focus indicators.
- Full keyboard navigation across all interactive elements.
- Screen reader support via proper ARIA labels and landmark roles.
- Reduced motion support via `prefers-reduced-motion` on all animations.
- No color-only state communication — always pair with icon or text.
