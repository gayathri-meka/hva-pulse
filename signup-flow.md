# HVA Learner Sign-Up Flow — UI Design Document

This document defines the screens, components, and UX principles for the HVA learner sign-up flow inside Pulse. Claude Code should read this before building any part of this flow.

---

## Design philosophy

This flow is for first-generation tech learners, many of whom are signing up for a structured programme for the first time. Every screen must be:

- **Idiot-proof**: one action per screen, zero ambiguity about what to do next
- **Warm and encouraging**: the tone is a supportive coach, not a cold form
- **Mobile-first, desktop-friendly**: designed for a 375px phone but scales gracefully to laptop
- **Status-transparent**: the learner always knows where they are in the journey and what comes next
- **Low-anxiety**: never show the full form length upfront; reveal steps progressively

---

## Visual language

### Fonts
- **Headings and hero text**: `Plus Jakarta Sans` — weights 700, 800, 900
- **Body, labels, buttons**: `Nunito` — weights 400, 600, 700, 800

Import via Google Fonts:
```
https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap
```

### Colour palette

| Role | Value | Usage |
|---|---|---|
| Brand green (primary) | `#16a34a` | CTAs, active states, progress fills |
| Brand dark | `#0f1f0f` | Hero backgrounds, celebration banners |
| Green tint | `#f0fdf4` | Card backgrounds for completed/positive states |
| Green border | `#bbf7d0` | Borders on positive state cards |
| Green text | `#166534` | Text on green tint backgrounds |
| Blue tint | `#eff6ff` / `#dbeafe` | Info callouts |
| Amber tint | `#fffbeb` / `#fef9c3` | Warning callouts |
| Red tint | `#fee2e2` | Error/missed states |
| Gray light | `#f3f4f6` | Locked/disabled states |
| White | `#ffffff` | Card surfaces |
| Background | `#f5f7f5` | Page background |

### Status pills (`.pill`)
Inline status badges. Always use these classes — never invent custom ones.

```css
.pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; line-height:1.4; }
.pill-g  { background:#dcfce7; color:#166534; }   /* success / done */
.pill-b  { background:#dbeafe; color:#1e40af; }   /* info / in-progress */
.pill-y  { background:#fef9c3; color:#854d0e; }   /* pending / warning */
.pill-r  { background:#fee2e2; color:#991b1b; }   /* error / overdue */
.pill-gr { background:#f3f4f6; color:#374151; }   /* neutral / locked */
.pill-o  { background:#fff7ed; color:#9a3412; }   /* missed */
```

### Cards (`.gcard`)
The primary content container. White background, rounded corners, subtle border.
```css
.gcard { background:#fff; border-radius:20px; padding:18px; border:0.5px solid #e5e7eb; margin-bottom:12px; }
```

### Buttons

**Primary (`.btn-main`)** — full-width, green, for the single main action per screen:
```css
.btn-main { width:100%; padding:13px; background:#16a34a; color:#fff; border:none; border-radius:14px; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; cursor:pointer; }
```

**Outline (`.btn-out`)** — secondary action:
```css
.btn-out { width:100%; padding:12px; background:transparent; color:#16a34a; border:2px solid #16a34a; border-radius:14px; font-family:'Nunito',sans-serif; font-weight:800; font-size:14px; cursor:pointer; }
```

**Dark CTA** — used on hero/dark backgrounds: same as `.btn-main` but `background:#0f1f0f`

**Small action button** (inline, not full-width):
```css
background:#16a34a; color:#fff; border:none; border-radius:10px; padding:7px 14px; font-family:'Nunito',sans-serif; font-weight:700; font-size:12px;
```

### Progress bar (`.pg-bar` / `.pg-fill`)
```css
.pg-bar  { height:7px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
.pg-fill { height:100%; background:#16a34a; border-radius:999px; }
```

### Journey stage node (`.snode`)
36×36 circle used in vertical stage timelines.
```css
.snode      { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0; }
.snode-done { background:#dcfce7; color:#166534; border:2px solid #16a34a; }  /* completed */
.snode-now  { background:#16a34a; color:#fff;    border:2px solid #15803d; }  /* current */
.snode-lock { background:#f3f4f6; color:#d1d5db; border:2px solid #e5e7eb; } /* future */
```
Connect stage nodes with a `2px` vertical connector line: green (`#16a34a`) for completed segments, gray (`#e5e7eb`) for future.

### Icon library
Use **Tabler Icons** (`@tabler/icons-react` or CDN). Reference icon names with `ti-` prefix. Common icons in this flow:
- `ti-rocket` — welcome/launch
- `ti-circle-check` — completed
- `ti-arrow-right` — current/next
- `ti-lock` — locked future step
- `ti-alert-triangle` — action needed
- `ti-brand-google` — Google sign-in
- `ti-user` — personal info
- `ti-phone` — contact
- `ti-school` — education
- `ti-briefcase` — work/career
- `ti-check` — tick
- `ti-chevron-right` — forward navigation

---

## Layout and spacing

### Mobile (≤640px)
- Page background: `#f5f7f5`
- Horizontal padding: `16px` on all screen containers
- Bottom padding on scroll containers: `24px`
- Card gap: `12px`

### Desktop (>640px)
- Centre-align the content column with `max-width: 480px; margin: 0 auto`
- Increase page padding to `32px 24px`
- Cards get slightly more padding (`24px`)
- Sticky top bar remains but gets more breathing room

### Topbar (sticky, white)
```css
.topbar { padding:12px 16px; background:#fff; border-bottom:0.5px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:9; }
```
Topbar contains: back arrow (left) + step label or screen title (centre or left) + optional right element.

---

## Form input components

### Text input
```css
.field-wrap { margin-bottom:20px; }
.field-label { display:block; font-size:13px; font-weight:700; color:#374151; margin-bottom:6px; }
.field-input {
  width:100%; padding:13px 14px; border-radius:12px;
  border:1.5px solid #e5e7eb; background:#fff;
  font-family:'Nunito',sans-serif; font-size:15px; color:#111827;
}
.field-input:focus { border-color:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.12); outline:none; }
.field-input.error { border-color:#ef4444; }
.field-hint { font-size:12px; color:#6b7280; margin-top:5px; line-height:1.4; }
.field-error { font-size:12px; color:#ef4444; margin-top:5px; font-weight:600; }
```

### Chip select (single or multi)
```css
.chip-group { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.chip-option {
  padding:8px 14px; border-radius:10px; font-family:'Nunito',sans-serif;
  font-size:13px; font-weight:700; cursor:pointer;
  background:#f3f4f6; color:#374151; border:1.5px solid transparent;
}
.chip-option.selected { background:#dcfce7; color:#166534; border-color:#16a34a; }
```

### Large option card (binary choice)
```css
.option-card {
  padding:14px 16px; border-radius:14px; border:1.5px solid #e5e7eb;
  background:#fff; cursor:pointer; display:flex; align-items:center; gap:12px;
}
.option-card.selected { border-color:#16a34a; background:#f0fdf4; }
.option-card-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.option-card-title { font-size:14px; font-weight:800; color:#111827; }
.option-card-sub { font-size:12px; color:#6b7280; margin-top:2px; line-height:1.4; }
```

### Textarea
```css
.field-textarea {
  width:100%; min-height:100px; padding:13px 14px; border-radius:12px;
  border:1.5px solid #e5e7eb; background:#fff;
  font-family:'Nunito',sans-serif; font-size:14px; color:#111827;
  resize:none; line-height:1.6;
}
.field-textarea:focus { border-color:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.12); outline:none; }
```

---


## UX rules Claude Code must follow

1. **One primary CTA per screen.** Never two green buttons. Secondary actions (edit, back) are text or outline style.
2. **Disable the CTA until required fields are complete.** Disabled state: `background:#d1d5db; cursor:not-allowed`. Never show an error on load — only after the user has interacted with a field.
3. **Inline validation**, not on-submit. Show errors as soon as the user leaves a field (onBlur), not when they click submit.
4. **Never show all steps at once.** The learner sees only the current screen. Progress bar tells them where they are.
5. **Save progress to localStorage** after each step so a page refresh doesn't lose data.
6. **Mobile tap targets**: all buttons, chips, and option cards must be at least 44px tall.
7. **Google Sign-In on Screen 0 only.** After auth, pre-fill name and email on Screen 1 if available from the Google profile.
8. **Loading/processing states**: any async action (form submit, eligibility check) must show a visible loading state on the button (spinner + "Please wait…") and must disable the button to prevent double-submit.
9. **Back navigation**: screens 1–4 have a back arrow in the topbar. Tapping back retains all data entered on that screen.
10. **WhatsApp number field**: use `type="tel"` and validate for exactly 10 digits. Show helper text: "We'll send you updates on WhatsApp." Do not validate country code at this stage.
11. **Responsive breakpoint**: at >640px, constrain the content to `max-width:480px` centered, with the topbar spanning full width but content centred. Cards get `border-radius:24px` on desktop.
12. **Accessibility**: all icon-only buttons need `aria-label`. Status pills need `role="status"` where dynamic. Form labels must be associated with inputs via `htmlFor` / `id`.

---

## Tone and copy rules

- Use first-person warmly: "Hi Asha!" not "Hello, User"
- Use plain language. Assume the learner reads at a Class 10 level.
- Avoid jargon: "tech job" not "software engineering role", "daily task" not "module submission"
- Never use negative framing: "Late submission still possible" not "You missed this task"
- Use motivational micro-copy near CTAs: "You're doing great — just one more step", "Stay consistent — that matters more than being perfect"
- Use emoji sparingly and purposefully: 🚀 for launch moments, 🎉 for celebration, 🔥 for streaks

---

## Tech notes for implementation

- This flow lives at `/signup` or `/apply` route in Pulse (Next.js)
- Route is **public** (no auth required for screens 0–4; Google OAuth on screen 0 gates screens 5+)
- Store signup state in Supabase `applicants` table; columns map to form fields
- On Screen 5 (eligibility check), run server-side check against eligibility rules and return pass/fail
- After Screen 7, create the learner's Pulse account and redirect to `/dashboard`
- All screens should be server-side rendered with client-side interactivity for the form state
