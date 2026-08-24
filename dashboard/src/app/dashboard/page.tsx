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
import { FloatingActions } from '@/components/map/FloatingActions';
import { DeviceDrawer } from '@/components/layout/DeviceDrawer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MobileTabBar } from '@/components/ui/MobileTabBar';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TabId } from '@/types';
import { cn, isOnline, deviceDisplayName, relativeTime } from '@/lib/utils';
import {
  Shield, Terminal, MapPin, Fence, Camera,
  ClipboardList, Bug, ShieldCheck, Users,
  ChevronLeft, ChevronRight, Menu, Radio
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

function DashboardSkeleton() {
  return (
    <div className="flex h-full bg-[#0a0a0f]">
      <div className="w-64 border-r border-white/[0.06] bg-[#0a0a0f] p-4 space-y-4 shrink-0 hidden md:block">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 bg-white/[0.06] rounded w-24 animate-pulse" />
            <div className="h-2 bg-white/[0.04] rounded w-16 animate-pulse" />
          </div>
        </div>
        <div className="h-px bg-white/[0.06]" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 bg-[#0a0a0f] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.03] animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
        </div>
      </div>
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

function TabContent({ tab }: { tab: TabId }) {
  return (
    <ErrorBoundary>
      {tab === 'sentinel' && <SentinelPanel />}
      {tab === 'commands' && <CommandPanel />}
      {tab === 'location' && <DevicePanel />}
      {tab === 'zones' && <GeofencePanel />}
      {tab === 'media' && <MediaGallery />}
      {tab === 'evidence' && <EvidencePanel />}
      {tab === 'guardian' && <GuardianPanel />}
      {tab === 'family' && <div className="p-4"><FamilyCircle /></div>}
      {tab === 'errors' && <ErrorPanel />}
    </ErrorBoundary>
  );
}

/**
 * Mobile Peek Content — shows inside the bottom sheet at peek state.
 * Displays selected device name, online status, and distance.
 */
function MobilePeekContent() {
  const { devices, selectedDeviceId } = useStore();
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  if (!selectedDevice) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
          <Radio size={16} className="text-white/25" />
        </div>
        <div>
          <div className="text-[12px] font-bold text-white/50">No device selected</div>
          <div className="text-[9px] font-mono text-white/20">Open device list to select one</div>
        </div>
      </div>
    );
  }

  const online = isOnline(selectedDevice.last_seen);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center',
          online ? 'bg-emerald-500/10' : 'bg-white/[0.04]'
        )}>
          <span className={cn(
            'w-2.5 h-2.5 rounded-full',
            online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-white/20'
          )} />
        </div>
        <div>
          <div className="text-[13px] font-bold text-white/85">{deviceDisplayName(selectedDevice)}</div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[9px] font-mono font-bold uppercase',
              online ? 'text-emerald-400/70' : 'text-white/25'
            )}>
              {online ? 'Online' : 'Offline'}
            </span>
            <span className="text-[8px] font-mono text-white/20">·</span>
            <span className="text-[9px] font-mono text-white/25">{relativeTime(selectedDevice.last_seen)}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-mono font-bold text-white/30 tabular-nums">
          {selectedDevice.sentinel_score}
        </div>
        <div className="text-[7px] font-mono text-white/15 uppercase">Score</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeTab, setActiveTab, devices, selectedDeviceId, _hasHydrated, setSidebarOpen } = useStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileSheetState, setMobileSheetState] = useState<'peek' | 'half' | 'full' | 'hidden'>('peek');
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

  // ═══════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT — Apple Find My / Google Maps pattern
  // Map is fullscreen. Everything else is in bottom sheets and drawers.
  // ═══════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
        {/* Full-screen map */}
        <div className="absolute inset-0 z-0">
          <MapView />
        </div>

        {/* Device list drawer (slides from left) */}
        <DeviceDrawer />

        {/* Floating quick actions on map */}
        <FloatingActions />

        {/* Device list toggle — top-left */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-[1500] w-10 h-10 rounded-xl bg-[#111118]/90 backdrop-blur-xl border border-white/[0.10] flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          aria-label="Open device list"
        >
          <Menu size={16} className="text-white/60" />
        </button>

        {/* Bottom Sheet — Apple Find My pattern */}
        <BottomSheet
          initial="peek"
          onStateChange={setMobileSheetState}
          peekContent={<MobilePeekContent />}
        >
          {/* Tab bar for switching panels */}
          <MobileTabBar
            tabs={visibleTabs}
            activeTab={effectiveTab}
            onTabChange={setActiveTab}
          />

          {/* Tab content */}
          <div className="mt-3 pb-20">
            <TabContent tab={effectiveTab} />
          </div>
        </BottomSheet>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT — Sidebar + Map + Right Panel
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full relative bg-[#0a0a0f]">
      {/* Map (fills remaining space) */}
      <div className="flex-1 h-full">
        <MapView />
      </div>

      {/* Right Panel Toggle */}
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

      {/* Desktop Right Panel */}
      <div
        className={`hidden md:flex bg-[#0a0a0f] border-l border-white/[0.06] flex-col shadow-2xl transition-all duration-300 ease-out ${
          rightPanelOpen ? 'w-80' : 'w-0'
        }`}
      >
        {rightPanelOpen && (
          <>
            <Tabs tabs={visibleTabs} activeTab={effectiveTab} onTabChange={setActiveTab} />
            <div className="flex-1 overflow-y-auto">
              <TabContent tab={effectiveTab} />
            </div>
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
    </div>
  );
}
