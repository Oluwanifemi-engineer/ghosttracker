'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { MapView } from '@/components/map/MapView';
import { CommandPanel } from '@/components/commands/CommandPanel';
import { MediaGallery } from '@/components/media/MediaGallery';
import { DevicePanel } from '@/components/devices/DevicePanel';
import { SentinelPanel } from '@/components/panels/SentinelPanel';
import { EvidencePanel } from '@/components/panels/EvidencePanel';
import { GeofencePanel } from '@/components/panels/GeofencePanel';
import { ErrorPanel } from '@/components/panels/ErrorPanel';
import { GuardianPanel } from '@/components/panels/GuardianPanel';
import { Tabs } from '@/components/ui/Tabs';
import { TabId } from '@/types';
import { Shield, Terminal, MapPin, Fence, Camera, ClipboardList, Bug, ShieldCheck } from 'lucide-react';

const PANEL_TABS = [
  { id: 'sentinel' as TabId, label: 'Sentinel', icon: Shield },
  { id: 'commands' as TabId, label: 'Commands', icon: Terminal },
  { id: 'location' as TabId, label: 'Location', icon: MapPin },
  { id: 'zones' as TabId, label: 'Zones', icon: Fence },
  { id: 'media' as TabId, label: 'Media', icon: Camera },
  { id: 'evidence' as TabId, label: 'Evidence', icon: ClipboardList },
  { id: 'guardian' as TabId, label: 'Guardian', icon: ShieldCheck },
  { id: 'errors' as TabId, label: 'Errors', icon: Bug },
];

export default function DashboardPage() {
  const { activeTab, setActiveTab, devices, selectedDeviceId } = useStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Milestone 2 P1 RBAC: a device_only share (status glance, no location)
  // must not see tabs whose endpoints would 403 — the server strips
  // coordinates anyway, so hiding them is honest UX, not the security
  // boundary (that is _assert_device_access min_role on every endpoint).
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const accessRole: 'owner' | 'admin' | 'viewer' | 'device_only' = selectedDevice?.access_role ?? 'owner';
  const visibleTabs = accessRole === 'device_only'
    ? PANEL_TABS.filter(t => !['location', 'zones', 'media', 'evidence'].includes(t.id))
    : PANEL_TABS;
  // If the active tab is hidden by the role (e.g. the user was on Location
  // and the selected device became a device_only share), fall back to a
  // visible tab so the panel area never renders blank.
  const effectiveTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : 'sentinel';

  return (
    <div className="flex h-full">
      {/* Map (Main Area) */}
      <MapView />

      {/* Right Panel */}
      <div className={`bg-mag-panel/90 backdrop-blur-xl border-l border-mag-border/60 flex flex-col transition-all duration-300 ease-out relative ${rightPanelOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        {/* Left gradient accent rail on the panel */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-mag-primary/20 to-transparent pointer-events-none" />
        {/* Top gradient hairline */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mag-primary/30 to-transparent pointer-events-none" />

        {/* Panel Toggle */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-50 w-5 h-10 flex items-center justify-center bg-mag-panel/90 border border-mag-border/60 rounded-l-lg hover:bg-mag-surface transition-colors shadow-sm group"
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-mag-text-dim/40 group-hover:text-mag-text-dim transition-transform duration-200 ${rightPanelOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {rightPanelOpen && (
          <>
            {/* Tabs */}
            <Tabs
              tabs={visibleTabs}
              activeTab={effectiveTab}
              onTabChange={setActiveTab}
            />

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {effectiveTab === 'sentinel' && <SentinelPanel />}
              {effectiveTab === 'commands' && <CommandPanel />}
              {effectiveTab === 'location' && <DevicePanel />}
              {effectiveTab === 'zones' && <GeofencePanel />}
              {effectiveTab === 'media' && <MediaGallery />}
              {effectiveTab === 'evidence' && <EvidencePanel />}
              {effectiveTab === 'guardian' && <GuardianPanel />}
              {effectiveTab === 'errors' && <ErrorPanel />}
            </div>

            {/* Panel footer */}
            <div className="px-4 py-2 border-t border-mag-border/30 flex items-center justify-between relative">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-mag-accent shadow-[0_0_6px_rgba(34,197,94,0.5)] animate-pulse-slow" />
                <span className="text-[8px] font-mono text-mag-accent/50 font-bold uppercase tracking-wider">Live</span>
              </div>
              <span className="text-[8px] font-mono text-mag-text-dim/25 font-bold uppercase tracking-wider">Magneetar OS</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
