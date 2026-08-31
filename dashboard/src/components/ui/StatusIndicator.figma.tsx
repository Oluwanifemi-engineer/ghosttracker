/**
 * Figma Code Connect: StatusIndicator Component
 *
 * Connects Figma Status Badge component to React StatusIndicator component.
 */

import figma from "@figma/code-connect";
import { StatusIndicator } from "./StatusIndicator";

export const StatusIndicatorConnect = figma(
  "<StatusIndicator>"
)
  .displayName("StatusIndicator")
  .description("Visual indicator for device/connection status")
  .link("https://www.figma.com/file/YOUR_FIGMA_FILE/StatusBadge?node-id=5-6")

  .props({
    status: figma.enum("status", {
      "Online": "online",
      "Offline": "offline",
      "Stolen": "stolen",
      "Warning": "warning",
      "Unknown": "unknown",
    }).default("online"),

    showLabel: figma.boolean("showLabel").default(false),
    pulse: figma.boolean("pulse").default(false),

    size: figma.enum("size", {
      "Small": "sm",
      "Medium": "md",
      "Large": "lg",
    }).default("md"),
  })
  .variant("Online", {
    status: "online",
    showLabel: true,
  })
  .variant("Offline", {
    status: "offline",
    showLabel: true,
  })
  .variant("Stolen", {
    status: "stolen",
    showLabel: true,
    pulse: true,
  })
  .variant("Warning", {
    status: "warning",
    showLabel: true,
  })
  .variant("Small", {
    status: "online",
    size: "sm",
    showLabel: true,
  })
  .variant("Large", {
    status: "online",
    size: "lg",
    showLabel: true,
  });

export default StatusIndicatorConnect;
