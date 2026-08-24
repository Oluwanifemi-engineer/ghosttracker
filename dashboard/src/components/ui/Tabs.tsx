'use client';

import { cn } from '@/lib/utils';
import { TabId } from '@/types';
import { LucideIcon } from 'lucide-react';

interface Tab {
  id: TabId;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="grid grid-cols-3 border-b border-white/[0.06] bg-[#0a0a0f]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 px-1 py-3',
              'text-[10px] font-bold tracking-wide font-mono uppercase',
              'cursor-pointer transition-all duration-200',
              'border-b-2 border-transparent',
              isActive
                ? 'text-white border-emerald-500 bg-white/[0.04]'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]',
              'relative shrink-0 min-w-0'
            )}
          >
            {Icon && <Icon size={15} className={cn(isActive ? 'text-emerald-400' : 'text-white/20')} />}
            <span className="font-bold whitespace-nowrap">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-0.5 right-1 px-1.5 py-0.5 text-[7px] font-bold bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
