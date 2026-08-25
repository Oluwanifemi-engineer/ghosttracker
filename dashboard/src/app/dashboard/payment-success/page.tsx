'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

/**
 * Payment success page — handles Paystack callback redirect.
 * Paystack adds ?reference=xxx to the callback URL.
 * We verify the payment server-side and show the result.
 */
export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference');

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      return;
    }

    const verify = async () => {
      try {
        const serverUrl = sessionStorage.getItem('mt_server_url') || 'https://api.magneetar.me';
        const apiKey = sessionStorage.getItem('mt_api_key');

        if (!apiKey) {
          setStatus('failed');
          return;
        }

        const res = await fetch(`${serverUrl}/payments/verify/${reference}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (res.ok) {
          const data = await res.json();
          setPlan(data.plan || '');
          setStatus('success');
          // Redirect to dashboard after 3 seconds
          setTimeout(() => router.push('/dashboard'), 3000);
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    };

    verify();
  }, [reference, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-5">
      <div className="max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 size={48} className="text-emerald-400 mx-auto animate-spin mb-6" />
            <h1 className="text-2xl font-bold text-white mb-3">Verifying payment…</h1>
            <p className="text-gray-400 text-sm">Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Payment successful!</h1>
            <p className="text-gray-400 text-sm mb-2">
              Your <span className="text-white font-semibold">{plan.replace(/_/g, ' ')}</span> subscription is now active.
            </p>
            <p className="text-gray-500 text-xs font-mono">Redirecting to dashboard in 3 seconds…</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Payment verification failed</h1>
            <p className="text-gray-400 text-sm mb-6">
              {!reference
                ? 'No payment reference found. Please try again.'
                : 'We couldn\'t verify your payment. If you were charged, contact support.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-colors"
              >
                Go to Dashboard
              </Link>
              <a
                href="mailto:sales@magneetar.me?subject=Payment%20Issue"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 transition-colors"
              >
                Contact Support
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
