# Visual Regression Testing Guide

## Overview

Magneetar uses [Chromatic](https://www.chromatic.com/) for visual regression testing. Chromatic captures pixel-perfect snapshots of every Storybook story and detects visual changes across branches.

## Why Visual Testing?

1. **Catch CSS regressions** - Tailwind classes, theme changes, responsive layouts
2. **Component consistency** - Ensure components render correctly across states
3. **Cross-browser testing** - Chrome, Firefox, Safari snapshots
4. **Design review** - PR-level visual diffs for design feedback

## Setup

### 1. Create Chromatic Account

1. Go to [chromatic.com](https://www.chromatic.com/)
2. Sign up with GitHub
3. Import your repository

### 2. Get Project Token

1. In Chromatic dashboard, go to **Manage → Configure**
2. Copy the **Project Token**

### 3. Add to GitHub Secrets

1. Go to **Settings → Secrets and variables → Actions**
2. Add `CHROMATIC_PROJECT_TOKEN` with your token

### 4. Install Chromatic

```bash
cd dashboard
npm install chromatic --save-dev
```

## Usage

### Local Development

```bash
# Run Chromatic locally
cd dashboard
npm run chromatic

# Auto-accept changes (main branch only)
npm run chromatic:main
```

### CI/CD

Chromatic runs automatically on:
- **Push to main/develop** - Captures baseline snapshots
- **Pull requests** - Compares against baseline, shows diffs

### GitHub Actions Workflow

The workflow (`.github/workflows/chromatic.yml`) runs:

1. **Checkout** with full history (for baseline comparison)
2. **Install dependencies** with npm ci
3. **Build Storybook** for snapshot capture
4. **Run Chromatic** with smart diffing

## Chromatic Configuration

Configuration is in `.chromaticrc.json`:

```json
{
  "projectId": "Project:6648a1e6e631e26a98a42b3d",
  "buildScriptName": "build-storybook",
  "onlyChanged": true,           // Only snapshot changed stories
  "exitZeroOnChanges": true,     // Don't fail CI on visual changes
  "exitOnceUploaded": true,      // Don't wait for build to finish
  "skip": "dependabot/** **.md" // Skip certain PRs
}
```

## Workflow

### 1. Developer Creates Branch

```bash
git checkout -b feature/new-button
```

### 2. Add/Modify Component

Create or update a component with Storybook stories.

### 3. Push to GitHub

```bash
git push origin feature/new-button
```

### 4. Chromatic Captures Snapshots

Chromatic automatically:
1. Builds Storybook
2. Captures all stories as snapshots
3. Compares against baseline (main branch)

### 5. Review Visual Changes

1. Go to **Pull Request** in GitHub
2. Click **Chromatic** check
3. Review visual diffs in Chromatic dashboard

### 6. Accept or Reject Changes

- **Accept**: Click "Accept" on changed snapshots
- **Reject**: Revert changes if unintended

## Best Practices

### 1. Story Isolation

Each story should be independent:

```tsx
// ✅ Good - isolated story
export const Default: Story = {
  args: {
    children: "Button",
  },
};

// ❌ Bad - depends on external state
export const WithData: Story = {
  render: () => <Button data={useSomeStore()} />,
};
```

### 2. Avoid Flaky Snapshots

Use fixed data instead of random:

```tsx
// ✅ Good - fixed data
export const DeviceCard: Story = {
  args: {
    device: {
      id: "mt-1234",
      battery: 85,
      lastSeen: "2024-01-15T10:30:00Z",
    },
  },
};

// ❌ Bad - random data
export const DeviceCard: Story = {
  render: () => <DeviceCard device={generateRandomDevice()} />,
};
```

### 3. Animation Handling

Disable animations for stable snapshots:

```tsx
// In preview.ts
parameters: {
  chromatic: {
    pauseAnimationAtEnd: true,
    delay: 300,  // Wait for animations
  },
}
```

### 4. Viewport Testing

Test responsive layouts:

```tsx
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
```

## Chromatic Dashboard

### Features

1. **Visual Diffs** - Side-by-side comparison
2. **Overlay Mode** - Highlight changed pixels
3. **Spread Mode** - Show before/after
4. **Storybook Integration** - Click story to view in Storybook
5. **Review Workflow** - Approve/reject with comments

### Review Process

1. Open Chromatic from PR check
2. Review each changed snapshot
3. Add comments if needed
4. Click "Accept" or "Reject"
5. Changes are applied to baseline

## Troubleshooting

### Snapshots Look Different

1. **Check Storybook build** - Ensure consistent build
2. **Check viewport** - Responsive changes may differ
3. **Check animations** - Pause animations in preview
4. **Check fonts** - System fonts may differ

### CI Failing

1. **Check token** - Ensure `CHROMATIC_PROJECT_TOKEN` is set
2. **Check Storybook** - Ensure `build-storybook` works locally
3. **Check permissions** - Chromatic needs write access

### Slow Builds

1. **Use `onlyChanged`** - Only snapshot changed stories
2. **Use `skip`** - Skip irrelevant PRs
3. **Cache dependencies** - Use npm ci with cache

## Commands Reference

```bash
# Local development
npm run storybook              # Start Storybook
npm run build-storybook        # Build Storybook
npm run chromatic              # Run Chromatic locally

# CI/CD
npm run chromatic:ci           # CI mode (exit zero on changes)
npm run chromatic:main         # Auto-accept on main

# Make targets
make storybook                 # Start Storybook
make storybook-build           # Build Storybook
make chromatic                 # Run Chromatic
make chromatic-ci              # CI mode
make chromatic-accept          # Auto-accept
```

## Resources

- [Chromatic Documentation](https://www.chromatic.com/docs)
- [Storybook Visual Testing](https://storybook.js.org/docs/writing-tests/visual-testing)
- [Chromatic GitHub Actions](https://www.chromatic.com/docs/github-actions/)
