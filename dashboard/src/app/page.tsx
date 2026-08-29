'use client';

import { useEffect, useState } from 'react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { SocialProof } from '@/components/landing/SocialProof';
import { Features } from '@/components/landing/Features';
import { Africa } from '@/components/landing/Africa';
import { Security } from '@/components/landing/Security';
import { Pricing } from '@/components/landing/Pricing';
import { OurStory } from '@/components/landing/OurStory';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';
import { Reveal } from '@/hooks/useScrollReveal';

export default function HomePage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const apiKey = sessionStorage.getItem('mt_api_key');
    setAuthed(Boolean(apiKey));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <LandingNav authed={authed} />
      <main>
        {/* 1. Hero — what it is */}
        <Hero authed={authed} />

        {/* 2. Product screenshots — what it looks like (honest, not mockups) */}
        <Reveal><ProductShowcase /></Reveal>

        {/* 3. Comparison — why it's better than alternatives */}
        <Reveal><ComparisonTable /></Reveal>

        {/* 4. Social proof — verifiable claims, not fictional testimonials */}
        <Reveal><SocialProof /></Reveal>

        {/* 5. Built for Africa — the problem */}
        <Reveal><Africa /></Reveal>

        {/* 6. Our Story — why this was built */}
        <Reveal><OurStory /></Reveal>

        {/* 7. Features — what it does */}
        <Reveal><Features /></Reveal>

        {/* 8. Security — how it's protected */}
        <Reveal><Security /></Reveal>

        {/* 9. Pricing → CTA → Footer */}
        <Reveal><Pricing authed={authed} /></Reveal>
        <Reveal><CTA authed={authed} /></Reveal>
      </main>
      <Footer />
    </div>
  );
}
