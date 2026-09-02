'use client';

/**
 * Skip Navigation Link
 * WCAG 2.4.1 (Bypass Blocks) — allows keyboard users to skip repetitive navigation
 * and go directly to main content.
 */
export default function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999]
                 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-emerald-500 focus:text-black
                 focus:font-bold focus:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400
                 focus:shadow-lg focus:shadow-emerald-500/20"
    >
      Skip to main content
    </a>
  );
}
