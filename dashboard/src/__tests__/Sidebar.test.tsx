/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';

// Mock next/link
jest.mock('next/link', () => {
  const React = require('react');
  return React.forwardRef(function MockLink({ children, href, ...props }: any, ref: any) {
    return React.createElement('a', { ...props, href, ref }, children);
  });
});

// Mock window.matchMedia for mobile detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: unknown) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock the store
const mockSelectDevice = jest.fn();
const mockSetSidebarOpen = jest.fn();
const mockSetDevices = jest.fn();
const mockSetUserProfile = jest.fn();
let mockDevices: any[] = [];
let mockSidebarOpen = true;
let mockSelectedDeviceId: string | null = null;
let mockIsConnected = true;
let mockUserProfile: any = null;

jest.mock('@/store/useStore', () => ({
  useStore: jest.fn(() => ({
    devices: mockDevices,
    selectedDeviceId: mockSelectedDeviceId,
    selectDevice: mockSelectDevice,
    sidebarOpen: mockSidebarOpen,
    setSidebarOpen: mockSetSidebarOpen,
    isConnected: mockIsConnected,
    setDevices: mockSetDevices,
    userProfile: mockUserProfile,
    setUserProfile: mockSetUserProfile,
  })),
}));

jest.mock('@/lib/api', () => ({
  getAPI: jest.fn(() => ({
    getStats: jest.fn<any>().mockResolvedValue({
      total_devices: 2,
      active_devices: 1,
      stolen_devices: 0,
      total_locations: 100,
      total_media: 5,
      alerts_today: 0,
    }),
    fetchMe: jest.fn<any>().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      display_name: 'Test User',
      tier: 'admin',
      is_active: true,
      device_count: 1,
      max_devices: 999,
    }),
    deleteArchivedDevices: jest.fn<any>().mockResolvedValue({ deleted: [], count: 0 }),
    getDevices: jest.fn<any>().mockResolvedValue({ devices: [] as any[] }),
  })),
}));

jest.mock('@/lib/utils', () => ({
  relativeTime: jest.fn(() => '5m ago'),
  isOnline: jest.fn(() => true),
  getSignalLevel: jest.fn(() => 'good'),
  deviceDisplayName: jest.fn((d: any) => d.alias || d.model || d.id),
  stepUpPasswordHint: jest.fn(() => 'the master API key (API-key mode)'),
  cn: jest.fn((...classes: any[]) => classes.filter(Boolean).join(' ')),
}));

jest.mock('@/components/ui/StatusIndicator', () => ({
  StatusIndicator: jest.fn(({ isOnline }: any) => (
    <span data-testid="status-indicator">{isOnline ? 'online' : 'offline'}</span>
  )),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SidebarSkeleton: jest.fn(() => <div data-testid="sidebar-skeleton" />),
}));

jest.mock('@/components/devices/ClaimDeviceModal', () => ({
  ClaimDeviceModal: jest.fn(({ onClose }: any) => (
    <div data-testid="claim-modal">
      <button onClick={onClose}>Close</button>
    </div>
  )),
}));

import { Sidebar } from '@/components/layout/Sidebar';

describe('Sidebar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevices = [
      {
        id: 'device-001',
        alias: 'My Phone',
        model: 'Samsung Galaxy',
        owner_id: 'user-1',
        is_owner: true,
        last_seen: new Date(Date.now() - 300000).toISOString(),
        sentinel_score: 25,
        is_stolen: false,
        archived_at: null,
      },
    ];
    mockSidebarOpen = true;
    mockSelectedDeviceId = 'device-001';
    mockIsConnected = true;
    mockUserProfile = {
      id: 'user-1',
      email: 'test@example.com',
      display_name: 'Test User',
      tier: 'admin',
      is_active: true,
      device_count: 1,
      max_devices: 999,
    };
  });

  it('renders the sidebar with devices', async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('MAGNEETAR')).toBeInTheDocument();
    expect(screen.getByText('My Phone')).toBeInTheDocument();
  });

  it('shows navigation links for admin users', async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('hides Admin link for non-admin users', async () => {
    mockUserProfile = {
      id: 'user-2',
      email: 'user@example.com',
      display_name: 'Regular User',
      tier: 'free',
      is_active: true,
      device_count: 1,
      max_devices: 1,
    };
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('links to correct routes', async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    const adminLink = screen.getByText('Admin').closest('a');
    expect(adminLink).toHaveAttribute('href', '/admin');

  });

  it('selects a device when clicked', async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    fireEvent.click(screen.getByText('My Phone'));
    expect(mockSelectDevice).toHaveBeenCalledWith('device-001');
  });

  it('shows empty state when no devices', async () => {
    mockDevices = [];
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('No devices registered.')).toBeInTheDocument();
  });

  it('shows offline devices differently', async () => {
    mockDevices = [
      {
        id: 'device-offline',
        alias: 'Old Phone',
        model: 'iPhone 12',
        owner_id: 'user-1',
        is_owner: true,
        last_seen: new Date(Date.now() - 86400000).toISOString(),
        sentinel_score: 10,
        is_stolen: false,
        archived_at: null,
      },
    ];
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('Old Phone')).toBeInTheDocument();
  });

  it('shows archived devices with archived badge', async () => {
    mockDevices = [
      {
        id: 'device-archived',
        alias: 'Dead Phone',
        model: 'Nokia 3310',
        owner_id: 'user-1',
        is_owner: true,
        last_seen: new Date(Date.now() - 86400000 * 35).toISOString(),
        sentinel_score: 0,
        is_stolen: false,
        archived_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ];
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('Dead Phone')).toBeInTheDocument();
  });

  it('shows the claim modal when Link button is clicked', async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    fireEvent.click(screen.getByText('Link'));
    expect(screen.getByTestId('claim-modal')).toBeInTheDocument();
  });

  it('does not show sidebar content when collapsed', async () => {
    mockSidebarOpen = false;
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.queryByText('MAGNEETAR')).not.toBeInTheDocument();
  });

  it('shows shared access chip for non-owner devices', async () => {
    mockDevices = [
      {
        id: 'device-shared',
        alias: 'Shared Phone',
        model: 'Pixel 7',
        owner_id: 'other-user',
        is_owner: false,
        access_role: 'viewer',
        last_seen: new Date(Date.now() - 60000).toISOString(),
        sentinel_score: 45,
        is_stolen: false,
        archived_at: null,
      },
    ];
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText('VIEW')).toBeInTheDocument();
  });
});
