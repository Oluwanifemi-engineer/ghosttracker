/**
 * Command Store (Zustand)
 *
 * State management for remote commands.
 *
 * Design pattern: Optimistic Updates
 * - Commands are immediately added to state
 * - Server response confirms or rolls back
 * - UI feels instant even with network latency
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Command {
  id: number;
  command: string;
  params?: string;
  status: 'pending' | 'delivered' | 'executing' | 'completed' | 'failed' | 'expired';
  priority: number;
  issued_at?: string;
  executed_at?: string;
  failure_reason?: string;
}

interface CommandState {
  // ── State ──────────────────────────────────────────────────────
  commands: Command[];
  isLoading: boolean;
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────
  setCommands: (commands: Command[]) => void;
  addCommand: (command: Command) => void;
  updateCommand: (commandId: number, updates: Partial<Command>) => void;
  removeCommand: (commandId: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // ── Optimistic Actions ─────────────────────────────────────────
  issueCommand: (deviceId: string, command: string, params?: string) => Promise<void>;
  acknowledgeCommand: (commandId: number) => Promise<void>;

  // ── Selectors ──────────────────────────────────────────────────
  getPendingCommands: () => Command[];
  getCompletedCommands: () => Command[];
  getFailedCommands: () => Command[];
}

export const useCommandStore = create<CommandState>()(
  devtools(
    (set, get) => ({
      // ── Initial State ──────────────────────────────────────
      commands: [],
      isLoading: false,
      error: null,

      // ── Actions ────────────────────────────────────────────
      setCommands: (commands) =>
        set({ commands }, false, 'setCommands'),

      addCommand: (command) =>
        set(
          (state) => ({ commands: [command, ...state.commands] }),
          false,
          'addCommand'
        ),

      updateCommand: (commandId, updates) =>
        set(
          (state) => ({
            commands: state.commands.map((c) =>
              c.id === commandId ? { ...c, ...updates } : c
            ),
          }),
          false,
          'updateCommand'
        ),

      removeCommand: (commandId) =>
        set(
          (state) => ({
            commands: state.commands.filter((c) => c.id !== commandId),
          }),
          false,
          'removeCommand'
        ),

      setLoading: (isLoading) =>
        set({ isLoading }, false, 'setLoading'),

      setError: (error) =>
        set({ error, isLoading: false }, false, 'setError'),

      // ── Optimistic Actions ─────────────────────────────────
      issueCommand: async (deviceId, command, params) => {
        // Optimistic: add command immediately
        const optimisticCommand: Command = {
          id: Date.now(), // Temporary ID
          command,
          params,
          status: 'pending',
          priority: 5,
          issued_at: new Date().toISOString(),
        };

        get().addCommand(optimisticCommand);

        try {
          const res = await fetch(`/api/dashboard/devices/${deviceId}/commands`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, params }),
          });

          if (!res.ok) throw new Error('Failed to issue command');

          const data = await res.json();

          // Update with real server response
          get().updateCommand(optimisticCommand.id, {
            id: data.command_id || data.id,
            status: 'delivered',
          });
        } catch (err) {
          // Rollback on failure
          get().removeCommand(optimisticCommand.id);
          get().setError(
            err instanceof Error ? err.message : 'Failed to issue command'
          );
        }
      },

      acknowledgeCommand: async (commandId) => {
        get().updateCommand(commandId, { status: 'executing' });

        try {
          const res = await fetch(`/api/device/commands/${commandId}/ack`, {
            method: 'POST',
          });

          if (!res.ok) throw new Error('Failed to acknowledge');
        } catch (err) {
          get().updateCommand(commandId, { status: 'failed' });
        }
      },

      // ── Selectors ──────────────────────────────────────────
      getPendingCommands: () =>
        get().commands.filter((c) => c.status === 'pending'),

      getCompletedCommands: () =>
        get().commands.filter((c) => c.status === 'completed'),

      getFailedCommands: () =>
        get().commands.filter((c) => c.status === 'failed'),
    }),
    { name: 'CommandStore' }
  )
);
