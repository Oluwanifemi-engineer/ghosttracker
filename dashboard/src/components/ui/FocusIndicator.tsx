'use client';

import { useEffect } from 'react';

/**
 * Focus Indicator Provider
 *
 * WCAG 2.4.7 (Focus Visible): All interactive elements must have visible focus indicators
 * WCAG 2.4.11 (Focus Not Obscured - Minimum): Focused elements must not be hidden by other content
 * WCAG 2.5.8 (Target Size - Minimum): Interactive targets must be at least 24x24 CSS pixels
 *
 * This component injects global focus styles that ensure all interactive elements
 * have high-contrast, visible focus rings that meet WCAG 2.2 AA requirements.
 */
export default function FocusIndicator() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* WCAG 2.4.7: Visible focus indicators for all interactive elements */
      *:focus-visible {
        outline: 2px solid #00D4AA !important;
        outline-offset: 2px !important;
        border-radius: 4px;
        box-shadow: 0 0 0 4px rgba(0, 212, 170, 0.2) !important;
      }

      /* WCAG 2.5.8: Minimum target size 24x24px */
      button, a, input, select, textarea, [role="button"], [role="tab"], [role="link"] {
        min-height: 24px;
        min-width: 24px;
      }

      /* Ensure focus is never obscured (WCAG 2.4.11) */
      *:focus {
        position: relative;
        z-index: 10;
      }

      /* Skip navigation link (WCAG 2.4.1) */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      .sr-only:focus,
      .sr-only.focus\:not-sr-only:focus {
        position: fixed;
        width: auto;
        height: auto;
        padding: 0.5rem 1rem;
        margin: 0;
        overflow: visible;
        clip: auto;
        white-space: normal;
      }

      /* High contrast mode support */
      @media (forced-colors: active) {
        *:focus-visible {
          outline: 3px solid Highlight !important;
        }
      }

      /* Reduced motion support (WCAG 2.3.3) */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* Screen reader only utility */
      .visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
