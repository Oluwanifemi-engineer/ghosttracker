'use client';

import { useEffect, useState } from 'react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Africa } from '@/components/landing/Africa';
import { Provenance } from '@/components/landing/Provenance';
import { Security } from '@/components/landing/Security';
import { Pricing } from '@/components/landing/Pricing';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';
import { Reveal } from '@/hooks/useScrollReveal';

export default function HomePage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const serverUrl = sessionStorage.getItem('mt_server_url');
    const apiKey = sessionStorage.getItem('mt_api_key');
    setAuthed(Boolean(serverUrl && apiKey));
  }, []);

  return (
    <div className="min-h-screen bg-mag-bg text-white overflow-x-hidden">
      <LandingNav authed={authed} />
      <main>
        <Hero authed={authed} />
        <Reveal delay={0}>
          <Features />
        </Reveal>
        <Reveal delay={100}>
          <HowItWorks />
        </Reveal>
        <Reveal delay={100}>
          <Africa />
        </Reveal>
        <Reveal delay={100}>
          <Provenance />
        </Reveal>
        <Reveal delay={100}>
          <Security />
        </Reveal>
        <Reveal delay={100}>
          <Pricing authed={authed} />
        </Reveal>
        <Reveal delay={100}>
          <CTA authed={authed} />
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
