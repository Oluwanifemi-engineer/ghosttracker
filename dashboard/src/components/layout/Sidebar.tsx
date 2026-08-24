'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { cn, relativeTime, isOnline, getSignalLevel, deviceDisplayName } from '@/lib/utils';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ClaimDeviceModal } from '@/components/devices/ClaimDeviceModal';
import { stepUpPasswordHint } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Smartphone, BarChart3,
  Link2, Trash2, X, AlertTriangle, Shield, ShieldCheck,
  ExternalLink, LogOut, Wifi, WifiOff
} from 'lucide-react';
import { SidebarSkeleton } from '@/components/ui/Skeleton';

function sentinelLevel(score: number): string {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'ELEVATED';
  return 'SAFE';
}

interface DashboardStats {
  total_devices: number;
  active_devices: number;
  stolen_devices: number;
  total_locations: number;
  total_media: number;
  alerts_today: number;
}

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

export function Sidebar() {
  const {
    devices, selectedDeviceId, selectDevice, sidebarOpen, setSidebarOpen,
    isConnected, setDevices, userProfile, setUserProfile, logout
  } = useStore();
  const isMobile = useIsMobile();
  const sidebarVisible = sidebarOpen;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purgePassword, setPurgePassword] = useState('');
  const [purgeError, setPurgeError] = useState('');
  const [purging, setPurging] = useState(false);

  const onlineCount = devices.filter(d => isOnline(d.last_seen)).length;
  const offlineCount = devices.filter(d => !isOnline(d.last_seen)).length;
  const archivedDevices = devices.filter(d => !!d.archived_at);
  const activeDevices = devices.filter(d => !d.archived_at);
  const isAdmin = userProfile?.tier === 'admin';

  const fetchUserProfile = useCallback(async () => {
    if (!isConnected || userProfile) return;
    try {
      const api = getAPI();
      const profile = await api.fetchMe();
      setUserProfile(profile);
    } catch (e) {
      // Profile may not exist
    }
  }, [isConnected, userProfile, setUserProfile]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const fetchStats = useCallback(async () => {
    if (!isConnected) return;
    try {
      const api = getAPI();
      const data = await api.getStats();
      setStats(data);
    } catch (e) {
      // Stats endpoint may not exist yet
    }
  }, [isConnected]);

  const confirmPurgeArchived = async () => {
    if (purging || archivedDevices.length === 0) return;
    if (!purgePassword.trim()) {
      setPurgeError('Enter your password to confirm.');
      return;
    }
    setPurging(true);
    setPurgeError('');
    try {
      const res = await getAPI().deleteArchivedDevices(purgePassword);
      const { devices: freshDevices } = await getAPI().getDevices();
      setDevices(freshDevices);
      if (res.count === 0) {
        setPurgeError('No archived devices remain to delete.');
      }
      setConfirmPurge(false);
      setPurgePassword('');
    } catch (e: any) {
      setPurgeError(e?.message || 'Failed to delete archived devices');
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <>
    {isMobile && sidebarVisible && (
      <div
        className="fixed inset-0 z-30 bg-black/70 backdrop-blur-md md:hidden"
        onClick={() => setSidebarOpen(false)}
      />
    )}
    <aside className={cn(
      'bg-[#0a0a0f] border-r border-white/[0.06] flex flex-col transition-all duration-300 ease-out relative overflow-hidden',
      isMobile
        ? cn('fixed top-0 left-0 bottom-0 z-40', sidebarVisible ? 'w-72 translate-x-0' : 'w-72 -translate-x-full')
        : cn(sidebarVisible ? 'w-64' : 'w-12')
    )}>
      {/* Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="h-10 flex items-center justify-center border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors group shrink-0"
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? (
          <ChevronLeft size={12} className="text-white/30 group-hover:text-white/70 transition-colors" />
        ) : (
          <ChevronRight size={12} className="text-white/30 group-hover:text-white/70 transition-colors" />
        )}
      </button>

      {sidebarOpen && (
        <>
          {/* Brand Bar with LIVE status + E2E trust + Admin badge */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 shrink-0">
            <img src="/magneetar-mhalf.svg" alt="Magneetar" className="w-7 h-7 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-bold tracking-[0.25em] text-white/90">MAGNEETAR</div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/[0.08] border border-emerald-500/15">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all duration-300',
                    isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-white/20'
                  )} />
                  <span className="text-[7px] font-mono text-emerald-400/70 tracking-wider font-bold uppercase">
                    {isConnected ? 'LIVE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[6px] font-mono text-white/30 tracking-wider font-bold uppercase">E2E</span>
                </div>
                {isAdmin && (
                  <div className="px-1.5 py-0.5 rounded bg-amber-500/[0.08] border border-amber-500/15">
                    <span className="text-[6px] font-mono text-amber-400/70 tracking-wider font-bold uppercase">ADMIN</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono font-bold text-white/25 hover:text-red-400 hover:bg-red-500/[0.06] transition-all active:scale-95 border border-transparent hover:border-red-500/15"
              title="Disconnect"
            >
              <LogOut size={10} />
              <span className="hidden lg:inline">EXIT</span>
            </button>
          </div>

          {/* Quick Nav Links */}
          <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
            <div className="flex gap-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-white/[0.06] text-white/40 hover:text-white/80"
                title="Command Center"
              >
                <Smartphone size={9} />
                <span>Dashboard</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-amber-500/10 text-amber-400/70 hover:text-amber-300 border border-amber-500/15 hover:border-amber-500/30"
                  title="Admin Panel"
                >
                  <Shield size={9} />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                href="/trust"
                target="_blank"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-300 border border-emerald-500/15 hover:border-emerald-500/30"
                title="Trust Score"
              >
                <ShieldCheck size={9} />
                <span>Trust</span>
                <ExternalLink size={6} className="opacity-40" />
              </Link>
            </div>
          </div>

          {/* Hero KPI Card */}
          {stats && (
            <div className="px-3 py-3 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-1.5 mb-3">
                <BarChart3 size={10} className="text-white/25" />
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-[0.15em] font-bold">Overview</span>
              </div>

              {/* Hero metric */}
              <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-3 mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums leading-none">{stats.total_devices}</div>
                    <div className="text-[8px] font-mono text-white/30 font-bold uppercase tracking-wider mt-1">Device{stats.total_devices !== 1 ? 's' : ''} Linked</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Wifi size={10} className="text-emerald-400/60" />
                      <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">{stats.active_devices}</span>
                    </div>
                    <div className="text-[7px] font-mono text-white/20 font-bold uppercase tracking-wider mt-0.5">Active</div>
                  </div>
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2 text-center">
                  <div className="font-mono text-sm font-bold text-white/90 tabular-nums">{stats.total_locations}</div>
                  <div className="text-[7px] font-mono text-white/25 font-bold uppercase tracking-wider">Locations</div>
                </div>
                <div className={cn(
                  'rounded-xl p-2 text-center border',
                  stats.stolen_devices > 0
                    ? 'bg-red-500/[0.06] border-red-500/15'
                    : 'bg-white/[0.03] border-white/[0.06]'
                )}>
                  <div className={cn(
                    'font-mono text-sm font-bold tabular-nums',
                    stats.stolen_devices > 0 ? 'text-red-400' : 'text-white/90'
                  )}>{stats.stolen_devices}</div>
                  <div className="text-[7px] font-mono text-white/25 font-bold uppercase tracking-wider">Stolen</div>
                </div>
              </div>
            </div>
          )}

          {/* Devices Section Header */}
          <div className="px-4 py-2.5 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <Smartphone size={11} className="text-white/30" />
              <span className="text-[9px] font-mono text-white/35 uppercase tracking-[0.2em] font-bold">Devices</span>
              <span className="ml-auto flex items-center gap-2 text-[9px] font-mono font-bold tabular-nums">
                {archivedDevices.length > 0 && (
                  <span className="text-amber-400/70">{archivedDevices.length} archived</span>
                )}
                <span className="text-white/40">{activeDevices.length}</span>
              </span>
              <button
                onClick={() => setShowClaimModal(true)}
                title="Link a device"
                aria-label="Link a device"
                className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/30 transition-all"
              >
                <Link2 size={9} />
                Link
              </button>
            </div>
          </div>

          {/* Device List */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {!isConnected ? (
              <SidebarSkeleton />
            ) : devices.length === 0 ? (
              <div className="p-6 text-center">
                <Smartphone size={20} className="mx-auto text-white/15 mb-3" />
                <div className="text-white/50 text-sm font-bold">No devices registered.</div>
                <div className="text-white/25 text-[10px] font-mono mt-1">Connect to server first.</div>
              </div>
            ) : (
              [...activeDevices, ...archivedDevices].map((device) => {
                const archived = !!device.archived_at;
                const online = isOnline(device.last_seen);
                const signal = getSignalLevel(device.last_seen);
                const scoreColor =
                  device.is_stolen || device.sentinel_score >= 70 ? 'bg-red-500' :
                  device.sentinel_score >= 40 ? 'bg-amber-500' :
                  'bg-emerald-500';
                const scoreText =
                  device.is_stolen ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
                  device.sentinel_score >= 70 ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
                  device.sentinel_score >= 40 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
                  'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';

                return (
                  <button
                    key={device.id}
                    onClick={() => selectDevice(device.id)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 border-b border-white/[0.04] transition-all duration-200',
                      'hover:bg-white/[0.04] group active:scale-[0.995]',
                      selectedDeviceId === device.id
                        ? 'bg-white/[0.06] border-l-2 border-l-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.04)]'
                        : 'border-l-2 border-l-transparent',
                      archived && 'opacity-45 hover:opacity-70'
                    )}
                  >
                    {/* Top row: Name + Status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-bold text-white/90 truncate group-hover:text-white transition-colors max-w-[65%]">
                        {deviceDisplayName(device)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {archived && (
                          <span className="text-[7px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/15 text-amber-400/70 bg-amber-500/[0.06] shrink-0">
                            Archived
                          </span>
                        )}
                        {!device.is_owner && device.access_role && (
                          <span
                            className={cn(
                              'text-[7px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                              device.access_role === 'admin'
                                ? 'border-emerald-500/25 text-emerald-400/70 bg-emerald-500/[0.08]'
                                : device.access_role === 'viewer'
                                  ? 'border-blue-500/25 text-blue-400/70 bg-blue-500/[0.08]'
                                  : 'border-white/[0.08] text-white/35 bg-white/[0.03]'
                            )}
                            title={`Shared access — ${device.access_role} role`}
                          >
                            {device.access_role === 'admin' ? 'ADMIN' : device.access_role === 'viewer' ? 'VIEW' : 'STATUS'}
                          </span>
                        )}
                        <StatusIndicator
                          isOnline={online}
                          signal={signal}
                          className="scale-[0.7] origin-right -mr-1"
                        />
                      </div>
                    </div>

                    {/* Middle row: Device ID + Online status */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[9px] text-white/25 truncate font-bold">{device.id}</span>
                      <span className="flex items-center gap-1">
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-white/20'
                        )} />
                        <span className="font-mono text-[8px] text-white/30 font-bold">
                          {relativeTime(device.last_seen)}
                        </span>
                      </span>
                    </div>

                    {/* Bottom row: Sentinel score + Progress bar */}
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-lg',
                        scoreText
                      )}>
                        {device.is_stolen ? 'STOLEN' : sentinelLevel(device.sentinel_score)}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-white/70 tabular-nums">
                        {device.sentinel_score}
                      </span>
                      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', scoreColor)}
                          style={{ width: `${Math.min(device.sentinel_score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {onlineCount} online
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-white/25">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                {offlineCount} offline
              </span>
            </div>
          </div>
        </>
      )}

      {/* Claim modal */}
      {showClaimModal && <ClaimDeviceModal onClose={() => setShowClaimModal(false)} />}

      {/* Purge confirm */}
      {confirmPurge && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl p-4 space-y-3 animate-fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  Delete {archivedDevices.length} archived device{archivedDevices.length !== 1 ? 's' : ''}
                </div>
                <div className="text-[10px] font-mono text-white/40 mt-1 leading-relaxed">
                  All their data is erased permanently. Cannot be undone.
                </div>
              </div>
            </div>
            <input
              type="password"
              value={purgePassword}
              onChange={e => setPurgePassword(e.target.value)}
              placeholder={stepUpPasswordHint()}
              autoFocus
              aria-label="Confirm deletion password"
              onKeyDown={e => {
                if (e.key === 'Enter' && !purging) {
                  e.preventDefault();
                  confirmPurgeArchived();
                }
              }}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
            />
            {purgeError && <div className="text-[10px] font-mono text-red-400">{purgeError}</div>}
            <div className="flex gap-2">
              <button
                onClick={confirmPurgeArchived}
                disabled={purging}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all"
              >
                <Trash2 size={12} />
                {purging ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => { setConfirmPurge(false); setPurgePassword(''); setPurgeError(''); }}
                disabled={purging}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/80 hover:bg-white/[0.06] text-[11px] font-bold transition-all"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
