'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Radar,
  Camera,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Users,
  BellRing,
  Check,
  X,
  Download,
} from 'lucide-react';

interface OnboardingStep {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <Smartphone size={28} className="text-mag-primary" />,
    title: 'Install Magneetar',
    description: 'Download the APK and install it on your Android device. Grant all permissions for full protection.',
    highlight: 'Takes less than 2 minutes',
  },
  {
    id: 2,
    icon: <ShieldCheck size={28} className="text-mag-primary" />,
    title: 'Link Your Device',
    description: 'Sign in with your account and link your device. The app runs silently in the background.',
    highlight: 'One-time setup',
  },
  {
    id: 3,
    icon: <Radar size={28} className="text-mag-primary" />,
    title: 'Stay Protected',
    description: 'Sentinel AI monitors your device 24/7. Get instant alerts if theft is detected.',
    highlight: 'Always watching',
  },
  {
    id: 4,
    icon: <MapPin size={28} className="text-mag-primary" />,
    title: 'Track & Recover',
    description: 'View live location, get a navigation route to your device, and capture evidence remotely.',
    highlight: 'Real-time recovery',
  },
  {
    id: 5,
    icon: <Users size={28} className="text-mag-primary" />,
    title: 'Protect Your Circle',
    description: 'Add family and team members to your circle. Everyone stays connected and protected.',
    highlight: 'Family & team safety',
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsExiting(true);
      setTimeout(onComplete, 500);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(onSkip, 500);
  };

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-mag-bg/95 backdrop-blur-xl transition-opacity duration-500 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Background effects */}
      <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-mag-primary/[0.07] blur-[120px] animate-aurora pointer-events-none" />
      <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-mag-secondary/[0.05] blur-[130px] animate-aurora pointer-events-none" style={{ animationDelay: '4s' }} />
      <div className="absolute inset-0 mag-grid-bg opacity-20" />

      {/* Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-all z-10"
      >
        <X size={18} />
      </button>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg mx-5">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-8 bg-mag-primary'
                  : i < currentStep
                    ? 'w-4 bg-mag-primary/50'
                    : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="premium-card p-8 sm:p-10 text-center">
          {/* Icon with animation */}
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-2xl bg-mag-primary/10 border border-mag-primary/20 flex items-center justify-center animate-fade-in">
              {step.icon}
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-mag-primary/30 animate-ping opacity-30" />
          </div>

          {/* Step number */}
          <div className="text-[10px] font-mono font-bold text-mag-primary tracking-[0.3em] mb-3">
            STEP {step.id} OF {ONBOARDING_STEPS.length}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-display font-extrabold tracking-tight text-white mb-3">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-white/60 leading-relaxed mb-4 max-w-sm mx-auto">
            {step.description}
          </p>

          {/* Highlight badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-mag-primary/20 bg-mag-primary/10">
            <Check size={12} className="text-mag-primary" />
            <span className="text-[11px] font-mono font-bold text-mag-primary">{step.highlight}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider bg-gradient-to-r from-mag-primary to-mag-secondary text-white shadow-lg shadow-mag-primary/20 hover:shadow-mag-primary/40 hover:brightness-110 transition-all active:scale-[0.97]"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? (
              <>
                Get Started
                <ShieldCheck size={14} />
              </>
            ) : (
              <>
                Next
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

        {/* Skip link */}
        <div className="text-center mt-6">
          <button
            onClick={handleSkip}
            className="text-[11px] font-mono text-white/40 hover:text-white/60 transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

// Onboarding check hook
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('mt_onboarding_complete');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('mt_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('mt_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  return { showOnboarding, completeOnboarding, skipOnboarding };
}
