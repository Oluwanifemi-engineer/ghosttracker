/**
 * @jest-environment jsdom
 *
 * Regression test for the "dashboard shows no devices / commands don't work"
 * bug: useDevices() and useWebSocket() were defined but NEVER mounted, so the
 * zustand store stayed empty (empty sidebar, selectedDeviceId null → the
 * command panel silently did nothing). This test pins the data layer to the
 * dashboard layout so a future refactor can't drop it silently again.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render } from '@testing-library/react';

// ─── Spies on the data-layer hooks ──────────────────────────────────────────
const mockUseDevices = jest.fn();
const mockUseWebSocket = jest.fn();

jest.mock('@/hooks/useDevices', () => ({ useDevices: () => mockUseDevices() }));
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => mockUseWebSocket() }));

// The layout calls useRouter() from next/navigation — provide a router stub
// so the component can mount without a Next.js router context.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
}));

// ─── Store mock (authenticated) ─────────────────────────────────────────────
let mockIsAuthenticated = true;
jest.mock('@/store/useStore', () => ({
  useStore: jest.fn((selector: any) => {
    const state = {
      isAuthenticated: mockIsAuthenticated,
      setCredentials: jest.fn(),
      setConnected: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// The layout's useEffect reads sessionStorage and would redirect to /login
// when the values are missing. Seed them so the auth-restore path is a no-op
// (the store mock already reports isAuthenticated=true).

// ─── Child components mocked (the data-layer mount is what we assert) ───────
jest.mock('@/components/layout/Header', () => ({ Header: () => null }));
jest.mock('@/components/layout/Sidebar', () => ({ Sidebar: () => null }));

describe('DashboardLayout — data layer mount (regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    sessionStorage.clear();
    sessionStorage.setItem('mt_server_url', 'https://api.magneetar.me');
    sessionStorage.setItem('mt_api_key', 'test-user-token');
  });

  it('mounts useDevices() and useWebSocket() when authenticated', () => {
    // Import the layout inside the test so jest hoisting resolves the mocked
    // hooks module before the component body executes.
    const Layout = require('@/app/dashboard/layout').default;
    render(<Layout><div data-testid="child">content</div></Layout>);

    // The regression guard: if the layout ever stops mounting the data layer,
    // these spies are never invoked and the test fails. (toHaveBeenCalled,
    // not Times(1): the layout re-renders once when `mounted` flips true and
    // the body mounts the data layer on every render.)
    expect(mockUseDevices).toHaveBeenCalled();
    expect(mockUseWebSocket).toHaveBeenCalled();
    // Children render through the authenticated layout.
    expect(document.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});
