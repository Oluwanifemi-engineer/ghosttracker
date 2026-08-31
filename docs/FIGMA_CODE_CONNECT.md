# Figma Code Connect Guide

## Overview

[Figma Code Connect](https://www.figma.com/blog/announcing-figma-code-connect/) connects Figma components to real React code, enabling:

- **Automatic prop mapping** from Figma to React
- **Design-to-code documentation** in Figma
- **AI-powered code generation** from Figma designs
- **Component library synchronization**

## Architecture

```
Figma Design
    ↓
Code Connect Files (*.figma.tsx)
    ↓
React Components
    ↓
AI Code Generation
```

## Setup

### 1. Install Figma Code Connect

```bash
# Install CLI globally
npm install -g @figma/code-connect

# Or as dev dependency
npm install --save-dev @figma/code-connect
```

### 2. Get Figma Access Token

1. Go to **Figma → Settings → Personal Access Tokens**
2. Create a new token
3. Add to environment:

```bash
export FIGMA_ACCESS_TOKEN=your-token
```

### 3. Update Figma File Key

Edit `figma.config.json`:

```json
{
  "codeConnect": {
    "figmaFileKey": "your-figma-file-key",
    "figmaToken": "${FIGMA_ACCESS_TOKEN}"
  }
}
```

Find your file key in the Figma URL:
```
https://www.figma.com/file/ABC123/Your-File
                            ^^^^^^^^
                            File Key
```

## Code Connect Files

### Button Component

```tsx
// Button.figma.tsx
import figma from "@figma/code-connect";
import { Button } from "./Button";

export const ButtonConnect = figma("<Button>")
  .link("https://www.figma.com/file/abc/Button?node-id=1-2")
  .props({
    variant: figma.enum("variant", {
      "Primary": "primary",
      "Secondary": "secondary",
    }),
    size: figma.enum("size", {
      "Small": "sm",
      "Medium": "md",
    }),
    children: figma.string("label"),
    disabled: figma.boolean("disabled"),
  });
```

### Card Component

```tsx
// Card.figma.tsx
export const CardConnect = figma("<Card>")
  .link("https://www.figma.com/file/abc/Card?node-id=3-4")
  .props({
    variant: figma.enum("variant", {
      "Default": "default",
      "Elevated": "elevated",
    }),
    title: figma.string("title"),
    children: figma.children("Content"),
  });
```

## Usage

### Connect Components

```bash
# Connect all components
make figma-connect

# Preview connections (dry run)
make figma-connect-dry

# Check connection status
make figma-connect-status
```

### In Figma

1. Open Figma
2. Go to **Components** panel
3. Click **Code** tab
4. View connected React code
5. Copy component code with props

### In Code

```tsx
import { Button } from '@/components/ui/Button';

// This component is connected to Figma
// Props are automatically mapped
<Button variant="primary" size="md">
  Click me
</Button>
```

## Prop Mapping

### Enums

```tsx
variant: figma.enum("variant", {
  "Primary": "primary",    // Figma value → React prop
  "Secondary": "secondary",
})
```

### Strings

```tsx
title: figma.string("title")
```

### Booleans

```tsx
disabled: figma.boolean("disabled")
```

### Children

```tsx
children: figma.children("Content")
```

### Functions

```tsx
onClick: figma.function("onClick", () => {
  console.log("Clicked");
})
```

## AI Code Generation

### With Figma Make

1. Select component in Figma
2. Click **Make → Generate Code**
3. Code Connect maps Figma props to React

### With Figma MCP

```json
{
  "mcp": {
    "figma": {
      "token": "${FIGMA_ACCESS_TOKEN}",
      "fileKey": "your-file-key"
    }
  }
}
```

## Best Practices

### 1. One File Per Component

```
src/components/ui/
├── Button.tsx
├── Button.figma.tsx    ← Code Connect
├── Card.tsx
├── Card.figma.tsx      ← Code Connect
└── StatusIndicator.tsx
    StatusIndicator.figma.tsx
```

### 2. Keep Props in Sync

When updating React props, update Code Connect:

```tsx
// React component
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
}

// Code Connect
props: {
  variant: figma.enum("variant", {
    "Primary": "primary",
    "Secondary": "secondary",
    "Danger": "danger",  // ← Add new variant
  }),
}
```

### 3. Document Design Decisions

```tsx
export const ButtonConnect = figma("<Button>")
  .displayName("Button")
  .description("Interactive button component for user actions")
  .link("https://www.figma.com/file/abc/Button")
```

### 4. Use Descriptive Figma Names

```tsx
props: {
  // ✅ Good - matches Figma property name
  variant: figma.enum("variant", { ... }),

  // ❌ Bad - unclear mapping
  type: figma.enum("variant", { ... }),
}
```

## Troubleshooting

### Connection Not Working

1. Check Figma token is valid
2. Verify file key is correct
3. Ensure component exists in Figma

### Props Not Mapping

1. Check Figma property names match
2. Verify enum values are correct
3. Test with `--dry-run` flag

### AI Not Generating Code

1. Ensure Code Connect files are compiled
2. Check Figma MCP configuration
3. Verify component is connected

## Commands Reference

```bash
# Installation
npm install -g @figma/code-connect

# Connect components
figma connect                           # Connect all
figma connect src/components/ui/Button.figma.tsx  # Connect one

# Preview
figma connect --dry-run                 # Preview without updating

# Status
figma connect --status                  # Show connection status
```

## Resources

- [Figma Code Connect Docs](https://www.figma.com/docs/developers/figma-code-connect/)
- [Code Connect GitHub](https://github.com/figma/figma-code-connect)
- [Figma Make](https://www.figma.com/products/figma-make/)
- [Figma MCP](https://www.figma.com/blog/announcing-figma-mcp/)
