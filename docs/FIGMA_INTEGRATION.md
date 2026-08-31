# Figma Integration Guide

## Overview

Magneetar integrates with Figma for seamless design-to-code workflow using:

1. **Storybook Connect Plugin** - View live stories in Figma
2. **Design Tokens** - Sync design decisions to code
3. **Custom Storybook Addon** - View Figma links in Storybook

## Architecture

```
Figma (Design)
    ↓
┌───┴───┐
│       │
Tokens  Connect Plugin
│       │
↓       ↓
Code    Storybook
```

## Setup

### 1. Install Storybook Connect Plugin

1. Open Figma
2. Go to **Plugins → Browse plugins**
3. Search for "Storybook Connect"
4. Install the plugin

### 2. Configure Storybook

The custom addon is already configured in `.storybook/main.ts`:

```typescript
addons: [
  // ... other addons
  "./.storybook/addon-figma-designs",  // Custom Figma integration
],
```

### 3. Add Figma Links to Stories

Add the `design` parameter to your stories:

```tsx
const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/abc123/Button?node-id=1-2",
    },
  },
};

export default meta;
```

## Usage

### In Storybook

1. Open Storybook
2. Select a component story
3. Click the **"Design"** tab in the panel
4. Click **"Open in Figma"** to view the design

### In Figma

1. Open the Storybook Connect plugin
2. Select a Figma component
3. Click **"Link to Storybook"**
4. Enter the Storybook URL
5. View the live implementation alongside the design

## Design Tokens Workflow

### 1. Create Tokens in Figma

Using the Tokens Studio plugin:

1. Install Tokens Studio in Figma
2. Create design tokens (colors, spacing, typography)
3. Export as JSON (W3C DTCG format)

### 2. Export Tokens

1. In Tokens Studio, click **Export**
2. Select **JSON (W3C DTCG)** format
3. Save to `src/styles/tokens/figma-tokens.json`

### 3. Sync to Code

```bash
# Sync tokens to Tailwind
make tokens-sync

# Build CSS variables
make tokens-build
```

### 4. Use in Components

```tsx
// CSS Variables
<div style={{ color: 'var(--color-brand-primary)' }}>Text</div>

// Tailwind Classes
<div className="text-brand-primary">Text</div>

// TypeScript Constants
import { ColorBrandPrimary } from '@/styles/generated/tokens';
<div style={{ color: ColorBrandPrimary }}>Text</div>
```

## Best Practices

### 1. One Figma File Per Component

Keep Figma files focused:

```
Figma
├── Button.figma
├── Card.figma
├── Modal.figma
└── Dashboard.figma
```

### 2. Use Node IDs

Link to specific Figma nodes:

```
https://www.figma.com/file/abc123/Button?node-id=1-2
                                 ^^^^^       ^^^^^
                                 Component   Variant
```

### 3. Keep URLs Updated

When Figma designs change, update the `design.url` in stories.

### 4. Document Design Decisions

Use the `$description` field in tokens:

```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#3b82f6",
        "$type": "color",
        "$description": "Primary brand color - used for CTAs"
      }
    }
  }
}
```

## Troubleshooting

### Figma Link Not Working

1. Check the URL is valid
2. Ensure the Figma file is accessible
3. Verify the node-id exists

### Storybook Connect Plugin Not Finding Stories

1. Check Storybook is running
2. Verify the plugin has network access
3. Check the Storybook URL is correct

### Tokens Not Syncing

1. Check `figma-tokens.json` is valid JSON
2. Run `make tokens-sync`
3. Restart the dev server

## Commands Reference

```bash
# Design tokens
make tokens-sync        # Sync Figma tokens to Tailwind
make tokens-build       # Build CSS variables
make tokens-watch       # Watch for changes

# Storybook
make storybook          # Start Storybook
make storybook-build    # Build Storybook
```

## Resources

- [Storybook Connect Plugin](https://www.figma.com/community/plugin/1056265616080331589/storybook-connect)
- [Tokens Studio](https://tokens.studio/)
- [W3C Design Tokens Format](https://design-tokens.github.io/community-group/format/)
- [Storybook Design Addon](https://storybook.js.org/docs/react/writing-tests/visual-testing)
