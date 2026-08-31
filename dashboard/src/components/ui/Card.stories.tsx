import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

/**
 * Card component for Magneetar dashboard.
 *
 * Used for displaying device information, alerts, and other content blocks.
 *
 * ## Usage
 * ```tsx
 * <Card title="Device Status" subtitle="Last seen 5 min ago">
 *   <p>Content here</p>
 * </Card>
 * ```
 */
const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "elevated", "outlined", "interactive"],
      description: "Visual style of the card",
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
      description: "Internal padding",
    },
    hoverable: {
      control: "boolean",
      description: "Whether the card responds to hover",
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default card with standard styling.
 */
export const Default: Story = {
  args: {
    children: "This is a basic card with some content inside.",
  },
};

/**
 * Card with title and subtitle.
 */
export const WithTitle: Story = {
  args: {
    title: "Device Status",
    subtitle: "Last seen 5 minutes ago",
    children: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Battery: 85% • Signal: Strong
        </p>
        <p className="text-sm text-muted-foreground">
          Location: Lagos, Nigeria
        </p>
      </div>
    ),
  },
};

/**
 * Elevated card with shadow.
 */
export const Elevated: Story = {
  args: {
    title: "Elevated Card",
    variant: "elevated",
    children: "This card has a shadow elevation effect.",
  },
};

/**
 * Outlined card with border.
 */
export const Outlined: Story = {
  args: {
    title: "Outlined Card",
    variant: "outlined",
    children: "This card has a visible border.",
  },
};

/**
 * Interactive card that responds to hover.
 */
export const Interactive: Story = {
  args: {
    title: "Interactive Card",
    variant: "interactive",
    hoverable: true,
    children: "Hover over me to see the effect!",
  },
};

/**
 * Card with no padding.
 */
export const NoPadding: Story = {
  args: {
    title: "No Padding",
    padding: "none",
    children: (
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 text-white">
        Full-bleed content with custom padding
      </div>
    ),
  },
};

/**
 * Device card example showing real-world usage.
 */
export const DeviceCard: Story = {
  render: () => (
    <Card variant="interactive" hoverable className="w-80">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-green-500">📱</span>
        </div>
        <div>
          <h3 className="font-semibold">Oluwanifemi's Phone</h3>
          <p className="text-sm text-muted-foreground">Samsung Galaxy S24</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Battery</span>
          <p className="font-medium">85%</p>
        </div>
        <div>
          <span className="text-muted-foreground">Signal</span>
          <p className="font-medium">Strong</p>
        </div>
        <div>
          <span className="text-muted-foreground">Last Seen</span>
          <p className="font-medium">2 min ago</p>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <p className="font-medium text-green-500">🟢 Online</p>
        </div>
      </div>
    </Card>
  ),
};

/**
 * Alert card for notifications.
 */
export const AlertCard: Story = {
  render: () => (
    <Card variant="outlined" className="w-80 border-red-500/50 bg-red-500/5">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <span>🚨</span>
        </div>
        <div>
          <h3 className="font-semibold text-red-500">Theft Detected</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Device moved outside safe zone at 14:32 UTC
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Location: Victoria Island, Lagos
          </p>
        </div>
      </div>
    </Card>
  ),
};
