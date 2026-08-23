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

// Premium command button styling — solid colors, smooth transitions, no broken states
const TONE_STYLES: Record<CommandTone, string> = {
  primary: 'border-gray-200 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 hover:shadow-lg',
  accent: 'border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-lg',
  warning: 'border-amber-200 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-lg',
  danger: 'border-red-200 text-red-700 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-lg',
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
        'active:scale-[0.97]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        TONE_STYLES[tone],
      )}
    >
      {loading ? (
        <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        <div className="w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center transition-all duration-200 group-hover:bg-white/20 group-hover:scale-110">
          <Icon size={16} strokeWidth={2.2} />
        </div>
      )}
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
    </button>
  );
}
