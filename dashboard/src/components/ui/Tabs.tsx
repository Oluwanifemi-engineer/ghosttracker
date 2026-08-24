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
    <div className="flex gap-1 p-2 border-b border-white/[0.06] bg-[#0a0a0f] overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap',
              'text-[10px] font-bold font-mono uppercase tracking-wider',
              'cursor-pointer transition-all duration-200',
              'active:scale-[0.97] shrink-0',
              isActive
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06] bg-white/[0.03]',
            )}
          >
            {Icon && <Icon size={12} strokeWidth={2.5} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-[7px] font-bold bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
