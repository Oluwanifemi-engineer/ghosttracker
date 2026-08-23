'use client';

import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { LogOut } from 'lucide-react';

export function Header() {
  const {
    isConnected, logout,
  } = useStore();

  return (
    <header className="h-10 bg-[#0a0a0f] border-b border-white/[0.06] flex items-center px-4 gap-3 z-50 relative">
      {/* Status */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-1.5 h-1.5 rounded-full transition-all duration-300',
          isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse' : 'bg-white/20'
        )} />
        <span className={cn(
          'text-[9px] font-mono uppercase tracking-widest font-bold transition-colors',
          isConnected ? 'text-emerald-400/70' : 'text-white/30'
        )}>
          {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>

      <div className="flex-1" />

      {/* Disconnect */}
      <button
        onClick={logout}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-mono font-bold text-white/30 hover:text-red-400/70 hover:bg-red-500/[0.06] border border-transparent hover:border-red-500/15 transition-all"
      >
        <LogOut size={10} />
        DISCONNECT
      </button>
    </header>
  );
}
