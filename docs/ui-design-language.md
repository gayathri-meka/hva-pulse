# Pulse UI design language

This document defines the visual and interaction language for all Pulse UI. Every screen, component, modal, and table must follow these rules. When in doubt, refer here before making a design decision.

---

## Philosophy

Pulse is used daily by a small, focused team. The UI should feel calm, professional, and scannable — not impressive or decorative. Information density matters more than visual flair. When in doubt, do less.

---

## Colour

The primary accent is green: `#5BAE5B`. Use it for active tab underlines, focus rings, toggle on-states, sync status dots, and hover borders on add/connect buttons.

Semantic colours for **learning health data** (risk scores, metric thresholds, learner health status):

| Meaning | Colour |
|---|---|
| Good / improving | `#639922` |
| Warning / declining | `#EF9F27` |
| At risk / bad | `#E24B4A` |
| Neutral | `text-zinc-500` |

> **Placement pipeline badge colours are defined separately in CLAUDE.md and are not affected by this scheme.**

Never use colour decoratively. Every use of colour must encode meaning — status, state, or category. When a value is neutral, use `text-zinc-500`.

Background depth hierarchy:

| Layer | Token | Tailwind |
|---|---|---|
| Page background | `--color-background-tertiary` | `bg-zinc-100` |
| Card / panel | `--color-background-primary` | `bg-white` |
| Input / inset surface | `--color-background-secondary` | `bg-zinc-50` |

---

## Design token → Tailwind mapping

All design tokens in this document map to the following Tailwind classes. Use the Tailwind classes directly in code.

| Token | Tailwind |
|---|---|
| `--color-text-primary` | `text-zinc-900` |
| `--color-text-secondary` | `text-zinc-500` |
| `--color-background-primary` | `bg-white` |
| `--color-background-secondary` | `bg-zinc-50` |
| `--color-background-tertiary` | `bg-zinc-100` |
| `--color-border-tertiary` | `border-zinc-200` |
| `--color-border-secondary` | `border-zinc-300` |
| `--font-mono` | `font-mono` |
| `--border-radius-lg` (12px) | `rounded-xl` |
| `--border-radius-md` (8px) | `rounded-lg` |
| `--border-radius-xl` (16px) | `rounded-2xl` |

---

## Typography

| Element | Size | Weight | Colour |
|---|---|---|---|
| Page title | `text-2xl` (24px) | `font-bold` (700) | `text-zinc-900` |
| Section label | `text-xs` (12px) | `font-semibold` (600) | `text-zinc-500` — ALL CAPS, `tracking-wide` |
| Card title / name | `text-sm` (14px) | `font-semibold` (600) | `text-zinc-900` |
| Body / description | `text-sm` (14px) | `font-normal` (400) | `text-zinc-500` |
| Meta / timestamps | `text-xs` (12px) | `font-normal` (400) | `text-zinc-500` |
| Badges | `text-xs` (12px) | `font-medium` (500) | varies — see Badges section |
| Formula / code | `text-xs`–`text-sm` | `font-normal` (400) | `text-zinc-500 font-mono` |

Section labels (e.g. "CONNECTED SOURCES", "DEFINED METRICS") orient the user within a page. Never skip them when a page has multiple sections.

---

## Spacing

- Page padding: `p-8` (32px)
- Card internal padding: `px-4 py-4` (standard), `p-6` (modals)
- Gap between cards in a list: `gap-2` or `space-y-2` (8px)
- Gap between page sections: `space-y-6` (24px)
- Gap between form fields: `space-y-4` (16px)

Never let elements touch. Whitespace is how hierarchy is communicated.

---

## Borders and radius

All borders are `border border-zinc-200` at rest. On hover or focus, step up to `border-zinc-300`. Never use box shadows for elevation — borders alone define depth.

| Surface | Radius |
|---|---|
| Cards and modals | `rounded-xl` (12px) |
| Inputs, buttons, badges | `rounded-lg` (8px) |
| Modal overlay card | `rounded-2xl` (16px) |
| Pills and round badges | `rounded-full` |

---

## Cards

Cards are used for **configuration and workflow items** — data sources, metrics, learning cases, intervention steps. Cards use white background, 1px border, `rounded-xl`, and comfortable padding.

Interactive cards (clickable rows) have a hover state: `hover:bg-zinc-50 hover:border-zinc-300`.

Secondary actions (Edit, Delete) appear only on row hover using `opacity-0 group-hover:opacity-100`. This keeps list views clean at a glance.

> **Data tables (TanStack Table) are exempt from the card pattern.** See the Data Tables section below.

---

## Data Tables (TanStack Table)

Used for large structured datasets: learners, placements, alumni, applications. Always use TanStack Table v8 for these surfaces — never hand-rolled tables for data that needs sorting, filtering, or resizing.

**Standard table structure:**

```
Container:   overflow-hidden rounded-xl border border-zinc-200 shadow-sm
<thead>:     bg-zinc-50 border-b border-zinc-200
             text-xs font-medium uppercase tracking-wide text-zinc-500
<tbody>:     divide-y divide-zinc-100
Row hover:   hover:bg-zinc-50
```

**Required features for every data table:**
- Column sorting — clicking a header cycles asc / desc / unsorted
- Multi-select filter per column via `FilterDropdown` component
- Column visibility toggle (shows/hides columns via a dropdown)
- Column resizing — widths persisted to `localStorage` per table key
- Row count display — `text-sm text-zinc-500`, right-aligned below the table

Sort indicators are shown inline in the column header, right of the label. Filter pills or active filter counts are shown in the header button when filters are applied.

---

## Buttons

**Primary** — one per modal or page section. `bg-zinc-900 text-white rounded-lg`, no border. Used for Save, Confirm, and primary CTAs.

**Ghost** — `border border-zinc-200 text-zinc-600 rounded-lg bg-transparent hover:bg-zinc-50`. Used for Sync now, Edit, Cancel.

**Destructive** — plain text only, no border, no background. Default `text-red-400`, transitions to `text-red-600` on hover. Never styled prominently — it must require deliberate intent.

**Add / connect** — `border border-zinc-200 bg-white text-zinc-500 rounded-lg`. On hover: `border-zinc-300 text-zinc-700`. Always has a `+` icon. Used for the primary creation action in a panel (e.g. Add metric, Connect a sheet).

---

## Tabs

**Top-level** (e.g. Dashboard / Interventions / Settings): `text-sm`, inactive = `text-zinc-500`, active = `text-zinc-900 font-medium`, `h-0.5 bg-[#5BAE5B]` bottom underline absolutely positioned, flush with the `border-b` divider below.

**Sub-level** (e.g. Data Sources / Metrics): same pattern, `text-xs`.

Always underline-style tabs. Never background-coloured tabs or pill-shaped tab switchers.

---

## Form fields

```
bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800
focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1
```

On focus: ring becomes `ring-zinc-900`. No box shadows.

Field labels: `text-xs font-medium text-zinc-500 mb-1`.

Optional fields: append `— optional` inline in the label in `font-normal`. Not as separate helper text.

---

## Modals

Overlay: `bg-black/40`. Modal card: `rounded-2xl p-6 bg-white max-w-lg`.

Every modal must include:
1. A title — `text-base font-semibold text-zinc-900`
2. A subtitle — `text-sm text-zinc-500 leading-relaxed`. Explains what the user is doing. Never skip this.
3. Actions right-aligned at the bottom: Cancel (ghost) + primary action (solid dark)

---

## Aggregation selectors

For choosing from a fixed set of options (COUNT / SUM / AVG / MIN / MAX), use pill-shaped toggle buttons in a flex row — never a dropdown. Each pill at rest: `border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 rounded-full px-3 py-1`. Selected: `bg-zinc-900 text-white border-zinc-900`.

---

## Toggle switches

Toggles live inside a contained row: `bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3`. Toggle left, label and description right.

On-state track: `#5BAE5B`. Off-state track: `border-zinc-300`. Thumb always white.

---

## Badges

| Type | Background | Text |
|---|---|---|
| Tracked over time | `bg-[#EEEDFE]` | `text-[#3C3489]` |
| Single value | `bg-zinc-50 border border-zinc-200` | `text-zinc-500` |
| Synced / healthy | `bg-[#E1F5EE]` | `text-[#085041]` |
| Error / at risk | `bg-[#FCEBEB]` | `text-[#A32D2D]` |

All badges: `text-xs font-medium px-2.5 py-0.5 rounded-full`.

---

## Sync status dot

A `w-1.5 h-1.5 rounded-full` circle. Always inline with meta text.

| State | Class |
|---|---|
| Recently synced | `bg-[#5BAE5B]` |
| Never synced / stale | `bg-amber-400` |
| Sync error | `bg-[#E24B4A]` |

---

## Formula and preview text

Always `font-mono`. In list views: truncated with `truncate`. In modals and detail views: shown in full inside a preview box — `bg-zinc-50 rounded-lg px-3 py-2`, with a `text-xs font-semibold text-zinc-500 uppercase tracking-wide` label above it reading "PREVIEW".

---

## Source icons

Each data source card has a `36×36px` icon tile: `bg-[#E1F5EE] rounded-lg`. Icon is an SVG representing the source type, coloured `text-[#085041]`. Never use emoji or generic placeholder icons.

Source cards lay out as a single flex row: `[icon tile] [name + sync status] [row count] [tab name] [actions]`. The sync status line sits below the name and contains a sync status dot followed by the relative sync time or error text. Row count and tab are separate columns, each with a label (`text-xs text-zinc-400`) above and value below.

---

## Empty states

Every list that can be empty needs an empty state. Keep it minimal: one short sentence in `text-zinc-400` and an add/connect button. No illustrations.

---

## What not to do

- No gradients, shadows, blur, or glow effects (exception: `shadow-sm` on data table containers only)
- No colour for decoration — only for meaning
- Never use ALL CAPS except for section labels
- Never style destructive actions prominently
- Never skip section labels on pages with multiple sections
- Never use background-coloured or pill-shaped tab switchers
- Never use placeholder text as a substitute for a field label
- Never show secondary actions (Edit, Delete) unless the row is hovered
