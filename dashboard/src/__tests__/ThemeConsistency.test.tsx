/**
 * @jest-environment jsdom
 *
 * Theme Consistency Test
 *
 * Catches the class of bug where a page uses light-theme classes
 * (bg-white, text-gray-900) on what should be a dark-themed app.
 * This test reads the rendered HTML of each page component and asserts
 * that dark-theme patterns are present while light-theme patterns are absent.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';

// Mock next/link
jest.mock('next/link', () => {
  const Link = ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  return Link;
});

// Mock next/navigation (used by verify-email)
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=test-token'),
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock store
jest.mock('@/store/useStore', () => ({
  useStore: () => ({
    setCredentials: jest.fn(),
    setConnected: jest.fn(),
    devices: [],
    selectedDeviceId: null,
    activeTab: 'sentinel',
    setActiveTab: jest.fn(),
    setSidebarOpen: jest.fn(),
    sidebarOpen: false,
  }),
}));

/**
 * Assert that a rendered container uses dark theme and not light theme.
 * Checks for common dark-theme indicators and light-theme anti-patterns.
 */
function assertDarkTheme(container: HTMLElement, pageName: string) {
  const html = container.innerHTML;

  // ── Must have dark background ──
  const hasDarkBg =
    html.includes('bg-[#0a0a0f]') ||
    html.includes('bg-[#0e0e14]') ||
    html.includes('bg-gray-950') ||
    html.includes('bg-mag-bg') ||
    html.includes('bg-[#060609]');
  expect(hasDarkBg).toBe(true);

  // ── Must NOT use light-theme page backgrounds ──
  const hasLightBg =
    html.includes('className="min-h-screen bg-white') ||
    html.includes('className="min-h-screen bg-gray-50');
  expect(hasLightBg).toBe(false);

  // ── Must NOT use light-theme text on dark backgrounds ──
  // (text-gray-900 on a dark bg = invisible text)
  const hasGray900 =
    html.includes('text-gray-900"') ||
    html.includes('text-gray-900/');
  // Only flag if there's NO corresponding dark bg to justify it
  if (hasGray900) {
    // Check if the page has a dark overall background — if so, gray-900 is wrong
    const hasDarkOverallBg = html.includes('bg-[#0a0a0f]') || html.includes('bg-gray-950');
    expect(hasDarkOverallBg && hasGray900).toBe(false);
  }
}

// ── Test each page ──

describe('Theme Consistency — all pages use dark theme', () => {
  it('login page uses dark theme', async () => {
    const mod = await import('@/app/login/page');
    const LoginPage = mod.default;
    const { container } = render(<LoginPage />);
    assertDarkTheme(container, 'login');
  });

  it('signup page uses dark theme', async () => {
    const mod = await import('@/app/signup/page');
    const SignupPage = mod.default;
    const { container } = render(<SignupPage />);
    assertDarkTheme(container, 'signup');
  });

  it('forgot-password page uses dark theme', async () => {
    const mod = await import('@/app/forgot-password/page');
    const ForgotPasswordPage = mod.default;
    const { container } = render(<ForgotPasswordPage />);
    assertDarkTheme(container, 'forgot-password');
  });

  it('verify-email page uses dark theme', async () => {
    const mod = await import('@/app/verify-email/page');
    const VerifyEmailPage = mod.default;
    const { container } = render(<VerifyEmailPage />);
    assertDarkTheme(container, 'verify-email');
  });
});
