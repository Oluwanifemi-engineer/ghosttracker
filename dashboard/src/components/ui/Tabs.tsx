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
    <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50/50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2 py-2.5',
              'text-[11px] font-bold tracking-wide font-mono uppercase',
              'cursor-pointer transition-all duration-200',
              'border-b-2 border-transparent',
              isActive
                ? 'text-gray-900 border-gray-900 bg-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              'relative shrink-0 min-w-0 flex-col gap-1'
            )}
          >
            {Icon && <Icon size={14} className={cn(isActive ? 'text-gray-900' : 'text-gray-400')} />}
            <span className="font-bold whitespace-nowrap text-[10px]">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-0.5 right-1 px-1.5 py-0.5 text-[8px] font-bold bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
