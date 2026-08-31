/**
 * Magneetar Design Tokens
 *
 * Design system tokens for consistent styling across the dashboard.
 * Inspired by Life360, Prey, and banking app design patterns.
 *
 * Usage:
 * import { colors, spacing, typography } from '@/lib/tokens';
 * <div style={{ color: colors.primary, padding: spacing.md }}>
 */

// ── Colors ─────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary: '#3b82f6',      // Blue (trust, security)
  primaryDark: '#2563eb',
  primaryLight: '#60a5fa',

  // Semantic
  success: '#22c55e',      // Green (online, safe)
  warning: '#eab308',      // Yellow (caution)
  danger: '#ef4444',       // Red (stolen, offline, destructive)
  info: '#06b6d4',         // Cyan (informational)

  // Neutrals
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  gray950: '#030712',

  // Backgrounds
  bgPrimary: '#0f172a',    // Dark mode primary
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',
  bgCard: '#1e293b',
  bgCardHover: '#334155',

  // Borders
  borderDefault: '#334155',
  borderLight: '#1e293b',
  borderFocus: '#3b82f6',
} as const;

// ── Spacing ────────────────────────────────────────────────────────────

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
  xxxxl: '40px',
} as const;

// ── Typography ─────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'JetBrains Mono, "Fira Code", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    xxl: '1.5rem',    // 24px
    xxxl: '2rem',     // 32px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

// ── Shadows ────────────────────────────────────────────────────────────

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 0 15px rgb(59 130 246 / 0.5)',
} as const;

// ── Border Radius ──────────────────────────────────────────────────────

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  xxl: '24px',
  full: '9999px',
} as const;

// ── Transitions ────────────────────────────────────────────────────────

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
  spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ── Z-Index ────────────────────────────────────────────────────────────

export const zIndex = {
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modalBackdrop: '1040',
  modal: '1050',
  popover: '1060',
  tooltip: '1070',
  toast: '1080',
} as const;

// ── Breakpoints ────────────────────────────────────────────────────────

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  xxl: '1536px',
} as const;
