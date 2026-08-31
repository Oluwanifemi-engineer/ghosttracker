# Magneetar Dashboard Component Library

A comprehensive UI component library for the Magneetar anti-tracking dashboard. Built with React, TypeScript, and Tailwind CSS.

## Overview

This component library provides reusable UI components designed specifically for the Magneetar dashboard. The components follow a consistent design system with support for dark/light themes, responsive layouts, and accessibility.

## Design Principles

### 1. Security-First Design
Components that handle sensitive operations (commands, evidence) include confirmation dialogs and clear warnings.

### 2. Real-time Updates
Components are designed to work with WebSocket updates and live data streams.

### 3. Mobile-First Responsive
All components work across desktop, tablet, and mobile viewports.

### 4. Accessibility (a11y)
Components follow WCAG 2.1 guidelines with proper ARIA labels, keyboard navigation, and screen reader support.

## Design Tokens

Design tokens are defined in `src/lib/tokens.ts` and provide consistent values across the application.

### Colors

```typescript
// Primary colors
colors.primary.DEFAULT    // #3b82f6 (blue)
colors.primary.foreground // #ffffff

// Status colors
colors.success   // #22c55e (green)
colors.warning   // #f59e0b (amber)
colors.danger    // #ef4444 (red)
colors.info      // #0ea5e9 (sky)

// Background colors
colors.background.DEFAULT    // #0a0a0a (dark)
colors.background.card       // #1a1a2e
colors.background.muted      // #27272a
```

### Spacing

```typescript
spacing.xs  // 4px
spacing.sm  // 8px
spacing.md  // 16px
spacing.lg  // 24px
spacing.xl  // 32px
spacing.2xl // 48px
```

### Typography

```typescript
fontSize.xs   // 12px
fontSize.sm   // 14px
fontSize.base // 16px
fontSize.lg   // 18px
fontSize.xl   // 20px
fontSize.2xl  // 24px
fontSize.3xl  // 30px
```

## Component Categories

### UI Components (`components/ui/`)

#### Button

Versatile button component with multiple variants and states.

```tsx
import { Button } from '@/components/ui/Button';

// Basic usage
<Button>Click me</Button>

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="danger">Danger</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="outline">Outline</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>
<Button fullWidth>Full Width</Button>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost' \| 'outline'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `disabled` | `boolean` | `false` | Disabled state |
| `loading` | `boolean` | `false` | Loading spinner |
| `fullWidth` | `boolean` | `false` | Full width |

---

#### Card

Container component for grouping related content.

```tsx
import { Card } from '@/components/ui/Card';

// Basic card
<Card>
  <p>Content here</p>
</Card>

// Card with title
<Card title="Device Status" subtitle="Last seen 5 min ago">
  <p>Battery: 85%</p>
</Card>

// Variants
<Card variant="default">Default</Card>
<Card variant="elevated">Elevated</Card>
<Card variant="outlined">Outlined</Card>
<Card variant="interactive" hoverable>Interactive</Card>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Card title |
| `subtitle` | `string` | - | Card subtitle |
| `variant` | `'default' \| 'elevated' \| 'outlined' \| 'interactive'` | `'default'` | Visual style |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Internal padding |
| `hoverable` | `boolean` | `false` | Hover effect |

---

#### StatusIndicator

Visual indicator for device/connection status.

```tsx
import { StatusIndicator } from '@/components/ui/StatusIndicator';

// Statuses
<StatusIndicator status="online" showLabel />
<StatusIndicator status="offline" showLabel />
<StatusIndicator status="stolen" showLabel pulse />
<StatusIndicator status="warning" showLabel />

// Sizes
<StatusIndicator status="online" size="sm" />
<StatusIndicator status="online" size="md" />
<StatusIndicator status="online" size="lg" />
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'online' \| 'offline' \| 'stolen' \| 'warning' \| 'unknown'` | - | Status to display |
| `showLabel` | `boolean` | `false` | Show status text |
| `pulse` | `boolean` | `false` | Pulse animation |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Indicator size |

---

### Command Components (`components/commands/`)

#### CommandButton

Button for issuing anti-theft commands to devices.

```tsx
import { CommandButton } from '@/components/ui/CommandButton';

// Lock device
<CommandButton command="lock" deviceId="mt-1234" />

// Sound alarm (with confirmation)
<CommandButton
  command="siren"
  deviceId="mt-1234"
  requiresConfirmation
/>

// Locate device
<CommandButton command="locate" deviceId="mt-1234" />

// Capture evidence
<CommandButton command="capture_photo" deviceId="mt-1234" />
<CommandButton command="capture_audio" deviceId="mt-1234" />

// Factory reset (destructive - requires confirmation)
<CommandButton
  command="wipe"
  deviceId="mt-1234"
  requiresConfirmation
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `command` | `'lock' \| 'siren' \| 'locate' \| 'capture_photo' \| 'capture_audio' \| 'wipe'` | - | Command type |
| `deviceId` | `string` | - | Target device ID |
| `requiresConfirmation` | `boolean` | `false` | Show confirmation dialog |
| `disabled` | `boolean` | `false` | Disabled state |
| `loading` | `boolean` | `false` | Sending state |

---

### Map Components (`components/map/`)

#### MapView

Interactive map showing device locations with real-time updates.

```tsx
import { MapView } from '@/components/map/MapView';

// Basic usage
<MapView devices={devices} />

// With event handlers
<MapView
  devices={devices}
  onDeviceClick={(deviceId) => navigate(`/devices/${deviceId}`)}
  center={[6.5244, 3.3792]}  // Lagos, Nigeria
  zoom={12}
/>
```

#### LocationHeatmap

Heatmap visualization of device location history.

```tsx
import { LocationHeatmap } from '@/components/map/LocationHeatmap';

<LocationHeatmap
  deviceId="mt-1234"
  timeRange="7d"
  showTrail
  showHeatmap
/>
```

---

### Panel Components (`components/panels/`)

#### AnalyticsPanel

Dashboard panel showing device analytics and metrics.

```tsx
import { AnalyticsPanel } from '@/components/panels/AnalyticsPanel';

<AnalyticsPanel
  deviceId="mt-1234"
  timeRange="24h"
/>
```

#### CoveragePanel

Test coverage metrics display.

```tsx
import { CoveragePanel } from '@/components/panels/CoveragePanel';

<CoveragePanel showDetails />
```

---

## State Management

### Zustand Stores

The dashboard uses Zustand for state management with dedicated stores:

#### useDeviceStore

```typescript
import { useDeviceStore } from '@/store/useDeviceStore';

// Get devices
const devices = useDeviceStore(state => state.devices);

// Add device
useDeviceStore.getState().addDevice(newDevice);

// Update device
useDeviceStore.getState().updateDevice(deviceId, updates);

// Remove device
useDeviceStore.getState().removeDevice(deviceId);
```

#### useCommandStore

```typescript
import { useCommandStore } from '@/store/useCommandStore';

// Get pending commands
const commands = useCommandStore(state => state.pendingCommands);

// Issue command
useCommandStore.getState().issueCommand(deviceId, 'lock');

// Acknowledge command
useCommandStore.getState().acknowledgeCommand(commandId);
```

---

## Accessibility Guidelines

### Keyboard Navigation

All interactive components support keyboard navigation:

- **Tab**: Move between interactive elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dialogs
- **Arrow keys**: Navigate within components

### ARIA Labels

Components include proper ARIA labels:

```tsx
<Button aria-label="Lock device">Lock</Button>
<StatusIndicator status="online" aria-label="Device is online" />
<CommandButton command="lock" aria-describedby="lock-description" />
```

### Screen Reader Support

Status changes are announced to screen readers:

```tsx
<div aria-live="polite">
  {device.isOnline ? 'Device is online' : 'Device is offline'}
</div>
```

---

## Theming

### Dark Mode

The dashboard defaults to dark mode. Light mode support is available via the DarkMode component:

```tsx
import { DarkMode } from '@/components/ui/DarkMode';

<DarkMode />
```

### Custom Themes

Extend the design tokens in `src/lib/tokens.ts`:

```typescript
export const tokens = {
  colors: {
    primary: {
      DEFAULT: '#your-color',
      foreground: '#your-foreground',
    },
  },
};
```

---

## Performance Guidelines

### Lazy Loading

Use dynamic imports for heavy components:

```tsx
const MapView = dynamic(() => import('@/components/map/MapView'), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false,
});
```

### Memoization

Memoize expensive computations:

```tsx
import { useMemo } from 'react';

const filteredDevices = useMemo(() =>
  devices.filter(d => d.isOnline),
  [devices]
);
```

### Virtual Scrolling

For long lists, use virtual scrolling:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// Virtualize device list
const virtualizer = useVirtualizer({
  count: devices.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
});
```

---

## Testing

### Unit Tests

Run Jest tests:

```bash
npm test
npm run test:watch
```

### E2E Tests

Run Playwright tests:

```bash
npm run test:e2e
npm run test:e2e:ui  # Interactive mode
```

### Visual Regression

Run Chromatic for visual testing:

```bash
npx chromatic --project-token=your-token
```

---

## Storybook

Start Storybook for component development:

```bash
npm run storybook
```

View published Storybook:

```bash
npm run build-storybook
```

---

## Contributing

### Adding a New Component

1. Create component in `src/components/ui/` or appropriate category
2. Add TypeScript props interface
3. Create story file (`ComponentName.stories.tsx`)
4. Add unit tests (`ComponentName.test.tsx`)
5. Update this README

### Component Checklist

- [ ] TypeScript props interface
- [ ] Default props
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Responsive design
- [ ] Dark mode support
- [ ] Storybook story
- [ ] Unit tests
- [ ] Documentation

---

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Aria Documentation](https://react-spectrum.adobe.com/react-aria/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

## License

Proprietary - Magneetar © 2026
