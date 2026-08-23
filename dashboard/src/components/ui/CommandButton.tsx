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

// Premium dark theme — solid colors, smooth transitions, micro-interactions
const TONE_STYLES: Record<CommandTone, string> = {
  primary: 'border-white/[0.08] text-white/60 hover:bg-emerald-500/15 hover:text-emerald-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10',
  accent: 'border-white/[0.08] text-white/60 hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10',
  warning: 'border-white/[0.08] text-white/60 hover:bg-amber-500/15 hover:text-amber-300 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10',
  danger: 'border-white/[0.08] text-white/60 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10',
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
        'group relative flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border-2 transition-all duration-200',
        'active:scale-[0.95]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        TONE_STYLES[tone],
      )}
    >
      {loading ? (
        <div className="w-7 h-7 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center transition-all duration-200 group-hover:bg-white/[0.1] group-hover:scale-110">
          <Icon size={15} strokeWidth={2.2} />
        </div>
      )}
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
    </button>
  );
}
