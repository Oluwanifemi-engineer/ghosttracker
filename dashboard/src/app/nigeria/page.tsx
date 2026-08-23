import type { Metadata } from "next";
import { NigeriaLandingContent } from "./NigeriaLandingContent";

export const metadata: Metadata = {
  title: "Protect Your Phone in Nigeria — Free IMEI Check & Anti-Theft | Magneetar",
  description:
    "Nigeria loses 25 million phones per year. Only 5% are recovered. Magneetar gives you a free Trust Score to verify any phone, community bounties to recover stolen devices, and real-time tracking to keep your family safe. Download free.",
  keywords: [
    "phone theft Nigeria",
    "stolen phone recovery Nigeria",
    "IMEI check Nigeria",
    "phone tracking app Nigeria",
    "anti-theft app Nigeria",
    "protect phone Lagos",
    "phone security Africa",
    "find stolen phone Nigeria",
    "Magneetar Nigeria",
    "community phone recovery",
  ],
  openGraph: {
    title: "Protect Your Phone in Nigeria — Free IMEI Check & Anti-Theft | Magneetar",
    description:
      "Nigeria loses 25 million phones per year. Magneetar gives you free Trust Score verification, community recovery bounties, and real-time tracking.",
    type: "website",
    siteName: "Magneetar",
    url: "https://magneetar.me/nigeria",
  },
  twitter: {
    card: "summary_large_image",
    title: "Protect Your Phone in Nigeria | Magneetar",
    description:
      "25M phones stolen/year in Nigeria. Only 5% recovered. Magneetar changes that. Free Trust Score, community bounties, real-time tracking.",
  },
  alternates: {
    canonical: "https://magneetar.me/nigeria",
  },
};

export default function NigeriaPage() {
  return <NigeriaLandingContent />;
}
