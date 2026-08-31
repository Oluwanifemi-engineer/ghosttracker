import type { Meta, StoryObj } from "@storybook/react";
import { CommandButton } from "./CommandButton";

/**
 * CommandButton component for issuing anti-theft commands.
 *
 * Used for lock, alarm, locate, and other device commands.
 * Includes confirmation dialog for destructive actions.
 *
 * ## Usage
 * ```tsx
 * <CommandButton command="lock" deviceId="mt-1234" />
 * <CommandButton command="siren" deviceId="mt-1234" requiresConfirmation />
 * ```
 */
const meta = {
  title: "Commands/CommandButton",
  component: CommandButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    command: {
      control: "select",
      options: ["lock", "siren", "locate", "capture_photo", "capture_audio", "wipe"],
      description: "Command type to execute",
    },
    requiresConfirmation: {
      control: "boolean",
      description: "Whether to show confirmation dialog",
    },
    disabled: {
      control: "boolean",
      description: "Whether the button is disabled",
    },
    loading: {
      control: "boolean",
      description: "Whether the command is being sent",
    },
  },
} satisfies Meta<typeof CommandButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Lock command button.
 */
export const Lock: Story = {
  args: {
    command: "lock",
    deviceId: "mt-test1234",
  },
};

/**
 * Alarm command button.
 */
export const Alarm: Story = {
  args: {
    command: "siren",
    deviceId: "mt-test1234",
  },
};

/**
 * Locate command button.
 */
export const Locate: Story = {
  args: {
    command: "locate",
    deviceId: "mt-test1234",
  },
};

/**
 * Capture photo command.
 */
export const CapturePhoto: Story = {
  args: {
    command: "capture_photo",
    deviceId: "mt-test1234",
  },
};

/**
 * Capture audio command.
 */
export const CaptureAudio: Story = {
  args: {
    command: "capture_audio",
    deviceId: "mt-test1234",
  },
};

/**
 * Wipe command (destructive).
 */
export const Wipe: Story = {
  args: {
    command: "wipe",
    deviceId: "mt-test1234",
    requiresConfirmation: true,
  },
};

/**
 * Disabled command button.
 */
export const Disabled: Story = {
  args: {
    command: "lock",
    deviceId: "mt-test1234",
    disabled: true,
  },
};

/**
 * Loading state while command is being sent.
 */
export const Loading: Story = {
  args: {
    command: "lock",
    deviceId: "mt-test1234",
    loading: true,
  },
};

/**
 * All command buttons displayed together.
 */
export const AllCommands: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <CommandButton command="lock" deviceId="mt-test" />
      <CommandButton command="siren" deviceId="mt-test" />
      <CommandButton command="locate" deviceId="mt-test" />
      <CommandButton command="capture_photo" deviceId="mt-test" />
      <CommandButton command="capture_audio" deviceId="mt-test" />
      <CommandButton command="wipe" deviceId="mt-test" requiresConfirmation />
    </div>
  ),
};

/**
 * Command button with confirmation dialog.
 */
export const WithConfirmation: Story = {
  args: {
    command: "wipe",
    deviceId: "mt-test1234",
    requiresConfirmation: true,
  },
};
