import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Center items in canvas
    layout: "centered",
    // Chromatic configuration for visual testing
    chromatic: {
      viewports: [320, 768, 1024, 1440],
      delay: 300,
      pauseAnimationAtEnd: true,
    },
    // A11y defaults
    a11y: {
      element: "#root",
      config: {},
      options: {},
    },
    // Backgrounds
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#0a0a0a",
        },
        {
          name: "card",
          value: "#1a1a2e",
        },
      ],
    },
    // Viewport presets for responsive testing
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "812px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1440px", height: "900px" },
        },
      },
    },
  },
  // Global decorators
  decorators: [
    // Theme provider wrapper (if using a theme context)
    (Story) => (
      <div className="min-h-screen bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
};

export default preview;
