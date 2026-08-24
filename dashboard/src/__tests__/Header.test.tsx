/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';

let mockIsConnected = true;
let mockUserProfile: any = null;
const mockLogout = jest.fn();

jest.mock('@/store/useStore', () => ({
  useStore: jest.fn((selector: any) => {
    const state = {
      isConnected: mockIsConnected,
      logout: mockLogout,
      userProfile: mockUserProfile,
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('lucide-react', () => ({
  LogOut: () => null,
  Shield: () => null,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { Header } from '@/components/layout/Header';

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true;
    mockUserProfile = null;
  });

  it('shows LIVE status when connected', () => {
    render(<Header />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows OFFLINE status when not connected', () => {
    mockIsConnected = false;
    render(<Header />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('shows exit button', () => {
    render(<Header />);
    expect(screen.getByText('EXIT')).toBeInTheDocument();
  });

  it('calls logout when exit is clicked', () => {
    render(<Header />);
    const exitBtn = screen.getByText('EXIT');
    fireEvent.click(exitBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('shows E2E trust signal', () => {
    render(<Header />);
    expect(screen.getByText('E2E')).toBeInTheDocument();
  });

  it('shows ADMIN badge when tier is admin', () => {
    mockUserProfile = { tier: 'admin' };
    render(<Header />);
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('hides ADMIN badge when tier is not admin', () => {
    mockUserProfile = { tier: 'free' };
    render(<Header />);
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });
});
