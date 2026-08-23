import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check If a Phone is Stolen — Free IMEI Verification | Magneetar",
  description:
    "Free instant IMEI check — verify any phone's trust score before buying. See theft status, owner verification, and community reports. Protect yourself from buying stolen phones in Nigeria.",
  keywords: [
    "IMEI check Nigeria",
    "check if phone is stolen",
    "phone trust score",
    "IMEI verification free",
    "stolen phone check",
    "buy used phone safely",
    "phone authenticity check",
    "verify IMEI number",
    "Nigeria phone theft prevention",
    "Magneetar trust score",
  ],
  openGraph: {
    title: "Free IMEI Check — Is This Phone Stolen? | Magneetar",
    description:
      "Verify any phone's trust score instantly. Free IMEI check shows theft status, owner verification, and community reports. Protect yourself from buying stolen phones.",
    type: "website",
    siteName: "Magneetar",
    url: "https://magneetar.me/trust",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free IMEI Check — Is This Phone Stolen? | Magneetar",
    description:
      "Verify any phone's trust score instantly. Free IMEI check shows theft status and owner verification.",
  },
  alternates: {
    canonical: "https://magneetar.me/trust",
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

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Magneetar Trust Score",
            url: "https://magneetar.me/trust",
            description:
              "Free IMEI verification and phone trust score checker. Verify any phone before buying.",
            applicationCategory: "SecurityApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "NGN",
            },
            provider: {
              "@type": "Organization",
              name: "Magneetar",
              url: "https://magneetar.me",
            },
          }),
        }}
      />
      {children}
    </>
  );
}
