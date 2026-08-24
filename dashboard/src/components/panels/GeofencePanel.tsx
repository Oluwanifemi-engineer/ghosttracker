'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { cn, formatCoordinate } from '@/lib/utils';
import { Fence, MapPin, Plus, Trash2, ShieldAlert, Camera, Volume2, Loader, Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { Geofence, GeofenceAutoAction } from '@/types';

const POLICY_OPTIONS: { value: GeofenceAutoAction; label: string; hint: string }[] = [
  { value: null, label: 'Alert only', hint: 'Send the geofence-exit alert, no on-device reaction' },
  { value: 'capture', label: 'Capture', hint: 'Front-camera photo + audio capture' },
  { value: 'siren', label: 'Siren', hint: 'Max-volume alarm + exit alert' },
];

function policyLabel(action: GeofenceAutoAction): string {
  if (action === 'capture') return 'CAPTURE';
  if (action === 'siren') return 'SIREN';
  return 'ALERT';
}

export function GeofencePanel() {
  const { selectedDeviceId, latestLocation, devices } = useStore();
  const { toast } = useToast();
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const accessRole: 'owner' | 'admin' | 'viewer' | 'device_only' = selectedDevice?.access_role ?? 'owner';
  const canManage = accessRole === 'owner' || accessRole === 'admin';

  const [zones, setZones] = useState<Geofence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('200');
  const [isSafeZone, setIsSafeZone] = useState(true);
  const [autoAction, setAutoAction] = useState<GeofenceAutoAction>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchZones = useCallback(async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    try {
      const res = await getAPI().getGeofences(selectedDeviceId);
      setZones(res.geofences ?? []);
    } catch (e) {
      console.error('Failed to fetch geofences:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const deviceKey = selectedDeviceId;
  const [lastDeviceKey, setLastDeviceKey] = useState<string | null>(null);
  if (deviceKey && deviceKey !== lastDeviceKey) {
    setLastDeviceKey(deviceKey);
    if (latestLocation && latestLocation.lat != null && latestLocation.lng != null) {
      setLat(String(latestLocation.lat));
      setLng(String(latestLocation.lng));
    }
    setFormOpen(false);
    setError('');
  }

  const createZone = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || creating) return;
    const centerLat = Number(lat);
    const centerLng = Number(lng);
    const radiusMeters = Number(radius);
    if (!Number.isFinite(centerLat) || centerLat < -90 || centerLat > 90) {
      setError('Enter a valid latitude (-90 to 90).');
      return;
    }
    if (!Number.isFinite(centerLng) || centerLng < -180 || centerLng > 180) {
      setError('Enter a valid longitude (-180 to 180).');
      return;
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
      setError('Enter a radius between 1 and 50,000 meters.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await getAPI().createGeofence({
        device_id: selectedDeviceId,
        name: name.trim() || undefined,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_meters: radiusMeters,
        is_safe_zone: isSafeZone,
        auto_action: autoAction,
      });
      toast('Geofence zone created', 'success');
      setName('');
      setFormOpen(false);
      await fetchZones();
    } catch (err: any) {
      setError(err?.message || 'Failed to create geofence');
    } finally {
      setCreating(false);
    }
  };

  const deleteZone = async (zone: Geofence) => {
    if (deletingId !== null) return;
    setDeletingId(zone.id);
    try {
      await getAPI().deleteGeofence(zone.id);
      toast('Zone deleted', 'success');
      await fetchZones();
    } catch (err: any) {
      toast(err?.message || 'Failed to delete zone', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const armDelete = (zone: Geofence) => {
    if (confirmDeleteId === zone.id) {
      setConfirmDeleteId(null);
      deleteZone(zone);
    } else {
      setConfirmDeleteId(zone.id);
      setTimeout(() => {
        setConfirmDeleteId(cur => (cur === zone.id ? null : cur));
      }, 2500);
    }
  };

  if (!selectedDeviceId) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/30 uppercase tracking-wider font-bold mb-3 px-1">
          <Fence size={12} className="text-white/20" />
          Geofence Zones
        </div>
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2">
            <MapPin size={16} className="text-white/15" />
          </div>
          <div className="text-white/40 text-[11px] font-bold">No device selected</div>
          <div className="text-white/20 text-[10px] font-mono mt-1 max-w-[220px] mx-auto leading-relaxed">
            Select a device from the sidebar to manage its geofence zones.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/30 uppercase tracking-wider font-bold mb-3 px-1">
        <Fence size={12} className="text-white/20" />
        Geofence Zones
      </div>

      <div className="space-y-2">
        {loading && !zones ? (
          <div className="text-center py-8">
            <Loader size={18} className="animate-spin mx-auto text-emerald-500/40" />
            <div className="text-white/20 text-[10px] font-mono mt-2">Loading zones...</div>
          </div>
        ) : !zones || zones.length === 0 ? (
          <div className="text-center py-8 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2">
              <MapPin size={16} className="text-white/15" />
            </div>
            <div className="text-white/50 text-[11px] font-bold mb-1">No zones yet</div>
            <div className="text-white/20 text-[10px] font-mono leading-relaxed max-w-[220px] mx-auto">
              Create a safe zone to get an alert the moment the device leaves it.
            </div>
          </div>
        ) : (
          zones.map(zone => (
            <div
              key={zone.id}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  zone.is_safe_zone ? 'bg-emerald-500' : 'bg-amber-500'
                )} />
                <div className="text-[11px] font-bold text-white/80 truncate flex-1 min-w-0">
                  {zone.name || `Zone #${zone.id}`}
                </div>
                <span
                  className={cn(
                    'text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                    zone.is_safe_zone
                      ? 'border-emerald-500/25 text-emerald-400/80 bg-emerald-500/[0.08]'
                      : 'border-amber-500/25 text-amber-400/80 bg-amber-500/[0.08]'
                  )}
                >
                  {zone.is_safe_zone ? 'Safe' : 'Restricted'}
                </span>
              </div>

              <div className="text-[9px] font-mono text-white/25 leading-relaxed">
                {formatCoordinate(zone.center_lat, 'lat')}, {formatCoordinate(zone.center_lng, 'lng')}
                <span className="text-white/15"> · {Math.round(zone.radius_meters)}m</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span
                  title={
                    zone.auto_action === 'capture'
                      ? 'On exit: front-camera photo + audio capture'
                      : zone.auto_action === 'siren'
                        ? 'On exit: max-volume alarm'
                        : 'On exit: alert only'
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-white/[0.08] bg-white/[0.03] text-white/40 text-[8px] font-mono font-bold uppercase tracking-wider"
                >
                  {zone.auto_action === 'capture' ? (
                    <Camera size={8} />
                  ) : zone.auto_action === 'siren' ? (
                    <Volume2 size={8} />
                  ) : (
                    <ShieldAlert size={8} />
                  )}
                  {policyLabel(zone.auto_action)}
                </span>
                {canManage && (
                  <button
                    onClick={() => armDelete(zone)}
                    disabled={deletingId !== null}
                    aria-label={`Delete zone ${zone.name || zone.id}`}
                    title={confirmDeleteId === zone.id ? 'Click again to confirm' : 'Delete zone'}
                    className={cn(
                      'px-2 py-1 rounded-md border text-[8px] font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40 shrink-0',
                      confirmDeleteId === zone.id
                        ? 'border-red-500/30 bg-red-500/[0.08] text-red-400'
                        : 'border-white/[0.06] text-white/25 hover:text-red-400 hover:border-red-500/20'
                    )}
                  >
                    {deletingId === zone.id ? (
                      <Loader size={10} className="animate-spin" />
                    ) : confirmDeleteId === zone.id ? (
                      'Confirm?'
                    ) : (
                      <Trash2 size={10} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!canManage ? (
        <p className="text-center text-[9px] font-mono text-white/20 py-2">
          Read-only access — owner or admin can change zones.
        </p>
      ) : !formOpen ? (
        <button
          onClick={() => { setFormOpen(true); setError(''); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.1] text-white/40 hover:text-white/70 hover:border-white/[0.2] transition-all text-[11px] font-bold"
        >
          <Plus size={14} />
          Add Zone
        </button>
      ) : (
        <form onSubmit={createZone} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-bold">
            New Zone
          </div>

          <div>
            <label className="text-[9px] font-mono text-white/30 font-bold mb-1 block">Name (optional)</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Home, School, Office"
              aria-label="Zone name"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-mono text-white/30 font-bold mb-1 block">Latitude</label>
              <input
                value={lat}
                onChange={e => setLat(e.target.value)}
                inputMode="decimal"
                aria-label="Zone latitude"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] font-mono text-white/30 font-bold mb-1 block">Longitude</label>
              <input
                value={lng}
                onChange={e => setLng(e.target.value)}
                inputMode="decimal"
                aria-label="Zone longitude"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-mono text-white/30 font-bold mb-1 block">Radius (meters)</label>
            <input
              value={radius}
              onChange={e => setRadius(e.target.value)}
              inputMode="numeric"
              aria-label="Zone radius meters"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSafeZone}
              onChange={e => setIsSafeZone(e.target.checked)}
              aria-label="Safe zone"
              className="accent-emerald-500 w-4 h-4"
            />
            <span className="text-[9px] font-mono text-white/50 font-bold">
              Safe zone (alert when device LEAVES it)
            </span>
          </label>

          <div>
            <label className="text-[9px] font-mono text-white/30 font-bold mb-1 block">Auto-action on exit</label>
            <div className="space-y-1.5">
              {POLICY_OPTIONS.map(opt => (
                <label
                  key={opt.label}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none',
                    autoAction === opt.value
                      ? 'border-white/[0.15] bg-white/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
                  )}
                >
                  <input
                    type="radio"
                    name="auto-action"
                    checked={autoAction === opt.value}
                    onChange={() => setAutoAction(opt.value)}
                    aria-label={`Auto action ${opt.label}`}
                    className="accent-emerald-500 mt-0.5"
                  />
                  <span>
                    <span className="block text-[9px] font-mono font-bold text-white/60">{opt.label}</span>
                    <span className="block text-[8px] font-mono text-white/25 leading-relaxed">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="text-[10px] font-mono text-red-400">{error}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all"
            >
              {creating ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
              {creating ? 'Creating...' : 'Create Zone'}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setError(''); }}
              disabled={creating}
              className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 text-[11px] font-bold transition-all disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
