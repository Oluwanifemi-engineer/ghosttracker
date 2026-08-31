import type { Meta, StoryObj } from "@storybook/react";
import { StatusIndicator } from "./StatusIndicator";

/**
 * StatusIndicator component for showing device/connection status.
 *
 * Used throughout the dashboard to indicate online/offline/stolen states.
 *
 * ## Usage
 * ```tsx
 * <StatusIndicator status="online" />
 * <StatusIndicator status="offline" label="Last seen 5m ago" />
 * <StatusIndicator status="stolen" pulse />
 * ```
 */
const meta = {
  title: "UI/StatusIndicator",
  component: StatusIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["online", "offline", "stolen", "warning", "unknown"],
      description: "Current status to display",
    },
    pulse: {
      control: "boolean",
      description: "Whether the indicator pulses (for urgent states)",
    },
    showLabel: {
      control: "boolean",
      description: "Whether to show the status text label",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Size of the indicator",
    },
  },
} satisfies Meta<typeof StatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Online status - green dot.
 */
export const Online: Story = {
  args: {
    status: "online",
    showLabel: true,
  },
};

/**
 * Offline status - gray dot.
 */
export const Offline: Story = {
  args: {
    status: "offline",
    showLabel: true,
  },
};

/**
 * Stolen status - red pulsing dot.
 */
export const Stolen: Story = {
  args: {
    status: "stolen",
    showLabel: true,
    pulse: true,
  },
};

/**
 * Warning status - yellow dot.
 */
export const Warning: Story = {
  args: {
    status: "warning",
    showLabel: true,
  },
};

/**
 * Unknown status - question mark.
 */
export const Unknown: Story = {
  args: {
    status: "unknown",
    showLabel: true,
  },
};

/**
 * Small size indicator.
 */
export const Small: Story = {
  args: {
    status: "online",
    size: "sm",
    showLabel: true,
  },
};

/**
 * Large size indicator.
 */
export const Large: Story = {
  args: {
    status: "online",
    size: "lg",
    showLabel: true,
  },
};

/**
 * All statuses displayed together for comparison.
 */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <StatusIndicator status="online" showLabel />
        <StatusIndicator status="offline" showLabel />
        <StatusIndicator status="stolen" showLabel pulse />
        <StatusIndicator status="warning" showLabel />
        <StatusIndicator status="unknown" showLabel />
      </div>
      <div className="flex items-center gap-4">
        <StatusIndicator status="online" size="sm" showLabel />
        <StatusIndicator status="online" size="md" showLabel />
        <StatusIndicator status="online" size="lg" showLabel />
      </div>
    </div>
  ),
};

/**
 * Device list item showing status in context.
 */
export const DeviceListItem: Story = {
  render: () => (
    <div className="w-80 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            📱
          </div>
          <div>
            <p className="font-medium">Samsung Galaxy S24</p>
            <p className="text-sm text-muted-foreground">Owner: Oluwanifemi</p>
          </div>
        </div>
        <StatusIndicator status="online" size="sm" />
      </div>
    </div>
  ),
};
