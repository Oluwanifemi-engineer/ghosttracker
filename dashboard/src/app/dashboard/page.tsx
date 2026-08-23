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
import { Shield, Terminal, MapPin, Fence, Camera, ClipboardList, Bug, ShieldCheck, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';

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

// Loading skeleton shown while Zustand persist hydrates from localStorage
function DashboardSkeleton() {
  return (
    <div className="flex h-full bg-gray-50">
      {/* Left sidebar skeleton */}
      <div className="w-72 border-r border-gray-200 bg-white p-4 space-y-4 shrink-0 hidden md:block">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      {/* Map skeleton */}
      <div className="flex-1 bg-gray-200 animate-pulse" />
      {/* Right panel skeleton */}
      <div className="w-80 border-l border-gray-200 bg-white p-4 space-y-4 shrink-0 hidden md:block">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeTab, setActiveTab, devices, selectedDeviceId, _hasHydrated } = useStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
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
    <div className="flex h-full relative bg-gray-50">
      {/* Map (Main Area) */}
      <div className="flex-1 h-full pb-14 md:pb-0">
        <MapView />
      </div>

      {/* ─── Right Panel Toggle Button — ALWAYS visible ── */}
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-50 w-6 h-16 items-center justify-center bg-white border border-gray-200 border-r-0 rounded-l-lg shadow-md hover:bg-gray-50 transition-colors group"
        style={{ right: rightPanelOpen ? '320px' : '0px', transition: 'right 0.3s ease-out' }}
        aria-label={rightPanelOpen ? 'Close panel' : 'Open panel'}
      >
        {rightPanelOpen ? (
          <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-700" />
        ) : (
          <ChevronLeft size={14} className="text-gray-400 group-hover:text-gray-700" />
        )}
      </button>

      {/* ─── Desktop Right Panel ────────────────────────────────────────── */}
      <div className={`hidden md:flex bg-white border-l border-gray-200 flex-col shadow-xl transition-all duration-300 ease-out ${rightPanelOpen ? 'w-80' : 'w-0'}`}>
        {rightPanelOpen && (
          <>
            {/* Tabs — Premium Style */}
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

            {/* Panel footer — Premium Status */}
            <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)] animate-pulse-slow" />
                <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-wider">Live</span>
              </div>
              <span className="text-[9px] font-mono text-gray-400 font-bold uppercase tracking-wider">Magneetar OS</span>
            </div>
          </>
        )}
      </div>

      {/* ─── Mobile Right Panel (Slide-in Drawer) ───────────────────────── */}
      {isMobile && rightPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setRightPanelOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-14 w-[85vw] max-w-sm z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right md:hidden">
            {/* Close button + tab indicator */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-mono font-bold text-gray-700 uppercase tracking-wider">
                  {effectiveTab}
                </span>
              </div>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Tab Pills */}
            <div className="flex gap-1.5 px-3 py-2.5 border-b border-gray-100 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                      effectiveTab === tab.id
                        ? 'bg-gray-900 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon size={13} />
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
