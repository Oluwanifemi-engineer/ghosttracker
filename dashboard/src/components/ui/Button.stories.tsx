import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

/**
 * Button component for Magneetar dashboard.
 *
 * Supports multiple variants, sizes, and states for different use cases
 * across the dashboard UI.
 *
 * ## Usage
 * ```tsx
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="danger" loading>Sending...</Button>
 * ```
 */
const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/file/YOUR_FIGMA_FILE/Button?node-id=1-2",
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger", "ghost", "outline"],
      description: "Visual style of the button",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Size of the button",
    },
    disabled: {
      control: "boolean",
      description: "Whether the button is disabled",
    },
    loading: {
      control: "boolean",
      description: "Whether the button shows a loading spinner",
    },
    fullWidth: {
      control: "boolean",
      description: "Whether the button takes full width",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default button with primary variant.
 */
export const Primary: Story = {
  args: {
    children: "Primary Button",
    variant: "primary",
  },
};

/**
 * Secondary button for less prominent actions.
 */
export const Secondary: Story = {
  args: {
    children: "Secondary Button",
    variant: "secondary",
  },
};

/**
 * Danger button for destructive actions (delete, lock, wipe).
 */
export const Danger: Story = {
  args: {
    children: "Delete Device",
    variant: "danger",
  },
};

/**
 * Ghost button for minimal UI.
 */
export const Ghost: Story = {
  args: {
    children: "Ghost Button",
    variant: "ghost",
  },
};

/**
 * Outline button for secondary actions.
 */
export const Outline: Story = {
  args: {
    children: "Outline Button",
    variant: "outline",
  },
};

/**
 * Small button for compact UIs.
 */
export const Small: Story = {
  args: {
    children: "Small",
    size: "sm",
  },
};

/**
 * Large button for prominent CTAs.
 */
export const Large: Story = {
  args: {
    children: "Large Button",
    size: "lg",
  },
};

/**
 * Disabled button state.
 */
export const Disabled: Story = {
  args: {
    children: "Disabled",
    disabled: true,
  },
};

/**
 * Loading button state with spinner.
 */
export const Loading: Story = {
  args: {
    children: "Saving...",
    loading: true,
  },
};

/**
 * Full width button for forms.
 */
export const FullWidth: Story = {
  args: {
    children: "Full Width Button",
    fullWidth: true,
  },
};

/**
 * All variants displayed together for comparison.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex gap-2">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
    </div>
  ),
};
