/**
 * Device Store (Zustand)
 *
 * Centralized state management for device data.
 *
 * Design pattern: Zustand (lightweight state management)
 * - Single source of truth for device state
 * - Actions for state mutations
 * - Selectors for derived state
 * - No boilerplate (unlike Redux)
 *
 * Usage:
 * ```
 * const { devices, selectedDevice, selectDevice } = useDeviceStore();
 * ```
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface Device {
  id: string;
  alias?: string;
  model?: string;
  platform?: string;
  last_seen?: string;
  is_stolen?: boolean;
  sentinel_score?: number;
  owner_id?: string;
  is_online?: boolean;
  battery_percent?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  access_role?: string;
  is_owner?: boolean;
}

interface DeviceState {
  // ── State ──────────────────────────────────────────────────────
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  // ── Actions ────────────────────────────────────────────────────
  setDevices: (devices: Device[]) => void;
  selectDevice: (device: Device | null) => void;
  updateDevice: (deviceId: string, updates: Partial<Device>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  refreshDevices: () => Promise<void>;

  // ── Selectors (derived state) ──────────────────────────────────
  getDeviceById: (deviceId: string) => Device | undefined;
  getOnlineDevices: () => Device[];
  getOfflineDevices: () => Device[];
  getStolenDevices: () => Device[];
}

export const useDeviceStore = create<DeviceState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial State ──────────────────────────────────────
        devices: [],
        selectedDevice: null,
        isLoading: false,
        error: null,
        lastFetch: null,

        // ── Actions ────────────────────────────────────────────
        setDevices: (devices) =>
          set({ devices, lastFetch: Date.now() }, false, 'setDevices'),

        selectDevice: (device) =>
          set({ selectedDevice: device }, false, 'selectDevice'),

        updateDevice: (deviceId, updates) =>
          set(
            (state) => ({
              devices: state.devices.map((d) =>
                d.id === deviceId ? { ...d, ...updates } : d
              ),
              selectedDevice:
                state.selectedDevice?.id === deviceId
                  ? { ...state.selectedDevice, ...updates }
                  : state.selectedDevice,
            }),
            false,
            'updateDevice'
          ),

        setLoading: (isLoading) =>
          set({ isLoading }, false, 'setLoading'),

        setError: (error) =>
          set({ error, isLoading: false }, false, 'setError'),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        refreshDevices: async () => {
          set({ isLoading: true, error: null }, false, 'refreshDevices');
          try {
            const res = await fetch('/api/dashboard/devices');
            if (!res.ok) throw new Error('Failed to fetch devices');
            const data = await res.json();
            set(
              { devices: data.devices || [], isLoading: false, lastFetch: Date.now() },
              false,
              'refreshDevices/success'
            );
          } catch (err) {
            set(
              {
                error: err instanceof Error ? err.message : 'Unknown error',
                isLoading: false,
              },
              false,
              'refreshDevices/error'
            );
          }
        },

        // ── Selectors ──────────────────────────────────────────
        getDeviceById: (deviceId) =>
          get().devices.find((d) => d.id === deviceId),

        getOnlineDevices: () =>
          get().devices.filter((d) => d.is_online),

        getOfflineDevices: () =>
          get().devices.filter((d) => !d.is_online),

        getStolenDevices: () =>
          get().devices.filter((d) => d.is_stolen),
      }),
      {
        name: 'magneetar-devices',
        partialize: (state) => ({
          devices: state.devices,
          lastFetch: state.lastFetch,
        }),
      }
    ),
    { name: 'DeviceStore' }
  )
);
