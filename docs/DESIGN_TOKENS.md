# Design Tokens Guide

## Overview

Magneetar uses [Design Tokens](https://www.designtokens.org/) to maintain a single source of truth for design decisions across Figma, code, and documentation.

## Architecture

```
Figma (Tokens Studio)
        ↓
figma-tokens.json (W3C DTCG format)
        ↓
Style Dictionary
        ↓
┌───────┴───────┐
│               │
CSS Variables   Tailwind Theme
│               │
└───────┬───────┘
        ↓
   Components
```

## Workflow

### 1. Design in Figma

Designers use the [Tokens Studio](https://tokens.studio/) plugin to manage tokens:

1. Open Figma
2. Install Tokens Studio plugin
3. Create/edit tokens in the plugin
4. Export as JSON (W3C DTCG format)

### 2. Export Tokens

In Tokens Studio:

1. Click **Export** button
2. Select **JSON (W3C DTCG)** format
3. Save to `src/styles/tokens/figma-tokens.json`

### 3. Sync to Code

Run the sync script:

```bash
# Sync tokens
make tokens-sync

# Or manually
cd dashboard
node scripts/sync-figma-tokens.js
```

### 4. Build Tokens

Generate CSS variables and Tailwind theme:

```bash
# Build tokens
make tokens-build

# Or manually
cd dashboard
node config/style-dictionary.js
```

## Token Categories

### Colors

#### Brand Colors
```json
{
  "color": {
    "brand": {
      "primary": { "$value": "#3b82f6" },
      "primary-hover": { "$value": "#2563eb" }
    }
  }
}
```

**Usage:**
```tsx
<Button className="bg-brand-primary">Click me</Button>
<Button className="bg-brand-primary-hover">Hover me</Button>
```

#### Semantic Colors
```json
{
  "color": {
    "semantic": {
      "success": { "$value": "#22c55e" },
      "warning": { "$value": "#f59e0b" },
      "danger": { "$value": "#ef4444" },
      "info": { "$value": "#0ea5e9" }
    }
  }
}
```

**Usage:**
```tsx
<StatusIndicator status="online" className="text-success" />
<StatusIndicator status="warning" className="text-warning" />
<StatusIndicator status="stolen" className="text-danger" />
```

#### Neutral Colors
```json
{
  "color": {
    "neutral": {
      "50": { "$value": "#fafafa" },
      "100": { "$value": "#f5f5f5" },
      ...
      "950": { "$value": "#0a0a0a" }
    }
  }
}
```

**Usage:**
```tsx
<div className="bg-neutral-950 text-neutral-50">Dark background</div>
<div className="bg-neutral-100 text-neutral-900">Light background</div>
```

### Spacing

```json
{
  "spacing": {
    "1": { "$value": "4px" },
    "2": { "$value": "8px" },
    "4": { "$value": "16px" },
    "6": { "$value": "24px" },
    "8": { "$value": "32px" }
  }
}
```

**Usage:**
```tsx
<div className="p-4">16px padding</div>
<div className="m-6">24px margin</div>
<div className="gap-2">8px gap</div>
```

### Typography

```json
{
  "fontSize": {
    "xs": { "$value": "12px" },
    "sm": { "$value": "14px" },
    "base": { "$value": "16px" },
    "lg": { "$value": "18px" },
    "xl": { "$value": "20px" },
    "2xl": { "$value": "24px" }
  },
  "fontWeight": {
    "normal": { "$value": "400" },
    "medium": { "$value": "500" },
    "semibold": { "$value": "600" },
    "bold": { "$value": "700" }
  }
}
```

**Usage:**
```tsx
<h1 className="text-2xl font-bold">Heading</h1>
<p className="text-base font-normal">Body text</p>
<small className="text-sm font-medium">Caption</small>
```

### Border Radius

```json
{
  "borderRadius": {
    "sm": { "$value": "4px" },
    "md": { "$value": "8px" },
    "lg": { "$value": "12px" },
    "xl": { "$value": "16px" },
    "full": { "$value": "9999px" }
  }
}
```

**Usage:**
```tsx
<div className="rounded-md">8px radius</div>
<div className="rounded-full">Circle/Pill</div>
```

### Shadows

```json
{
  "shadow": {
    "sm": { "$value": "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
    "md": { "$value": "0 4px 6px -1px rgb(0 0 0 / 0.1)" },
    "lg": { "$value": "0 10px 15px -3px rgb(0 0 0 / 0.1)" }
  }
}
```

**Usage:**
```tsx
<div className="shadow-sm">Subtle shadow</div>
<div className="shadow-lg">Prominent shadow</div>
```

### Transitions

```json
{
  "transition": {
    "duration": {
      "fast": { "$value": "150ms" },
      "normal": { "$value": "200ms" },
      "slow": { "$value": "300ms" }
    }
  }
}
```

**Usage:**
```tsx
<button className="transition-all duration-fast">Fast transition</button>
<button className="transition-all duration-slow">Slow transition</button>
```

## CSS Variables

Tokens are also available as CSS custom properties:

```css
:root {
  --color-brand-primary: #3b82f6;
  --color-semantic-success: #22c55e;
  --spacing-4: 16px;
  --font-size-base: 16px;
}
```

**Usage in CSS:**
```css
.custom-button {
  background-color: var(--color-brand-primary);
  padding: var(--spacing-4);
  font-size: var(--font-size-base);
}
```

## TypeScript Constants

Tokens are available as TypeScript constants:

```typescript
import { ColorBrandPrimary, Spacing4 } from '@/styles/generated/tokens';

const style = {
  backgroundColor: ColorBrandPrimary,
  padding: Spacing4,
};
```

## Updating Tokens

### From Figma

1. Edit tokens in Tokens Studio
2. Export JSON
3. Replace `src/styles/tokens/figma-tokens.json`
4. Run `make tokens-sync`
5. Run `make tokens-build`

### Manual Edit

1. Edit `src/styles/tokens/figma-tokens.json` directly
2. Run `make tokens-build`

### Add New Token

1. Add to `figma-tokens.json`:
```json
{
  "color": {
    "custom": {
      "new-color": {
        "$value": "#ff0000",
        "$type": "color"
      }
    }
  }
}
```

2. Run `make tokens-sync && make tokens-build`

3. Use in code:
```tsx
<div className="text-custom-new-color">New color</div>
```

## Best Practices

### 1. Use Semantic Names

```json
// ✅ Good - semantic
"semantic": {
  "success": { "$value": "#22c55e" }
}

// ❌ Bad - literal
"green": { "$value": "#22c55e" }
```

### 2. Use References

```json
// ✅ Good - references base token
"background": {
  "card": { "$value": "{color.neutral.800}" }
}

// ❌ Bad - hardcoded
"background": {
  "card": { "$value": "#262626" }
}
```

### 3. Document Tokens

```json
{
  "color": {
    "semantic": {
      "success": {
        "$value": "#22c55e",
        "$type": "color",
        "$description": "Success state - online devices, completed actions"
      }
    }
  }
}
```

### 4. Group Logically

```json
{
  "color": {
    "brand": { ... },
    "semantic": { ... },
    "neutral": { ... }
  }
}
```

## Troubleshooting

### Tokens Not Updating

1. Check `figma-tokens.json` is valid JSON
2. Run `make tokens-build`
3. Restart dev server

### CSS Variables Missing

1. Check `src/styles/generated/tokens.css` exists
2. Import in `globals.css`:
```css
@import './styles/generated/tokens.css';
```

### Tailwind Classes Not Working

1. Check `tailwind-theme.json` exists
2. Merge into `tailwind.config.ts`
3. Restart dev server

## Resources

- [W3C Design Tokens Format](https://design-tokens.github.io/community-group/format/)
- [Tokens Studio](https://tokens.studio/)
- [Style Dictionary](https://amzn.github.io/style-dictionary/)
- [Tailwind CSS](https://tailwindcss.com/)
