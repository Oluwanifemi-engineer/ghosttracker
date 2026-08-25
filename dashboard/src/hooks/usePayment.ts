'use client';

import { useState, useCallback } from 'react';
import { getAPI } from '@/lib/api';

/**
 * Hook for initiating Paystack payments.
 *
 * Flow:
 * 1. User clicks upgrade → call initPayment(plan)
 * 2. Redirects to Paystack checkout
 * 3. Paystack redirects back with ?reference=xxx
 * 4. Page calls verifyPayment(reference) to activate subscription
 */

const PLAN_MAP: Record<string, string> = {
  personal_monthly: 'personal_monthly',
  personal_yearly: 'personal_yearly',
  guardian_monthly: 'family_monthly',
  guardian_yearly: 'family_yearly',
};

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initPayment = useCallback(async (plan: string, email: string) => {
    setLoading(true);
    setError(null);

    try {
      const api = getAPI();
      const backendPlan = PLAN_MAP[plan] || plan;

      const result = await api.initializePayment(
        backendPlan,
        email,
        `${window.location.origin}/dashboard?payment=success&reference={reference}`
      );

      // Redirect to Paystack checkout
      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed');
      setLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (reference: string) => {
    try {
      const api = getAPI();
      const result = await api.verifyPayment(reference);
      return result;
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
      return null;
    }
  }, []);

  return { initPayment, verifyPayment, loading, error };
}
