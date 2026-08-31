/**
 * Figma Code Connect: Card Component
 *
 * Connects Figma Card component to React Card component.
 */

import figma from "@figma/code-connect";
import { Card } from "./Card";

export const CardConnect = figma(
  "<Card>"
)
  .displayName("Card")
  .description("Container component for grouping related content")
  .link("https://www.figma.com/file/YOUR_FIGMA_FILE/Card?node-id=3-4")

  .props({
    variant: figma.enum("variant", {
      "Default": "default",
      "Elevated": "elevated",
      "Outlined": "outlined",
      "Interactive": "interactive",
    }).default("default"),

    title: figma.string("title").default(""),
    subtitle: figma.string("subtitle").default(""),

    padding: figma.enum("padding", {
      "None": "none",
      "Small": "sm",
      "Medium": "md",
      "Large": "lg",
    }).default("md"),

    hoverable: figma.boolean("hoverable").default(false),

    children: figma.children("Content"),
  })
  .variant("Default", {
    variant: "default",
    title: "Card Title",
    subtitle: "Card subtitle",
  })
  .variant("Elevated", {
    variant: "elevated",
    title: "Elevated Card",
  })
  .variant("Outlined", {
    variant: "outlined",
    title: "Outlined Card",
  })
  .variant("Interactive", {
    variant: "interactive",
    hoverable: true,
    title: "Interactive Card",
  });

export default CardConnect;
