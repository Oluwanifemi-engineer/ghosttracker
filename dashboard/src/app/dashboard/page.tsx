'use client';

import { useState, useEffect } from 'react';
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
import { FamilyCircle } from '@/components/family/FamilyCircle';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TabId } from '@/types';
import { Shield, Terminal, MapPin, Fence, Camera, ClipboardList, Bug, ShieldCheck, Users, X } from 'lucide-react';

const PANEL_TABS = [
  { id: 'sentinel' as TabId, label: 'Sentinel', icon: Shield },
  { id: 'commands' as TabId, label: 'Commands', icon: Terminal },
  { id: 'location' as TabId, label: 'Location', icon: MapPin },
  { id: 'zones' as TabId, label: 'Zones', icon: Fence },
  { id: 'media' as TabId, label: 'Media', icon: Camera },
  { id: 'evidence' as TabId, label: 'Evidence', icon: ClipboardList },
  { id: 'guardian' as TabId, label: 'Guardian', icon: ShieldCheck },
  { id: 'family' as TabId, label: 'Family', icon: Users },
  { id: 'errors' as TabId, label: 'Errors', icon: Bug },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export default function DashboardPage() {
  const { activeTab, setActiveTab, devices, selectedDeviceId } = useStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const isMobile = useIsMobile();

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
    <div className="flex h-full relative">
      {/* Map (Main Area) */}
      <div className="flex-1 h-full pb-14 md:pb-0">
        <MapView />
      </div>

      {/* ─── Desktop Right Panel ────────────────────────────────────────── */}
      <div className={`hidden md:flex bg-white border-l border-gray-200 flex-col transition-all duration-300 ease-out relative ${rightPanelOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        {/* Subtle left accent rail */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent pointer-events-none" />

        {/* Panel Toggle */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-50 w-5 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-l-lg hover:bg-gray-50 transition-colors shadow-sm group"
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-gray-400 group-hover:text-gray-600 transition-transform duration-200 ${rightPanelOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {rightPanelOpen && (
          <>
            {/* Tabs — Military Style */}
            <Tabs
              tabs={visibleTabs}
              activeTab={effectiveTab}
              onTabChange={setActiveTab}
            />

            {/* Tab Content — each panel wrapped in ErrorBoundary so a
                render crash in one panel doesn't take down the whole dashboard */}
            <div className="flex-1 overflow-y-auto">
              {effectiveTab === 'sentinel' && <ErrorBoundary><SentinelPanel /></ErrorBoundary>}
              {effectiveTab === 'commands' && <ErrorBoundary><CommandPanel /></ErrorBoundary>}
              {effectiveTab === 'location' && <ErrorBoundary><DevicePanel /></ErrorBoundary>}
              {effectiveTab === 'zones' && <ErrorBoundary><GeofencePanel /></ErrorBoundary>}
              {effectiveTab === 'media' && <ErrorBoundary><MediaGallery /></ErrorBoundary>}
              {effectiveTab === 'evidence' && <ErrorBoundary><EvidencePanel /></ErrorBoundary>}
              {effectiveTab === 'guardian' && <ErrorBoundary><GuardianPanel /></ErrorBoundary>}
              {effectiveTab === 'family' && (
                <ErrorBoundary>
                  <div className="p-4">
                    <FamilyCircle />
                  </div>
                </ErrorBoundary>
              )}
              {effectiveTab === 'errors' && <ErrorBoundary><ErrorPanel /></ErrorBoundary>}
            </div>

            {/* Panel footer — Military Status */}
            <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-between relative">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)] animate-pulse-slow" />
                <span className="text-[8px] font-mono text-emerald-600 font-bold uppercase tracking-wider">Live</span>
              </div>
              <span className="text-[8px] font-mono text-gray-400 font-bold uppercase tracking-wider">Magneetar OS</span>
            </div>
          </>
        )}
      </div>

      {/* ─── Mobile Right Panel (Slide-in Drawer) ───────────────────────── */}
      {isMobile && rightPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setRightPanelOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-14 w-[85vw] max-w-sm z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right md:hidden">
            {/* Close button + tab indicator */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-mono font-bold text-gray-700 uppercase tracking-wider">
                  {effectiveTab}
                </span>
              </div>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Tab Pills */}
            <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                      effectiveTab === tab.id
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {effectiveTab === 'sentinel' && <ErrorBoundary><SentinelPanel /></ErrorBoundary>}
              {effectiveTab === 'commands' && <ErrorBoundary><CommandPanel /></ErrorBoundary>}
              {effectiveTab === 'location' && <ErrorBoundary><DevicePanel /></ErrorBoundary>}
              {effectiveTab === 'zones' && <ErrorBoundary><GeofencePanel /></ErrorBoundary>}
              {effectiveTab === 'media' && <ErrorBoundary><MediaGallery /></ErrorBoundary>}
              {effectiveTab === 'evidence' && <ErrorBoundary><EvidencePanel /></ErrorBoundary>}
              {effectiveTab === 'guardian' && <ErrorBoundary><GuardianPanel /></ErrorBoundary>}
              {effectiveTab === 'family' && (
                <ErrorBoundary>
                  <div className="p-4">
                    <FamilyCircle />
                  </div>
                </ErrorBoundary>
              )}
              {effectiveTab === 'errors' && <ErrorBoundary><ErrorPanel /></ErrorBoundary>}
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Tab Bar */}
      {isMobile && (
        <>
          {/* Floating panel toggle button on mobile (bottom right) */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="fixed bottom-16 right-3 z-30 w-12 h-12 rounded-full bg-gray-900 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform md:hidden"
            aria-label={rightPanelOpen ? 'Close panel' : 'Open panel'}
          >
            {rightPanelOpen ? <X size={20} /> : <Terminal size={20} />}
          </button>
          <MobileBottomNav />
        </>
      )}
    </div>
  );
}
