/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';

let mockIsConnected = true;
const mockLogout = jest.fn();

jest.mock('@/store/useStore', () => ({
  useStore: jest.fn((selector: any) => {
    const state = {
      isConnected: mockIsConnected,
      logout: mockLogout,
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('lucide-react', () => ({
  LogOut: () => null,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { Header } from '@/components/layout/Header';

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true;
  });

  it('shows CONNECTED status when connected', () => {
    render(<Header />);
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
  });

  it('shows DISCONNECTED status when not connected', () => {
    mockIsConnected = false;
    render(<Header />);
    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
  });

  it('shows disconnect button', () => {
    render(<Header />);
    expect(screen.getByText('DISCONNECT')).toBeInTheDocument();
  });

  it('calls logout when disconnect is clicked', () => {
    render(<Header />);
    const disconnectBtn = screen.getByText('DISCONNECT');
    fireEvent.click(disconnectBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
