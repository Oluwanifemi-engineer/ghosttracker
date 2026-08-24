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
import {
  Shield, Terminal, MapPin, Fence, Camera,
  ClipboardList, Bug, ShieldCheck, Users,
  X, ChevronLeft, ChevronRight
} from 'lucide-react';

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

// Premium loading skeleton — dark theme, matches the production feel
function DashboardSkeleton() {
  return (
    <div className="flex h-full bg-[#0a0a0f]">
      {/* Left sidebar skeleton */}
      <div className="w-64 border-r border-white/[0.06] bg-[#0a0a0f] p-4 space-y-4 shrink-0 hidden md:block">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 bg-white/[0.06] rounded w-24 animate-pulse" />
            <div className="h-2 bg-white/[0.04] rounded w-16 animate-pulse" />
          </div>
        </div>
        <div className="h-px bg-white/[0.06]" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
      {/* Map skeleton */}
      <div className="flex-1 bg-[#0a0a0f] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.03] animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
        </div>
      </div>
      {/* Right panel skeleton */}
      <div className="w-80 border-l border-white/[0.06] bg-[#0a0a0f] p-4 space-y-4 shrink-0 hidden md:block">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 flex-1 bg-white/[0.04] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeTab, setActiveTab, devices, selectedDeviceId, _hasHydrated } = useStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const accessRole: 'owner' | 'admin' | 'viewer' | 'device_only' = selectedDevice?.access_role ?? 'owner';
  const visibleTabs = accessRole === 'device_only'
    ? PANEL_TABS.filter(t => !['location', 'zones', 'media', 'evidence'].includes(t.id))
    : PANEL_TABS;
  const effectiveTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : 'sentinel';

  if (!_hasHydrated) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex h-full relative bg-[#0a0a0f]">
      {/* ═══ Map (Full Width — Fills remaining space) ═══ */}
      <div className="flex-1 h-full pb-16 md:pb-0">
        <MapView />
      </div>

      {/* ═══ Right Panel Toggle — Premium floating button ═══ */}
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 z-50 w-6 h-16 items-center justify-center bg-[#111118]/90 backdrop-blur-xl border border-white/[0.10] rounded-l-xl shadow-2xl hover:bg-[#1a1a24] hover:border-white/[0.15] transition-all duration-200 group"
        style={{ right: rightPanelOpen ? '320px' : '0px', transition: 'right 0.3s cubic-bezier(0.16,1,0.3,1)' }}
        aria-label={rightPanelOpen ? 'Close panel' : 'Open panel'}
      >
        {rightPanelOpen ? (
          <ChevronRight size={13} className="text-white/40 group-hover:text-white/80 transition-colors" />
        ) : (
          <ChevronLeft size={13} className="text-white/40 group-hover:text-white/80 transition-colors" />
        )}
      </button>

      {/* ═══ Desktop Right Panel — Premium Dark ═══ */}
      <div
        className={`hidden md:flex bg-[#0a0a0f] border-l border-white/[0.06] flex-col shadow-2xl transition-all duration-300 ease-out ${
          rightPanelOpen ? 'w-80' : 'w-0'
        }`}
      >
        {rightPanelOpen && (
          <>
            {/* Tabs — Premium Dark Style */}
            <Tabs
              tabs={visibleTabs}
              activeTab={effectiveTab}
              onTabChange={setActiveTab}
            />

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

            {/* Panel Footer — Premium Status Bar */}
            <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between bg-[#0a0a0f]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-400/80 font-bold uppercase tracking-wider">Live</span>
              </div>
              <span className="text-[8px] font-mono text-white/20 font-bold uppercase tracking-wider">Magneetar OS</span>
            </div>
          </>
        )}
      </div>

      {/* ═══ Mobile Right Panel (Slide-in Drawer) ═══ */}
      {isMobile && rightPanelOpen && (
        <>
          {/* Backdrop — blur effect */}
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden"
            onClick={() => setRightPanelOpen(false)}
          />
          {/* Drawer — premium dark */}
          <div className="fixed top-0 right-0 bottom-16 w-[85vw] max-w-sm z-50 bg-[#0a0a0f] border-l border-white/[0.06] shadow-2xl flex flex-col md:hidden">
            {/* Close button + tab indicator */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-wider">
                  {effectiveTab}
                </span>
              </div>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.06] transition-colors"
              >
                <X size={16} className="text-white/40" />
              </button>
            </div>

            {/* Tab Pills — scrollable */}
            <div className="flex gap-1.5 px-3 py-2.5 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all duration-200 ${
                      effectiveTab === tab.id
                        ? 'bg-white text-[#0a0a0f] shadow-lg'
                        : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.1] hover:text-white/70'
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

      {/* ═══ Mobile Bottom Tab Bar — Premium Dark ═══ */}
      {isMobile && (
        <>
          {/* Floating panel toggle button */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="fixed bottom-[4.5rem] right-3 z-30 w-11 h-11 rounded-full bg-white text-[#0a0a0f] shadow-2xl flex items-center justify-center active:scale-95 transition-transform md:hidden"
            aria-label={rightPanelOpen ? 'Close panel' : 'Open panel'}
          >
            {rightPanelOpen ? <X size={18} /> : <Terminal size={18} />}
          </button>
          <MobileBottomNav />
        </>
      )}
    </div>
  );
}
