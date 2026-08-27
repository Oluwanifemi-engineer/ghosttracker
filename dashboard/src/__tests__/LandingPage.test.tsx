/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';

// A/B test mock — always use control variant in tests
jest.mock('@/lib/abTest', () => ({
  getVariant: () => 'control',
  trackConversion: jest.fn(),
  HERO_EXPERIMENT: { id: 'test', variants: ['control'] },
  HERO_COPY: {
    control: {
      headline: 'Protect what you own.\nStay close to who you love.',
      subheadline: 'In Nigeria, only 11.7% of stolen phones are ever recovered. Magneetar is built to change that number.',
    },
  },
}));

// next/link requires a router context in tests — render a plain anchor instead.
jest.mock('next/link', () => {
  const Link = ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  return Link;
});

import HomePage from '@/app/page';

async function renderPage() {
  await act(async () => {
    render(<HomePage />);
  });
}

describe('Landing Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders every landing section', async () => {
    await renderPage();

    // Nav
    expect(screen.getAllByText('MAGNEETAR').length).toBeGreaterThan(0);

    // Hero
    expect(screen.getAllByText(/Protect/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/close/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Galaxy S24 · Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Free for 1 device · No credit card required').length).toBeGreaterThan(0);

    // ProductShowcase (replaced VideoDemo)
    expect(screen.getByText('What you actually get.')).toBeInTheDocument();
    expect(screen.getByText('Command Center')).toBeInTheDocument();

    // ComparisonTable / Why Magneetar
    expect(screen.getByText('Not just another tracker.')).toBeInTheDocument();
    expect(screen.getAllByText('WHY MAGNEETAR').length).toBeGreaterThanOrEqual(1);

    // SocialProof
    expect(screen.getByText('Why people trust Magneetar.')).toBeInTheDocument();
    expect(screen.getAllByText('3s').length).toBeGreaterThanOrEqual(1);

    // Features grid — plain language, no jargon
    expect(screen.getAllByText('Theft Detection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('One-Tap Remote Control').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Photo & Audio Evidence').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Police-Ready Reports').length).toBeGreaterThanOrEqual(1);

    // Built for Africa
    expect(screen.getByText('THE PROBLEM')).toBeInTheDocument();
    expect(screen.getByText('25M+')).toBeInTheDocument();
    expect(screen.getByText('11.7%')).toBeInTheDocument();
    expect(screen.getByText('Fewer than 1 in 8 thefts end in recovery')).toBeInTheDocument();
    expect(screen.getByText(/National Bureau of Statistics/)).toBeInTheDocument();

    // Download APK links
    const apkLinks = screen.getAllByRole('link', { name: /download apk/i });
    expect(apkLinks.length).toBeGreaterThan(0);
    apkLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/download');
    });

    // No placeholder copy
    expect(screen.queryByText(/real adoption numbers coming as users arrive/i)).not.toBeInTheDocument();

    // Security — plain language
    expect(screen.getByText('Your phone has its own lock')).toBeInTheDocument();
    expect(screen.getByText('Your password is protected')).toBeInTheDocument();
    expect(screen.getByText('Lost your login? Kill it instantly')).toBeInTheDocument();

    // Pricing
    expect(screen.getByText('PRICING')).toBeInTheDocument();
    expect(screen.getByText('₦500')).toBeInTheDocument();
    expect(screen.getByText('₦1,500')).toBeInTheDocument();
    expect(screen.getByText('Up to 3 devices')).toBeInTheDocument();
    expect(screen.getByText('Up to 10 devices')).toBeInTheDocument();
    expect(screen.getByText('BEST VALUE')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();

    // CTA + Footer
    expect(screen.getByText('I have an account')).toBeInTheDocument();
    expect(screen.queryByText('API Docs (Swagger)')).not.toBeInTheDocument();
    expect(screen.queryByText('API Docs (ReDoc)')).not.toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getAllByText('ALL SYSTEMS OPERATIONAL').length).toBeGreaterThan(0);
  });

  it('shows sign-in / signup CTAs when not authenticated', async () => {
    await renderPage();
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Get Started Free').length).toBeGreaterThan(0);
    expect(screen.queryByText('Launch Dashboard')).not.toBeInTheDocument();
  });

  it('shows launch-dashboard CTAs when a session exists', async () => {
    sessionStorage.setItem('mt_server_url', 'https://api.magneetar.me');
    sessionStorage.setItem('mt_api_key', 'some-key');
    await renderPage();
    expect((await screen.findAllByText('Launch Dashboard')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open Command Center').length).toBeGreaterThan(0);
    expect(screen.queryByText('Get Started Free')).not.toBeInTheDocument();
  });

  it('toggles the mobile menu', async () => {
    await renderPage();
    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
