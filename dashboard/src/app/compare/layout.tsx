import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Magneetar vs Cerberus vs Prey vs Google Find My — Full Comparison",
  description:
    "Compare Magneetar with Cerberus, Prey, and Google Find My Device. 35+ features compared: tracking, anti-theft, community recovery, family safety, pricing. See why Magneetar is the best anti-theft app for Africa.",
  keywords: [
    "best anti-theft app 2026",
    "Cerberus vs Magneetar",
    "Prey vs Magneetar",
    "Google Find My Device alternative",
    "phone tracking app comparison",
    "anti-theft app Nigeria",
    "best phone recovery app Africa",
    "phone security app review",
    "Magneetar review",
    "community phone recovery",
  ],
  openGraph: {
    title: "Magneetar vs Cerberus vs Prey vs Google Find My — Full Comparison",
    description:
      "35+ features compared. See why Magneetar's community recovery, AI geofencing, and Naira pricing make it the best anti-theft app for Africa.",
    type: "website",
    siteName: "Magneetar",
    url: "https://magneetar.me/compare",
  },
  twitter: {
    card: "summary_large_image",
    title: "Magneetar vs Cerberus vs Prey vs Google Find My",
    description:
      "35+ features compared. Community recovery, AI geofencing, Naira pricing. The best anti-theft app for Africa.",
  },
  alternates: {
    canonical: "https://magneetar.me/compare",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ComparisonProduct",
            name: "Magneetar Anti-Theft App",
            url: "https://magneetar.me/compare",
            description:
              "Compare Magneetar with Cerberus, Prey, and Google Find My Device. Community recovery, AI geofencing, and Africa-first pricing.",
            provider: {
              "@type": "Organization",
              name: "Magneetar",
              url: "https://magneetar.me",
            },
            offers: {
              "@type": "AggregateOffer",
              lowPrice: "0",
              highPrice: "3000",
              priceCurrency: "NGN",
              offerCount: "3",
            },
            review: {
              "@type": "Review",
              reviewRating: {
                "@type": "Rating",
                ratingValue: "4.8",
                bestRating: "5",
              },
              author: {
                "@type": "Organization",
                name: "Magneetar",
              },
            },
          }),
        }}
      />
      {children}
    </>
  );
}
