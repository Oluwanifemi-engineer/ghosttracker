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

// Premium dark theme — bigger targets, smoother hover, stronger micro-interactions
const TONE_STYLES: Record<CommandTone, string> = {
  primary: 'border-emerald-500/15 text-emerald-400/80 hover:bg-emerald-500/12 hover:text-emerald-300 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  accent: 'border-blue-500/15 text-blue-400/80 hover:bg-blue-500/12 hover:text-blue-300 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]',
  warning: 'border-amber-500/15 text-amber-400/80 hover:bg-amber-500/12 hover:text-amber-300 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]',
  danger: 'border-red-500/15 text-red-400/80 hover:bg-red-500/12 hover:text-red-300 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]',
};

const TONE_ICON_BG: Record<CommandTone, string> = {
  primary: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
  accent: 'bg-blue-500/10 group-hover:bg-blue-500/20',
  warning: 'bg-amber-500/10 group-hover:bg-amber-500/20',
  danger: 'bg-red-500/10 group-hover:bg-red-500/20',
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
        'group relative flex flex-col items-center justify-center gap-2.5 py-5 px-3 rounded-xl border transition-all duration-200',
        'active:scale-[0.95]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        TONE_STYLES[tone],
      )}
    >
      {loading ? (
        <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
          'group-hover:scale-110 group-hover:rotate-3',
          TONE_ICON_BG[tone],
        )}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
      )}
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
    </button>
  );
}
