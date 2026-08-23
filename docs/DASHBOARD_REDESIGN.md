# Magneetar Dashboard Redesign Plan

## Research Findings (Top 1% Dashboards)

### Linear (Dark-First Power Tool)
- Quiet chrome, near-monochrome surfaces
- One accent color (green for active)
- Keyboard-first density
- Everything non-essential is simply absent
- Hierarchy from type weight and spacing, NOT color

### Stripe (Financial Dashboard)
- Tables as primary interface
- Right-aligned numerals, tabular figures
- Muted gridlines
- One hero metric visualized, everything else numeric
- Reserve color for meaning, not decoration

### Vercel (Monochrome Minimalism)
- Black-and-white design system
- Status colors (green/amber/red) carry all semantic weight
- Extreme restraint — nothing decorative

### Key Design Specs (from research)
- Sidebar: 256px expanded, 64px collapsed
- Nav items: 36px height, 12px padding, 8px border-radius
- Active state: 3px left border accent, 8% background opacity
- Metric cards: 200-280px wide, one primary number large (28-32px)
- Loading: skeleton screens, NOT spinners
- Empty states: illustration + single sentence + CTA
- Error states: red/amber banner with retry button

---

## Current Issues (From Screenshots)

### 1. Map Blank on Load
- Dynamic import of react-leaflet delays render
- No proper loading skeleton for map area
- Map container may not have dimensions on first render

### 2. Inconsistent Theme
- White sidebar + white right panel + dark map = jarring contrast
- Premium dashboards use UNIFIED dark theme throughout
- The "military grade" aesthetic demands dark-first design

### 3. Header Clutter
- Too many elements: brand, status, URL, disconnect, settings
- Premium dashboards have minimal chrome
- Linear: just logo + search + user avatar

### 4. Right Panel Design
- Tabs are 9px font — too small to read
- Command groups use white backgrounds against dark map
- No visual hierarchy between sections

### 5. Map Controls
- Buttons look like they're from a different design system
- Too many controls visible at once
- Premium apps show controls on demand, not always

---

## Redesign Plan

### Phase 1: Unified Dark Theme
- Make sidebar dark (bg-gray-900)
- Make header dark (bg-gray-900)
- Make right panel dark (bg-gray-900)
- Map stays dark (already is)
- Use gray-800 for card backgrounds
- Use gray-700 for borders
- Use gray-400 for secondary text
- Use white for primary text

### Phase 2: Fix Map Loading
- Add proper loading skeleton for map area
- Use useEffect to initialize map after mount
- Add error boundary for map failures

### Phase 3: Simplify Header
- Remove URL display (move to settings)
- Remove redundant status indicators
- Keep: logo, connection status, alerts, settings, disconnect

### Phase 4: Premium Right Panel
- Increase tab font to 11px
- Use dark backgrounds for command groups
- Add subtle borders for section separation
- Use green/amber/red for status only

### Phase 5: Map Controls
- Show controls on hover/tap only
- Group related controls
- Use consistent dark theme buttons

---

## Color Palette (Dark Theme)

```
Background:     #0a0a0f (darkest)
Surface:        #111827 (gray-900)
Card:           #1f2937 (gray-800)
Border:         #374151 (gray-700)
Secondary Text: #9ca3af (gray-400)
Primary Text:   #f9fafb (gray-50)
Accent:         #10b981 (emerald-500)
Warning:        #f59e0b (amber-500)
Danger:         #ef4444 (red-500)
Info:           #3b82f6 (blue-500)
```

---

## Implementation Priority

1. **Fix map blank on load** (critical UX issue)
2. **Unify dark theme** (biggest visual impact)
3. **Simplify header** (reduce cognitive load)
4. **Premium right panel** (professional look)
5. **Map controls** (on-demand visibility)
