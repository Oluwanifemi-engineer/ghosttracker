'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type CommandTone = 'primary' | 'accent' | 'warning' | 'danger';

interface CommandButtonProps {
  command: string;
  label: string;
  icon: LucideIcon;
  tone?: CommandTone;
  loading?: boolean;
  disabled?: boolean;
  onSend: () => void;
  title?: string;
}

// Military-grade styling: solid borders, clean transitions, no broken hover states
const TONE_STYLES: Record<CommandTone, string> = {
  primary: 'border-gray-200 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900',
  accent: 'border-gray-200 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600',
  warning: 'border-amber-200 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500',
  danger: 'border-red-200 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500',
};

export function CommandButton({
  command,
  label,
  icon: Icon,
  tone = 'primary',
  loading,
  disabled,
  onSend,
  title,
}: CommandButtonProps) {
  return (
    <button
      onClick={onSend}
      disabled={loading || disabled}
      title={title}
      aria-label={label}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all duration-150',
        'active:scale-[0.97]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        TONE_STYLES[tone],
      )}
    >
      {loading ? (
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <span className="w-8 h-8 rounded-lg bg-current/5 border border-current/10 flex items-center justify-center transition-all duration-150 group-hover:bg-white/20 group-hover:border-white/30">
          <Icon size={15} strokeWidth={2.2} />
        </span>
      )}
      <span className="text-[8px] font-mono font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
    </button>
  );
}
