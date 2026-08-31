/**
 * Figma Code Connect: Button Component
 *
 * This file connects the Figma Button component to the React Button component.
 * It enables:
 * - Automatic prop mapping from Figma to React
 * - Design-to-code documentation
 * - AI-powered code generation from Figma designs
 *
 * Usage:
 *   1. Install Figma Code Connect CLI: npm install -g @figma/code-connect
 *   2. Run: figma connect src/components/ui/Button.figma.tsx
 *   3. View in Figma: Components panel shows connected code
 */

import figma from "@figma/code-connect";
import { Button } from "./Button";

/**
 * Connect Figma Button component to React Button component
 */
export const ButtonConnect = figma(
  "<Button>"
)
  .displayName("Button")
  .description("Interactive button component for user actions")

  // Link to Figma component
  .link("https://www.figma.com/file/YOUR_FIGMA_FILE/Button?node-id=1-2")

  // Map Figma properties to React props
  .props({
    // Variant mapping
    variant: figma.enum("variant", {
      "Primary": "primary",
      "Secondary": "secondary",
      "Danger": "danger",
      "Ghost": "ghost",
      "Outline": "outline",
    }).default("primary"),

    // Size mapping
    size: figma.enum("size", {
      "Small": "sm",
      "Medium": "md",
      "Large": "lg",
    }).default("md"),

    // Text content
    children: figma.string("label").default("Button"),

    // Boolean props
    disabled: figma.boolean("disabled").default(false),
    loading: figma.boolean("loading").default(false),
    fullWidth: figma.boolean("fullWidth").default(false),

    // Click handler
    onClick: figma.function("onClick", () => {
      console.log("Button clicked");
    }),
  })

  // Example variants
  .variant("Primary", {
    variant: "primary",
    children: "Primary Button",
  })
  .variant("Secondary", {
    variant: "secondary",
    children: "Secondary Button",
  })
  .variant("Danger", {
    variant: "danger",
    children: "Delete",
  })
  .variant("Small", {
    size: "sm",
    children: "Small",
  })
  .variant("Large", {
    size: "lg",
    children: "Large",
  })
  .variant("Disabled", {
    disabled: true,
    children: "Disabled",
  })
  .variant("Loading", {
    loading: true,
    children: "Loading...",
  });

export default ButtonConnect;
