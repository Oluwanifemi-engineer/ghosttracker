import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'MAGNEETAR — Protect What You Own. Stay Close to Who You Love.',
  description:
    'Military-grade anti-theft tracking and live location circles for Android, built for Africa. Sentinel AI theft detection, real-time tracking, remote evidence capture, family & team circles, community recovery bounties, and a tactical command center — because only 11.7% of stolen phones are ever recovered.',
  keywords: [
    'anti-theft',
    'device tracking',
    'gps tracker',
    'smartphone security',
    'theft recovery',
    'phone theft Nigeria',
    'anti theft app Africa',
    'track stolen phone Nigeria',
    'find my family',
    'share location with family',
    'location sharing app',
    'keep in touch with family and coworkers',
    'Magneetar',
  ],
  openGraph: {
    title: 'MAGNEETAR — Protect What You Own. Stay Close to Who You Love.',
    description:
      'Built for Africa. Where phone theft is the most common crime — and only 11.7% of stolen phones are recovered — Magneetar changes that number while keeping families and teams connected.',
    type: 'website',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="application-name" content="MAGNEETAR" />
        <link rel="manifest" href="/manifest.json" />

      </head>
      <body className={`bg-mag-bg text-mag-text min-h-screen antialiased ${inter.variable} ${jetbrainsMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  // updateViaCache 'none': the browser must always revalidate
                  // sw.js from the network, so cache-version bumps (which purge
                  // stale static caches) reach every client on their next visit.
                  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
                    console.log('SW registered:', registration.scope);
                  }).catch((error) => {
                    console.log('SW registration failed:', error);
                  });
                });
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
