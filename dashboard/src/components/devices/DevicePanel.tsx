'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useStore } from '@/store/useStore';
import { cn, relativeTime, formatCoordinate, deviceDisplayName, stepUpPasswordHint } from '@/lib/utils';
import { BellRing, MapPin, LocateFixed, Navigation, ExternalLink, Download, Save, Check, Trash2, X, Pencil, MessageSquareText, Users, UserPlus, UserMinus, ShieldCheck } from 'lucide-react';
import { CoordDisplay } from '@/components/ui/CoordDisplay';
import { getAPI } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { DeviceShare, ShareRole } from '@/types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  viewer: 'Viewer',
  device_only: 'Device-only',
};

const LOCATION_MODE_LABEL: Record<string, string> = {
  battery_saving: 'Battery-saving',
  gps_only: 'GPS only',
  off: 'Location off',
};
const LOCATION_MODE_HINT: Record<string, string> = {
  battery_saving: 'Battery-saving mode disables GPS — fixes are network-only (100-500m), even outdoors.',
  gps_only: 'GPS-only mode turns off Wi-Fi/cell scanning — the device cannot be located indoors.',
  off: 'Location services are OFF on the device — no fixes at all until re-enabled.',
};

const ALL_ALERT_TYPES = [
  'theft_detected', 'sim_changed', 'factory_reset', 'battery_low',
  'device_offline', 'device_recovered', 'geofence_exit',
];

const ALL_CHANNELS = ['email', 'whatsapp', 'sms', 'push'];

export function DevicePanel() {
  const { devices, selectedDeviceId, latestLocation, setDevices, selectDevice } = useStore();
  const { toast } = useToast();
  const device = devices.find(d => d.id === selectedDeviceId);

  const accessRole: 'owner' | 'admin' | 'viewer' | 'device_only' = device?.access_role ?? 'owner';
  const canManage = accessRole === 'owner' || accessRole === 'admin';
  const canReadLocation = canManage || accessRole === 'viewer';
  const isOwner = accessRole === 'owner';

  const [alertPhone, setAlertPhone] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertChannels, setAlertChannels] = useState<string[] | null>(null);
  const [enabledTypes, setEnabledTypes] = useState<string[] | null>(null);
  const [quietStart, setQuietStart] = useState<number | null>(null);
  const [quietEnd, setQuietEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsSaved, setSmsSaved] = useState(false);
  const [smsError, setSmsError] = useState('');
  const [showSmsSettings, setShowSmsSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [shares, setShares] = useState<DeviceShare[]>([]);
  const [showShares, setShowShares] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ShareRole>('viewer');
  const [shareSaving, setShareSaving] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  const fetchShares = useCallback(async (deviceId: string) => {
    try {
      const res = await getAPI().getShares(deviceId);
      setShares(res.shares ?? []);
    } catch { setShares([]); }
  }, []);

  const inviteShare = async (e: FormEvent) => {
    e.preventDefault();
    if (!device || shareSaving) return;
    const email = inviteEmail.trim();
    if (!email) { setShareError("Enter the recipient's email address."); return; }
    setShareSaving(true); setShareError(''); setShareMsg('');
    try {
      await getAPI().addShare(device.id, email, inviteRole);
      setInviteEmail('');
      setShareMsg(`Access granted (${inviteRole}) — they'll see this device when they sign in.`);
      await fetchShares(device.id);
    } catch (err: any) { setShareError(err?.message || 'Failed to share device'); }
    finally { setShareSaving(false); }
  };

  const revokeShare = async (shareId: string) => {
    if (!device) return;
    try { await getAPI().revokeShare(device.id, shareId); await fetchShares(device.id); toast('Access revoked', 'success'); }
    catch (err: any) { toast(err?.message || 'Failed to revoke access', 'error'); }
  };

  const exportCsv = async () => {
    if (!device || exporting) return;
    setExporting(true);
    try {
      const blob = await getAPI().exportLocationsCSV(device.id);
      if (blob.size === 0) toast('No location history to export yet', 'error');
      else toast('Location history exported', 'success');
    } catch (e: any) { toast(e?.message || 'Failed to export location history', 'error'); }
    finally { setExporting(false); }
  };

  const deviceKey = device?.id;
  const [lastDeviceKey, setLastDeviceKey] = useState<string | undefined>(undefined);
  if (deviceKey && deviceKey !== lastDeviceKey) {
    setLastDeviceKey(deviceKey);
    setAlertPhone(device?.alert_phone || '');
    setAlertEmail(device?.alert_email || '');
    setAlertChannels(device?.alert_channels ?? null);
    setEnabledTypes(device?.enabled_types ?? null);
    setQuietStart(device?.quiet_hours_start ?? null);
    setQuietEnd(device?.quiet_hours_end ?? null);
    setSmsPhone(device?.sms_phone || '');
    setSmsEnabled(device?.sms_commands_enabled ?? false);
    setError(''); setSaved(false); setSmsError(''); setSmsSaved(false);
    setEditingName(false); setNameError(''); setDeletePassword(''); setDeleteError('');
    setShares([]); setShowShares(false); setShareError(''); setShareMsg(''); setInviteEmail('');
  }

  useEffect(() => { if (deviceKey) fetchShares(deviceKey); }, [deviceKey, fetchShares]);

  const confirmDeleteDevice = async () => {
    if (!device || deleting) return;
    if (!deletePassword.trim()) { setDeleteError('Enter your password to confirm.'); return; }
    setDeleting(true); setDeleteError('');
    try {
      await getAPI().deleteDevice(device.id, deletePassword);
      const { devices: freshDevices } = await getAPI().getDevices();
      setDevices(freshDevices);
      if (selectedDeviceId === device.id) selectDevice(freshDevices[0]?.id ?? null);
      setConfirmDelete(false); setDeletePassword('');
    } catch (e: any) { setDeleteError(e.message || 'Failed to delete device'); }
    finally { setDeleting(false); }
  };

  const saveDeviceName = async (e: FormEvent) => {
    e.preventDefault();
    if (!device) return;
    const alias = nameDraft.trim();
    if (!alias) { setNameError('Name cannot be empty'); return; }
    setEditingName(false); setSaving(true); setNameError('');
    try {
      await getAPI().updateDeviceAlias(device.id, alias);
      toast('Device renamed', 'success');
      const { devices: freshDevices } = await getAPI().getDevices(); setDevices(freshDevices);
    } catch (err: any) { setNameError(err.message || 'Failed to rename device'); setEditingName(true); }
    finally { setSaving(false); }
  };

  const saveSmsSettings = async () => {
    if (!device || smsSaving) return;
    setSmsSaving(true); setSmsError(''); setSmsSaved(false);
    try {
      const res = await getAPI().updateSmsSettings(device.id, smsPhone.trim(), smsEnabled);
      setSmsPhone(res.sms_phone || ''); setSmsEnabled(res.sms_commands_enabled);
      setSmsSaved(true); toast('SMS relay settings saved', 'success');
      try { const { devices: freshDevices } = await getAPI().getDevices(); setDevices(freshDevices); } catch {}
      setTimeout(() => setSmsSaved(false), 2000);
    } catch (e: any) { setSmsError(e.message || 'Failed to save SMS settings'); }
    finally { setSmsSaving(false); }
  };

  const saveAlertSettings = async () => {
    if (!device) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await getAPI().updateDeviceAlertSettings(device.id, alertPhone.trim(), alertEmail.trim(), {
        alert_channels: alertChannels && alertChannels.length ? alertChannels : null,
        enabled_types: enabledTypes && enabledTypes.length ? enabledTypes : null,
        quiet_hours_start: quietStart, quiet_hours_end: quietEnd,
      });
      setSaved(true); toast('Alert settings saved', 'success');
      try { const { devices: freshDevices } = await getAPI().getDevices(); setDevices(freshDevices); } catch {}
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setError(e.message || 'Failed to save alert settings'); }
    finally { setSaving(false); }
  };

  const toggleChannel = (ch: string) => {
    setAlertChannels(prev => { const base = prev ?? ALL_CHANNELS; return base.includes(ch) ? base.filter(c => c !== ch) : [...base, ch]; });
  };
  const toggleType = (t: string) => {
    setEnabledTypes(prev => { const base = prev ?? ALL_ALERT_TYPES; return base.includes(t) ? base.filter(x => x !== t) : [...base, t]; });
  };

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <MapPin size={24} className="text-white/15" />
        </div>
        <div className="text-white/50 text-sm font-bold mb-1">No device selected</div>
        <div className="text-white/25 text-xs font-mono leading-relaxed max-w-[200px]">
          Select a device from the sidebar to view its details, location, alert settings, and capture status.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Device Header */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] shrink-0" />
          {device.archived_at && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
              Archived
            </span>
          )}
          {!isOwner && (
            <span className={cn(
              'text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
              accessRole === 'admin' ? 'border-emerald-500/25 text-emerald-400 bg-emerald-500/10' :
              accessRole === 'viewer' ? 'border-blue-500/25 text-blue-400 bg-blue-500/10' :
              'border-white/[0.08] text-white/40 bg-white/[0.03]'
            )}>
              {ROLE_LABEL[accessRole] ?? accessRole}
            </span>
          )}
          {device.location_mode && LOCATION_MODE_LABEL[device.location_mode] && (
            <span className={cn(
              'text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
              device.location_mode === 'off' ? 'border-red-500/40 text-red-400 bg-red-500/10' : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
            )}
              title={LOCATION_MODE_HINT[device.location_mode]}
            >
              {LOCATION_MODE_LABEL[device.location_mode]}
            </span>
          )}
          {editingName ? (
            <form onSubmit={saveDeviceName} className="flex items-center gap-1.5 flex-1 min-w-0">
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus maxLength={60}
                className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.12] rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
              <button type="submit" disabled={nameSaving} className="p-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-400 transition-colors">
                <Check size={13} />
              </button>
              <button type="button" onClick={() => setEditingName(false)} className="p-1.5 rounded-md border border-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                <X size={13} />
              </button>
            </form>
          ) : (
            <>
              <h3 className="text-base font-bold text-white/90 truncate flex-1 min-w-0">{deviceDisplayName(device)}</h3>
              {canManage && (
                <button onClick={() => { setNameDraft(deviceDisplayName(device)); setNameError(''); setEditingName(true); }}
                  className="p-1.5 rounded-md border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15] transition-colors">
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>
        {nameError && <div className="text-[10px] font-mono text-red-400 mb-2">{nameError}</div>}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-white/35 font-bold">Device ID</span>
            <span className="text-[11px] font-mono text-white/80 font-bold">{device.id}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-white/35 font-bold">Registered</span>
            <span className="text-[11px] font-mono text-white/50 font-bold">{relativeTime(device.registered)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-white/35 font-bold">Last Seen</span>
            <span className="text-[11px] font-mono text-white/50 font-bold">{relativeTime(device.last_seen)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-white/35 font-bold">Capture</span>
            {device.capture_armed == null ? (
              <span className="text-[11px] font-mono text-white/25 font-bold">Unknown</span>
            ) : device.capture_armed ? (
              <span className="text-[11px] font-mono text-emerald-400 font-bold">Armed</span>
            ) : (
              <span className="text-[11px] font-mono text-amber-400 font-bold">Unarmed</span>
            )}
          </div>
        </div>
      </div>

      {/* Coordinates */}
      {latestLocation && <CoordDisplay lat={latestLocation.lat} lng={latestLocation.lng} />}

      {/* Location Details */}
      {latestLocation && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/35 uppercase tracking-wider font-bold mb-2">
            <LocateFixed size={12} className="text-white/25" />
            Location Details
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-white/35 font-bold">Provider</span>
            <span className="text-[11px] font-mono text-white/80 font-bold">{latestLocation.provider}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-white/35 font-bold">Accuracy</span>
            <span className="text-[11px] font-mono text-white/80 font-bold">±{latestLocation.accuracy?.toFixed(1) || '?'}m</span>
          </div>
          {latestLocation.speed != null && (
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-white/35 font-bold">Speed</span>
              <span className="text-[11px] font-mono text-white/80 font-bold">{(latestLocation.speed * 3.6).toFixed(1)} km/h</span>
            </div>
          )}
          {latestLocation.altitude != null && (
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-white/35 font-bold">Altitude</span>
              <span className="text-[11px] font-mono text-white/80 font-bold">{latestLocation.altitude.toFixed(0)}m</span>
            </div>
          )}
          {latestLocation.bearing != null && (
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-white/35 font-bold">Bearing</span>
              <span className="text-[11px] font-mono text-white/80 font-bold">{latestLocation.bearing.toFixed(0)}°</span>
            </div>
          )}
        </div>
      )}

      {/* Open in Maps */}
      {latestLocation && (
        <a href={`https://www.google.com/maps?q=${latestLocation.lat},${latestLocation.lng}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/[0.15] hover:bg-white/[0.03] transition-all text-xs font-bold">
          <ExternalLink size={14} />
          Open in Google Maps
        </a>
      )}

      {/* Export CSV */}
      {canReadLocation && (
        <button onClick={exportCsv} disabled={exporting}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/[0.15] hover:bg-white/[0.03] transition-all text-xs font-bold disabled:opacity-50">
          <Download size={14} />
          {exporting ? 'Exporting…' : 'Export Location History (CSV)'}
        </button>
      )}

      {/* Sharing */}
      {canManage && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <button onClick={() => setShowShares(!showShares)}
            className="w-full flex items-center justify-between text-[11px] font-mono text-white/50 uppercase tracking-wider font-bold hover:text-white/70 transition-colors">
            <span className="flex items-center gap-1.5">
              <Users size={12} className="text-white/30" />
              Sharing
              {shares.length > 0 && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 border border-white/[0.08]">{shares.length}</span>
              )}
            </span>
            <span className="text-white/25">{showShares ? '−' : '+'}</span>
          </button>
          {showShares && (
            <div className="space-y-2.5 pt-1">
              {isOwner ? (
                <form onSubmit={inviteShare} className="space-y-2">
                  <div>
                    <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Share with (account email)</label>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="family@example.com" type="email"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Role</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value as ShareRole)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/50 transition-colors">
                      <option value="viewer">Viewer — read only</option>
                      <option value="admin">Admin — full control</option>
                      <option value="device_only">Device-only — status glance</option>
                    </select>
                  </div>
                  <button type="submit" disabled={shareSaving}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-400 text-xs font-bold transition-all">
                    <UserPlus size={13} />
                    {shareSaving ? 'Sharing...' : 'Share device'}
                  </button>
                  {shareError && <div className="text-[10px] font-mono text-red-400">{shareError}</div>}
                  {shareMsg && (
                    <div className="flex items-start gap-1.5 text-[10px] font-mono text-emerald-400/70 leading-relaxed">
                      <ShieldCheck size={11} className="shrink-0 mt-0.5" />
                      {shareMsg}
                    </div>
                  )}
                </form>
              ) : (
                <p className="text-[10px] font-mono text-white/30 leading-relaxed">
                  Only the device owner can manage sharing. You have{' '}
                  <span className="font-bold text-white/50">{ROLE_LABEL[accessRole] ?? accessRole}</span> access.
                </p>
              )}
              {shares.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {shares.map(s => (
                    <div key={s.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-white/70 font-bold truncate">{s.display_name || s.email}</div>
                        <div className="text-[9px] font-mono text-white/30 truncate">{s.email}</div>
                      </div>
                      <span className={cn(
                        'text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                        s.role === 'admin' ? 'border-emerald-500/25 text-emerald-400 bg-emerald-500/10' :
                        s.role === 'viewer' ? 'border-blue-500/25 text-blue-400 bg-blue-500/10' :
                        'border-white/[0.08] text-white/40 bg-white/[0.03]'
                      )}>{ROLE_LABEL[s.role] ?? s.role}</span>
                      {isOwner && (
                        <button onClick={() => revokeShare(s.id)} className="p-1 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <UserMinus size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alert Settings */}
      {canManage && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <button onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between text-[11px] font-mono text-white/50 uppercase tracking-wider font-bold hover:text-white/70 transition-colors">
            <span className="flex items-center gap-1.5">
              <BellRing size={12} className="text-white/30" />
              Alert Settings
            </span>
            <span className="text-white/25">{showSettings ? '−' : '+'}</span>
          </button>
          {showSettings && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Alert Phone (E.164)</label>
                <input value={alertPhone} onChange={e => setAlertPhone(e.target.value)} placeholder="Leave empty for global default"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Alert Email</label>
                <input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="Leave empty for global default"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Channels</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CHANNELS.map(ch => {
                    const active = (alertChannels ?? ALL_CHANNELS).includes(ch);
                    return (
                      <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                        aria-pressed={active}
                        aria-label={`Toggle ${ch} channel`}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide transition-all',
                          active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/40'
                        )}>{ch}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Alert types</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['theft_detected', 'Theft'], ['sim_changed', 'SIM change'], ['factory_reset', 'Factory reset'],
                    ['battery_low', 'Battery low'], ['device_offline', 'Offline'], ['device_recovered', 'Recovered'], ['geofence_exit', 'Geofence'],
                  ].map(([type, label]) => {
                    const base = enabledTypes ?? ALL_ALERT_TYPES;
                    const active = base.includes(type);
                    const locked = type === 'theft_detected' || type === 'sim_changed' || type === 'factory_reset';
                    return (
                      <button key={type} type="button" onClick={() => !locked && toggleType(type)} disabled={locked}
                        aria-pressed={active}
                        aria-label={`Toggle ${label} alert type`}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide transition-all',
                          active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/40',
                          locked && 'opacity-60 cursor-not-allowed'
                        )}>{label}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Quiet hours</label>
                <div className="flex items-center gap-2">
                  <select value={quietStart ?? ''} onChange={e => setQuietStart(e.target.value === '' ? null : Number(e.target.value))}
                    aria-label="Quiet hours start"
                    className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/50 transition-colors">
                    <option value="">Off</option>
                    {Array.from({ length: 24 }, (_, h) => (<option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>))}
                  </select>
                  <span className="text-white/25 text-[10px] font-mono">to</span>
                  <select value={quietEnd ?? ''} onChange={e => setQuietEnd(e.target.value === '' ? null : Number(e.target.value))}
                    aria-label="Quiet hours end"
                    className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/50 transition-colors">
                    <option value="">Off</option>
                    {Array.from({ length: 24 }, (_, h) => (<option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={saveAlertSettings} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-400 text-[10px] font-mono font-bold transition-all">
                  <Save size={11} />{saving ? 'SAVING...' : saved ? 'SAVED ✓' : 'Save Alert Settings'}
                </button>
                {error && <div className="text-[10px] font-mono text-red-400">{error}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offline SMS Commands */}
      {canManage && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <button onClick={() => setShowSmsSettings(!showSmsSettings)}
            className="w-full flex items-center justify-between text-[11px] font-mono text-white/50 uppercase tracking-wider font-bold hover:text-white/70 transition-colors">
            <span className="flex items-center gap-1.5">
              <MessageSquareText size={12} className="text-white/30" />
              Offline SMS Commands
            </span>
            <span className="flex items-center gap-2">
              {smsEnabled && <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">On</span>}
              <span className="text-white/25">{showSmsSettings ? '−' : '+'}</span>
            </span>
          </button>
          {showSmsSettings && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">SMS phone number</label>
                <input value={smsPhone} onChange={e => setSmsPhone(e.target.value)} placeholder="+234..."
                  aria-label="Offline SMS phone number"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={smsEnabled} onChange={e => setSmsEnabled(e.target.checked)}
                    aria-label="Enable offline SMS commands"
                    className="w-4 h-4 rounded border-white/[0.15] bg-white/[0.03] text-emerald-500 focus:ring-emerald-500/50" />
                  <span className="text-[10px] font-mono text-white/50 font-bold">Enable offline SMS relay</span>
                </label>
              </div>
              <button onClick={saveSmsSettings} disabled={smsSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-400 text-[10px] font-mono font-bold transition-all">
                <Save size={11} />{smsSaving ? 'SAVING...' : smsSaved ? 'SAVED ✓' : 'Save SMS Settings'}
              </button>
              {smsError && <div className="text-[10px] font-mono text-red-400">{smsError}</div>}
            </div>
          )}
        </div>
      )}

      {/* Delete Device */}
      {isOwner && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] transition-all text-xs font-bold">
              <Trash2 size={14} />
              Delete Device Permanently
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-red-400 font-bold">Confirm device deletion — this is irreversible.</div>
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                placeholder={stepUpPasswordHint()} autoFocus aria-label="Confirm deletion password"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 transition-colors" />
              {deleteError && <div className="text-[10px] font-mono text-red-400">{deleteError}</div>}
              <div className="flex gap-2">
                <button onClick={confirmDeleteDevice} disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 text-[11px] font-mono font-bold transition-all">
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteError(''); }}
                  className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white/60 text-[11px] font-mono font-bold transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
