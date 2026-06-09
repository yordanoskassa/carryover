# Design

## Theme

Dark product interface. Near-black zinc surfaces with emerald accent for primary actions and trust signals. Restrained color strategy: tinted neutrals + one accent. Color appears only for actions, state, and semantic meaning (risk verdicts, evidence types).

## Colors

### Surfaces
- `--surface-0`: #09090b (body background)
- `--surface-1`: #0c0c0f (cards, panels, header)
- `--surface-2`: #141418 (inputs, nested containers)
- `--surface-3`: #1c1c22 (active states, elevated elements)

### Borders
- `--border`: rgba(255, 255, 255, 0.06) (default)
- `--border-hover`: rgba(255, 255, 255, 0.1) (hover/focus)

### Text
- `--text-primary`: #fafafa (headings, important values)
- `--text-secondary`: #a1a1aa (body text, descriptions)
- `--text-muted`: #52525b (labels, metadata, placeholders)

### Semantic
- `--accent`: #10b981 (emerald, primary actions, positive states)
- `--accent-hover`: #34d399 (emerald hover)
- `--danger`: #ef4444 (red, high risk, errors, destructive actions)
- `--warning`: #f59e0b (amber, medium risk, caution)

### Evidence types
- Semantic Match: orange-400 (#fb923c)
- Policy Contradiction: red-400 (#f87171)
- Identity Reuse: violet-400 (#a78bfa)
- Category Match: amber-400 (#fbbf24)

### Risk verdicts
- LOW: emerald (#10b981)
- MEDIUM: amber (#f59e0b)
- HIGH: red (#ef4444)
- CRITICAL: red-600 (#dc2626)

## Typography

### Font stack
- Primary: Geist, system-ui, -apple-system, sans-serif
- Mono: Geist Mono (data values, phone numbers, confidence scores)

### Scale
- Page headings: text-2xl (24px), font-semibold, tracking-tight
- Section headings: text-base (16px), font-semibold
- Body: text-sm (14px), font-normal, leading-relaxed, max-w-[65ch]
- Labels: text-xs (12px), font-medium, uppercase, tracking-wider
- Metadata: text-xs (12px), font-normal
- Data values: tabular-nums, font-mono

## Components

### Cards / Panels
- Background: var(--surface-1)
- Border: 1px solid var(--border)
- Radius: rounded-xl (12px)
- Padding: p-5 (20px)
- Hover: border-[var(--border-hover)]

### Form inputs
- Background: var(--surface-2)
- Border: 1px solid var(--border)
- Radius: rounded-lg (8px)
- Padding: px-3 py-2.5
- Focus: border-emerald-500/50
- Text: var(--text-primary), text-sm

### Primary buttons
- Background: emerald-500 solid
- Text: zinc-950 (dark on light)
- Radius: rounded-lg (8px)
- Active feedback: active:scale-[0.98]
- Disabled: opacity-50

### Danger buttons
- Background: red-500 solid
- Text: white
- Same radius and feedback as primary

### Ghost / outline buttons
- Border: 1px solid, tinted to context
- Background: transparent, hover fills lightly
- Text: matches border color

### Tables
- Header: text-[11px], uppercase, tracking-wider, font-medium
- Rows: border-t border-[var(--border)]
- Hover: bg-[var(--surface-2)]/50
- Data cells: font-mono tabular-nums for numbers

## Layout

### Container
- Max width: 1400px
- Padding: px-5
- Centered: mx-auto

### Header
- Height: 64px (h-16)
- Sticky, z-50
- Backdrop blur: backdrop-blur-xl
- Background: var(--surface-1)/90

### Spacing
- Section gaps: space-y-8 (32px)
- Card internal: p-5 (20px)
- Form groups: gap-4 (16px)

## Motion

Transitions only. No orchestrated load sequences. State-conveying, not decorative.

- Default transition: 150-200ms, ease-out
- AnimatePresence for mount/unmount (error messages, results appearing)
- No staggered load animations on static content
- Reduced motion: all animations collapse to instant via prefers-reduced-motion

## Icons

Phosphor Icons, bold weight. One family throughout. Sized contextually:
- Navigation: 18px
- Inline with text: 13-14px
- Empty states: 32px, thin weight
- Stat card accents: 16px
