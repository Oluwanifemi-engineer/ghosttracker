'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/store/useStore';
import { CommunityHeatmap } from './CommunityHeatmap';
import { cn, openGoogleMapsDirections, formatDistance, formatDuration, isOnline, relativeTime, formatTimestamp, locationTimestamp } from '@/lib/utils';
import { getOSRMRoute, snapToRoad, NavigationRoute } from '@/services/navigation';
import type { Location } from '@/types';

// ─── Reverse Geocoding ─────────────────────────────────────────────────────
// Converts lat/lng to a human-readable street address using Nominatim
// (OpenStreetMap's free geocoder). Caches results to avoid hammering the
// free API. This is what makes the map "real-world navigatable" — the
// operator sees "14 Broad St, Lagos" not just "6.5244, 3.3792".
const geocodeCache = new Map<string, string>();
const GEOCODE_CACHE_MAX = 50;

// ─── Road snapping (display-only, G1-17) ───────────────────────────────────
// Coarse fixes (>= SNAP_MIN_ACCURACY_M) get their MARKER snapped to the
// nearest road via OSRM /nearest so the pin reads as street truth; the
// accuracy circle, trail, replay and ALL server data stay RAW. Sub-threshold
// fixes are never snapped (they're already on the road). The cache keys on
// rounded coords so the per-3s poll doesn't hammer the public OSRM server.
const snapCache = new Map<string, [number, number]>();
const SNAP_CACHE_MAX = 100;
const SNAP_MIN_ACCURACY_M = 30; // below this the fix is already street-level

function snapCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!resp.ok) throw new Error(`Geocoder ${resp.status}`);
    const data = await resp.json();
    const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    // Shorten: take the first two comma-separated parts (street + city)
    const parts = addr.split(',').map((s: string) => s.trim());
    const short = parts.slice(0, Math.min(3, parts.length)).join(', ');
    // Evict oldest entry when cache is full
    if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
      const firstKey = geocodeCache.keys().next().value;
      if (firstKey) geocodeCache.delete(firstKey);
    }
    geocodeCache.set(key, short);
    return short;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ─── Map tiles ──────────────────────────────────────────────────────────────
// MapTiler gives noticeably better Africa/Nigeria coverage than pure OSM
// (Carto's dark_all tiles — Nigerian building polygons show as black blocks).
// Falls back to Carto Dark Matter when no key is configured so the map never
// breaks. Set NEXT_PUBLIC_MAPTILER_KEY (or a full NEXT_PUBLIC_MAP_TILE_URL)
// in the dashboard build env to enable.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || '';
const MAP_TILE_URL_RESOLVED =
  MAP_TILE_URL ||
  (MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dark-matter/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
const MAP_TILE_ATTRIBUTION = MAP_TILE_URL
  ? ''
  : MAPTILER_KEY
    ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Satellite view tiles — Esri World Imagery (free, no key needed)
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION = '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics';

// ─── Operator position policy ────────────────────────────────────────────────
// The DEVICE marker comes from the tracked phone's GPS (server data). The
// operator's own "YOU" position comes from navigator.geolocation, which varies
// wildly by browser: mobile browsers use GPS (3-15m), desktop browsers fall
// back to WiFi (~20-100m) or IP geolocation (1-100+ km) and ignore
// enableHighAccuracy (no GPS hardware). In the REAL theft scenario the phone
// with GPS is the one that was stolen — telling the operator to "open the
// dashboard on your phone" is impossible — so the honest answer is a MANUAL
// PIN: the operator taps the map to say "I am here". The pinned position
// always beats the browser fix for distance and routing.
//   1. draws the browser-reported accuracy circle around the YOU marker
//   2. distance shows from the effective position (pin > browser), annotated
//      with fix quality when coarse
//   3. OSRM routing is allowed from a pin, or from a browser fix whose
//      reported accuracy is street-level
//   4. flags IP-derived fixes and offers the pin instead of "use your phone"
const USER_ACCURACY_DISTANCE_MAX = 1000; // metres — beyond this, annotate distance with fix quality
const USER_ACCURACY_NAVIGATION_MAX = 300; // metres — OSRM route from browser fix only when this good
const USER_ACCURACY_IP_FALLBACK = 5000; // metres — >= this is an IP-derived (desktop) fix
const PINNED_STORAGE_KEY = 'mt_pinned_position';

function loadPinnedPosition(): [number, number] | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PINNED_STORAGE_KEY) : null;
    if (!raw) return null;
    const [lat, lng] = JSON.parse(raw);
    if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng];
    return null;
  } catch {
    return null;
  }
}

function savePinnedPosition(pos: [number, number] | null) {
  try {
    if (pos) window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pos));
    else window.localStorage.removeItem(PINNED_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode) — the pin just won't survive reloads
  }
}

function formatAccuracyMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// Dynamic imports for SSR safety
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });

import { useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';

// ─── Professional SVG Map Icons ──────────────────────────────────────────────
// These use inline SVG for crisp rendering at any zoom level.
// The device marker is a premium pin with gradient and pulse animation.
// The user marker is a clean crosshair with a subtle glow.

let deviceIcon: any = null;
let userIcon: any = null;
let waypointIcon: any = null;
let trailDotIcon: any = null;

async function initIcons() {
  if (deviceIcon) return;
  const L = await import('leaflet');

  // ── Device marker: premium pin with gradient + pulse ring ──
  deviceIcon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:44px;height:52px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.35));">
        <!-- Pulse ring -->
        <div style="position:absolute;top:6px;left:6px;width:32px;height:32px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);animation:none;"></div>
        <!-- Pin body -->
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Shadow -->
          <ellipse cx="22" cy="49" rx="10" ry="3" fill="rgba(0,0,0,0.2)"/>
          <!-- Pin shape -->
          <path d="M22 2C12.06 2 4 10.06 4 20c0 12 18 28 18 28s18-16 18-28C40 10.06 31.94 2 22 2z" fill="url(#deviceGrad)"/>
          <!-- Inner circle -->
          <circle cx="22" cy="20" r="10" fill="white" fill-opacity="0.95"/>
          <!-- Pulse dot -->
          <circle cx="22" cy="20" r="4" fill="#10B981">
            <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite"/>
          </circle>
          <defs>
            <linearGradient id="deviceGrad" x1="4" y1="2" x2="40" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#111827"/>
              <stop offset="100%" stop-color="#374151"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 48],
  });

  // ── User/operator marker: clean crosshair with glow ──
  userIcon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px;filter:drop-shadow(0 2px 6px rgba(6,182,212,0.4));">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer ring -->
          <circle cx="14" cy="14" r="13" stroke="#06B6D4" stroke-width="2" fill="rgba(6,182,212,0.1)"/>
          <!-- Inner dot -->
          <circle cx="14" cy="14" r="5" fill="#06B6D4"/>
          <!-- Crosshairs -->
          <line x1="14" y1="0" x2="14" y2="6" stroke="#06B6D4" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="14" y1="22" x2="14" y2="28" stroke="#06B6D4" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="0" y1="14" x2="6" y2="14" stroke="#06B6D4" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="22" y1="14" x2="28" y2="14" stroke="#06B6D4" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // ── Waypoint flag: premium marker ──
  waypointIcon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:36px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="url(#waypointGrad)"/>
          <circle cx="14" cy="14" r="5" fill="white" fill-opacity="0.9"/>
          <defs>
            <linearGradient id="waypointGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#F59E0B"/>
              <stop offset="100%" stop-color="#D97706"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });

  // ── Trail dot: clean white dot with subtle border ──
  trailDotIcon = L.divIcon({
    className: '',
    html: `<div style="width:8px;height:8px;border-radius:50%;background:#FFFFFF;border:2px solid rgba(255,255,255,0.6);box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

// ─── Map Controller — smooth follow & recenter ────────────────────────────

function MapController({ pinning, onPin, replayActive }: {
  pinning: boolean;
  onPin: (pos: [number, number]) => void;
  // While the trail replay timeline is open the operator is scrubbing
  // history — the live follow re-centre must yield, or every poll tick
  // yanks the map away from the point being scrubbed.
  replayActive: boolean;
}) {
  const map = useMap();
  const { followDevice, latestLocation, selectedDeviceId } = useStore();
  const prevCenter = useRef<string>('');
  const prevDevice = useRef<string | null>(null);
  const userInteracted = useRef(false);
  const interactionTimer = useRef<NodeJS.Timeout | null>(null);

  // Pin mode: one map click places the operator's position.
  useEffect(() => {
    if (!pinning) return;
    const handler = (e: any) => { onPin([e.latlng.lat, e.latlng.lng]); };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, pinning, onPin]);

  useEffect(() => {
    const handler = () => {
      userInteracted.current = true;
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
      interactionTimer.current = setTimeout(() => { userInteracted.current = false; }, 5000);
    };
    map.on('dragstart', handler);
    map.on('zoomstart', handler);
    return () => {
      map.off('dragstart', handler);
      map.off('zoomstart', handler);
    };
  }, [map]);

  useEffect(() => {
    if (followDevice && latestLocation && !userInteracted.current && !replayActive) {
      const key = `${latestLocation.lat.toFixed(6)},${latestLocation.lng.toFixed(6)}`;
      if (key !== prevCenter.current) {
        map.setView([latestLocation.lat, latestLocation.lng], Math.max(map.getZoom(), 16), {
          animate: true,
          duration: 0.5,
        });
        prevCenter.current = key;
      }
    }
  }, [followDevice, latestLocation, map, replayActive]);

  // When the operator (re)selects a device, jump to street level (z17) so the
  // exact building is visible — the persisted mapZoom is 6 (whole country) and
  // follow only pans at the current zoom, so a fresh selection used to land
  // nowhere near the device.
  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== prevDevice.current && latestLocation) {
      prevDevice.current = selectedDeviceId;
      map.setView([latestLocation.lat, latestLocation.lng], 17, { animate: true, duration: 0.6 });
    }
  }, [selectedDeviceId, latestLocation, map]);

  return null;
}

// ─── Distance Overlay Component ─────────────────────────────────────────────

function DistanceOverlay({ userPos, userAccuracy, userPinned, deviceLat, deviceLng, offline, lastSeen }: {
  userPos: [number, number] | null;
  userAccuracy: number | null;
  userPinned: boolean;
  deviceLat: number;
  deviceLng: number;
  offline: boolean;
  lastSeen: string | null;
}) {
  const [distance, setDistance] = useState<number | null>(null);
  const map = useMap();
  const { setFollowDevice } = useStore();

  // ── Interactive YOU / DEVICE navigation ──────────────────────────────
  // Clicking the chips flies the map to that position instead of waiting for
  // the next poll cycle. Flying to YOU turns follow OFF (so the per-second
  // device re-centre can't yank the map back); flying to DEVICE turns it ON.
  const flyToYou = useCallback(() => {
    if (!userPos) return;
    setFollowDevice(false);
    map.flyTo(userPos, Math.max(map.getZoom(), 16), { animate: true, duration: 0.8 });
  }, [userPos, map, setFollowDevice]);

  const flyToDevice = useCallback(() => {
    setFollowDevice(true);
    map.flyTo([deviceLat, deviceLng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.8 });
  }, [deviceLat, deviceLng, map, setFollowDevice]);

  useEffect(() => {
    // A distance is always useful from ANY position we have (pin or browser
    // fix); a coarse fix is annotated, not hidden. Only a missing position
    // (nothing pinned AND no browser fix) blocks the readout.
    if (!userPos || offline) {
      setDistance(null);
      return;
    }
    const R = 6371000;
    const dLat = (deviceLat - userPos[0]) * Math.PI / 180;
    const dLng = (deviceLng - userPos[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userPos[0] * Math.PI / 180) * Math.cos(deviceLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(R * c);
  }, [userPos, deviceLat, deviceLng, offline, userAccuracy]);

  // Offline device — show when it was last seen and WHERE (last-known
  // coordinates) instead of hiding the overlay entirely.
  if (offline) {
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-gray-900/90 border border-gray-700 px-4 py-2.5 flex items-center gap-2.5 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-amber-50 bg-amber-500 " />
          <span className="font-mono text-[10px] text-amber-600 font-bold uppercase tracking-wider">OFFLINE</span>
          <div className="h-4 w-px bg-gray-200" />
          <span className="font-mono text-[11px] text-gray-200 font-bold">
            Last seen {relativeTime(lastSeen)}
          </span>
          <span className="font-mono text-[10px] text-gray-200 font-bold hidden sm:inline">
            · {deviceLat.toFixed(5)}, {deviceLng.toFixed(5)}
          </span>
        </div>
      </div>
    );
  }

  // No usable operator position (nothing pinned AND the browser has no fix):
  // tell the operator HOW to set one — pinning is the honest fallback when
  // the only "phone" with GPS is the one that was stolen.
  if (!userPos) {
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-gray-900/90 border border-gray-700 px-4 py-2.5 flex items-center gap-2.5 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-amber-50 bg-amber-500 " />
          <span className="font-mono text-[10px] text-amber-600 font-bold uppercase tracking-wider">
            SET YOUR POSITION
          </span>
          <div className="h-4 w-px bg-gray-200" />
          <span className="font-mono text-[10px] text-gray-200 font-bold">
            tap PIN POSITION, then tap the map where you are
          </span>
        </div>
      </div>
    );
  }

  if (!distance) return null;

  // When the operator's position is IP-derived (desktop browser, no GPS),
  // the distance is meaningless — it's measuring from a random IP location,
  // not from where the operator actually is. Show a different overlay that
  // makes this clear and promotes PIN POSITION.
  if (!userPinned && userAccuracy != null && userAccuracy > USER_ACCURACY_IP_FALLBACK) {
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] max-w-lg">
        <div className="bg-gray-900/90 border border-gray-700 px-4 py-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-700 bg-white" />
            <span className="font-mono text-[10px] text-white font-bold uppercase tracking-wider">DEVICE TRACKED</span>
            <div className="h-3 w-px bg-gray-200" />
            <span className="font-mono text-[10px] text-white font-bold">{formatDistance(distance)} away (approx)</span>
          </div>
          <div className="flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div className="text-[10px] font-mono text-gray-200 leading-relaxed">
              <span className="text-amber-600 font-bold">Your browser position is IP-derived (±{formatAccuracyMeters(userAccuracy!)})</span>
              — desktop browsers have no GPS. The distance above is approximate.
              <span className="text-white font-bold"> Tap PIN POSITION below, then tap the map where you actually are</span>
              for an accurate distance and turn-by-turn route to your device.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
      <div className="bg-gray-900/90 border border-gray-700 px-4 py-2.5 flex items-center gap-4 animate-fade-in">
        <button
          onClick={flyToYou}
          disabled={!userPos}
          title={userPos ? 'Fly to your location (stops device follow)' : 'No position yet'}
          className="flex items-center gap-2 group/y disabled:opacity-50"
        >
          <div className="w-2 h-2 rounded-full bg-gray-700 bg-gray-900 group-hover/y:scale-125 transition-transform" />
          <span className="font-mono text-[11px] text-gray-200 font-bold group-hover/y:text-gray-200 group-hover/y:underline underline-offset-2 transition-colors">YOU</span>
        </button>
        <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-200">
          <path d="M1 8h14M8 1l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <button
          onClick={flyToDevice}
          title="Fly to the device (resumes follow)"
          className="flex items-center gap-2 group/d"
        >
          <div className="w-2 h-2 rounded-full bg-gray-700 bg-white group-hover/d:scale-125 transition-transform" />
          <span className="font-mono text-[11px] text-gray-200 font-bold group-hover/d:text-white group-hover/d:underline underline-offset-2 transition-colors">DEVICE</span>
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <span className="font-mono text-sm font-bold text-white tabular-nums">
          {formatDistance(distance)}
        </span>
        <span className="font-mono text-[10px] text-gray-200 font-bold">away</span>
        {!userPinned && userAccuracy != null && userAccuracy > USER_ACCURACY_DISTANCE_MAX && (
          <span className="font-mono text-[9px] text-amber-600 font-bold">
            ±{formatAccuracyMeters(userAccuracy)} IP fix — pin your spot
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Path Animation Tracker ────────────────────────────────────────────────

function PathAnimationTracker({ trailLocations, isPlaying, playbackSpeed, index, onIndexChange }: {
  // Pre-reversed (oldest → newest) trail from the parent — already memoized
  // upstream so the path-rebuild effect never re-fires on every render.
  trailLocations: Location[];
  isPlaying: boolean;
  playbackSpeed: number;
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const map = useMap();
  const [animatedPath, setAnimatedPath] = useState<[number, number][]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Playback ticker — advances the SHARED index (the parent owns the state so
  // the timeline slider and the animation stay in sync).
  useEffect(() => {
    if (!isPlaying || trailLocations.length < 2) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      onIndexChange(Math.min(index + 1, trailLocations.length - 1));
    }, 1000 / playbackSpeed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playbackSpeed, trailLocations.length, index, onIndexChange]);

  // Rebuild the drawn path whenever the index changes (playback OR scrubbing)
  // and keep the map panned onto the current point.
  useEffect(() => {
    setAnimatedPath(trailLocations.slice(0, index + 1).map((l) => [l.lat, l.lng] as [number, number]));
    const loc = trailLocations[index];
    if (loc) {
      map.panTo([loc.lat, loc.lng], { animate: true, duration: 0.25 });
    }
  }, [index, trailLocations, map]);

  // Reset when the device/selection changes
  useEffect(() => {
    onIndexChange(0);
    setAnimatedPath([]);
  }, [trailLocations, onIndexChange]);

  if (animatedPath.length < 2) return null;

  return (
    <>
      {/* Animated trail line */}
      <Polyline
        positions={animatedPath}
        pathOptions={{
          color: '#FFFFFF',
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Glow layer */}
      <Polyline
        positions={animatedPath}
        pathOptions={{
          color: '#FFFFFF',
          weight: 10,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Current position dot */}
      {animatedPath.length > 0 && trailDotIcon && (
        <Marker
          position={animatedPath[animatedPath.length - 1]}
          icon={trailDotIcon}
        />
      )}
    </>
  );
}

// ─── Main Map Component ──────────────────────────────────────────────────────

export function MapView() {
  const {
    locations, latestLocation, mapCenter, mapZoom,
    followDevice, setFollowDevice, showTrail, setShowTrail,
    devices, selectedDeviceId,
  } = useStore();

  // Leaflet map instance — lets marker clicks fly the map to their position
  // instantly instead of waiting for the next poll/follow cycle.
  const mapRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState<NavigationRoute | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [userGeoDenied, setUserGeoDenied] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [deviceAddress, setDeviceAddress] = useState<string | null>(null);
  // Pinned operator position — the operator taps the map to say "I am here".
  // This is the PRIMARY source for a theft trail run from a laptop (no GPS)
  // and always beats an IP-derived browser fix. Survives reloads.
  const [userPinned, setUserPinned] = useState<[number, number] | null>(loadPinnedPosition);
  const [pinning, setPinning] = useState(false);
  // G1-17: snapped device marker position (display-only) — the effective
  // marker sits on the nearest road when the fix is coarse; all data stays raw.
  const [snappedDevicePos, setSnappedDevicePos] = useState<[number, number] | null>(null);

  // Effective operator position: pin wins over the browser fix.
  const effectiveUserPos = userPinned ?? userPosition;
  // Effective DEVICE marker position: the road-snapped point when a coarse
  // fix was snapped (display-only), otherwise the raw server fix.
  const deviceMarkerPos: [number, number] | null = snappedDevicePos ?? (latestLocation ? [latestLocation.lat, latestLocation.lng] : null);
  const isDeviceSnapped = snappedDevicePos != null;
  // Routing is safe from a pinned position (the operator chose the exact
  // point), or from a browser fix whose reported accuracy is street-level.
  // Routing from an IP-derived fix would send the operator to the wrong city.
  const userNavigationUsable =
    !!userPinned || (!!userPosition && userAccuracy != null && userAccuracy <= USER_ACCURACY_NAVIGATION_MAX);
  const userFixIsIpDerived =
    !userPinned && !!userPosition && userAccuracy != null && userAccuracy >= USER_ACCURACY_IP_FALLBACK;

  // Path tracker state — the index is shared with the timeline slider so
  // scrubbing and playback stay in sync
  const [pathPlaying, setPathPlaying] = useState(false);
  const [pathSpeed, setPathSpeed] = useState(2);
  const [pathIndex, setPathIndex] = useState(0);
  const [showPathTracker, setShowPathTracker] = useState(false);
  // Remember whether follow was on before replay opened, so closing replay
  // restores it instead of leaving the map stranded or yanking it.
  const followBeforeReplay = useRef<boolean | null>(null);

  // Selected device + online state (drives the offline banner + zoom-on-select)
  const device = devices.find(d => d.id === selectedDeviceId);
  const deviceOnline = device ? isOnline(device.last_seen) : true;

  // Replay trail (oldest → newest) for the timeline scrubber — memoized so
  // the timeline and the animation tracker share one stable ordering.
  const trailLocations = useMemo(() => locations.slice().reverse(), [locations]);

  // Stop playback when the replay reaches the end of the trail
  useEffect(() => {
    if (pathPlaying && trailLocations.length > 0 && pathIndex >= trailLocations.length - 1) {
      setPathPlaying(false);
    }
  }, [pathPlaying, pathIndex, trailLocations.length]);

  // Get user position — captures coords.accuracy too, because the operator's
  // fix quality is browser-dependent (mobile GPS vs desktop WiFi/IP). Every
  // downstream feature (distance, routing) is gated on that accuracy; the
  // error handler flags permission denial so the UI can explain itself.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
        setUserAccuracy(pos.coords.accuracy);
      },
      (err) => {
        if (err && err.code === err.PERMISSION_DENIED) setUserGeoDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Reverse geocode device position when it changes — show a street address
  // instead of raw coordinates for real-world navigability.
  // Deps are the primitive coords on purpose: the location object identity
  // changes on EVERY ping (battery/timestamp/etc.) and re-geocoding then
  // would waste calls; re-run only when lat/lng actually move.
  useEffect(() => {
    if (!latestLocation) return;
    let cancelled = false;
    reverseGeocode(latestLocation.lat, latestLocation.lng).then((addr) => {
      if (!cancelled) setDeviceAddress(addr);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coord deps are deliberate: re-geocode only when lat/lng actually move (see comment above the hook)
  }, [latestLocation?.lat, latestLocation?.lng]);

  // G1-17: snap the device MARKER to the nearest road when the fix is coarse
  // (>= 30m) — a presentation transform only. The accuracy circle, trail,
  // replay and server data all keep the RAW fix; the popup annotates the
  // snap as estimated. Same primitive-deps pattern as the geocode hook so a
  // per-ping object identity change never triggers a re-snap.
  useEffect(() => {
    if (!latestLocation || latestLocation.accuracy == null || latestLocation.accuracy < SNAP_MIN_ACCURACY_M) {
      setSnappedDevicePos(null);
      return;
    }
    const { lat, lng } = latestLocation;
    const key = snapCacheKey(lat, lng);
    const cached = snapCache.get(key);
    if (cached) {
      setSnappedDevicePos(cached);
      return;
    }
    let cancelled = false;
    snapToRoad(lat, lng).then((pos) => {
      if (cancelled) return;
      if (pos) {
        if (snapCache.size >= SNAP_CACHE_MAX) {
          const firstKey = snapCache.keys().next().value;
          if (firstKey) snapCache.delete(firstKey);
        }
        snapCache.set(key, pos);
      }
      setSnappedDevicePos(pos);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitive coord deps are deliberate (same pattern as the geocode hook above)
  }, [latestLocation?.lat, latestLocation?.lng, latestLocation?.accuracy]);

  // Initialize Leaflet icons and map
  useEffect(() => {
    setMapReady(true);
    initIcons().then(() => setIconsReady(true));
  }, []);

  // After map mounts, invalidate its size to force tile loading.
  // Leaflet sometimes renders blank tiles when the container dimensions
  // aren't fully resolved at mount time (e.g. flex layout, animation).
  useEffect(() => {
    if (mapReady && mapRef.current) {
      // Small delay to let the flex layout settle
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapReady]);

  // Place the operator's pinned position (from pin mode) and persist it.
  const handlePin = useCallback((pos: [number, number]) => {
    setUserPinned(pos);
    savePinnedPosition(pos);
    setPinning(false);
  }, []);

  // Navigation handler
  const handleNavigate = useCallback(async () => {
    if (!latestLocation || !effectiveUserPos || !userNavigationUsable) return;
    setNavigating(true);
    try {
      const route = await getOSRMRoute(
        effectiveUserPos[0], effectiveUserPos[1],
        latestLocation.lat, latestLocation.lng
      );
      setNavigationRoute(route);
    } catch (e) {
      console.warn('Navigation failed:', e);
    } finally {
      setNavigating(false);
    }
  }, [latestLocation, effectiveUserPos, userNavigationUsable]);

  // Clear route when device moves
  useEffect(() => {
    if (navigationRoute && latestLocation) {
      const lastCoord = navigationRoute.geometry[navigationRoute.geometry.length - 1];
      if (lastCoord) {
        const dist = Math.abs(latestLocation.lat - lastCoord[0]) + Math.abs(latestLocation.lng - lastCoord[1]);
        if (dist > 0.001) setNavigationRoute(null);
      }
    }
  }, [latestLocation, navigationRoute]);

  // Trail points (oldest to newest)
  const trailPoints = useMemo(
    () => locations.slice().reverse().map((l) => [l.lat, l.lng] as [number, number]),
    [locations]
  );

  return (
    <div className="relative flex-1 h-full bg-gray-900">
      {/* Map */}
      {mapReady && (
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          className="w-full h-full"
          zoomControl={true}
          attributionControl={true}
          zoomSnap={0.5}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={60}
        >
          {/* Map tiles — dark (default) or satellite view */}
          {showSatellite ? (
            <>
              <TileLayer
                url={SATELLITE_TILE_URL}
                maxZoom={18}
                attribution={SATELLITE_ATTRIBUTION}
              />
              {/* Semi-transparent dark overlay for satellite so UI text is readable */}
              <TileLayer
                url={MAP_TILE_URL_RESOLVED}
                maxZoom={19}
                opacity={0.3}
              />
            </>
          ) : (
            <TileLayer
              url={MAP_TILE_URL_RESOLVED}
              maxZoom={19}
              attribution={MAP_TILE_ATTRIBUTION}
            />
          )}

          <MapController pinning={pinning} onPin={handlePin} replayActive={showPathTracker} />
          <CommunityHeatmap visible={showHeatmap} onToggle={() => setShowHeatmap(!showHeatmap)} />

          {/* Distance / offline overlay */}
          {latestLocation && (effectiveUserPos || !deviceOnline) && (
            <DistanceOverlay
              userPos={effectiveUserPos}
              userAccuracy={userAccuracy}
              userPinned={!!userPinned}
              deviceLat={latestLocation.lat}
              deviceLng={latestLocation.lng}
              offline={!deviceOnline}
              lastSeen={device?.last_seen ?? null}
            />
          )}

          {/* IP-derived warning is now shown in the DistanceOverlay component */}

          {/* Location permission denied — distance/routing can't work at all */}
          {userGeoDenied && (
            <div className="absolute top-3 right-3 z-[1000] max-w-xs">
              <div className="bg-gray-900/90 border border-gray-700 px-3 py-2 flex items-start gap-2 animate-fade-in">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 shrink-0 mt-0.5">
                  <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>
                  <path d="M2 12h20"/>
                </svg>
                <div className="text-[10px] font-mono text-gray-200 font-bold leading-tight">
                  <span className="text-amber-600">LOCATION PERMISSION DENIED</span>
                  <span className="block mt-0.5 text-gray-200">
                    Distance and routing need browser location. Allow it in your
                    browser settings.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Path Animation Tracker — receives the memoized trail (already
              oldest→newest) so it doesn't reverse the array a second time on
              every render. */}
          {showPathTracker && (
            <PathAnimationTracker
              trailLocations={trailLocations}
              isPlaying={pathPlaying}
              playbackSpeed={pathSpeed}
              index={pathIndex}
              onIndexChange={setPathIndex}
            />
          )}

          {/* OSRM Navigation Route */}
          {navigationRoute && navigationRoute.geometry.length > 1 && (
            <>
              <Polyline
                positions={navigationRoute.geometry}
                pathOptions={{
                  color: '#06B6D4',
                  weight: 5,
                  opacity: 0.85,
                }}
              />
              <Polyline
                positions={navigationRoute.geometry}
                pathOptions={{
                  color: '#0891B2',
                  weight: 3,
                  opacity: 0.5,
                  dashArray: '1, 8',
                }}
              />
            </>
          )}

          {/* Trail */}
          {showTrail && trailPoints.length > 1 && !navigationRoute && !showPathTracker && (
            <Polyline
              positions={trailPoints}
              pathOptions={{
                color: '#FFFFFF',
                weight: 2.5,
                opacity: 0.4,
                dashArray: '8, 10',
              }}
            />
          )}

          {/* Prediction Line */}
          {latestLocation && latestLocation.speed && latestLocation.speed > 0.5 && (() => {
            const distM = latestLocation.speed * 60;
            const bearingRad = ((latestLocation.bearing || 0) * Math.PI) / 180;
            const R = 6371000;
            const dLat = distM * Math.cos(bearingRad) / R;
            const dLng = distM * Math.sin(bearingRad) / (R * Math.cos((latestLocation.lat * Math.PI) / 180));
            const predLat = latestLocation.lat + (dLat * 180) / Math.PI;
            const predLng = latestLocation.lng + (dLng * 180) / Math.PI;
            return (
              <Polyline
                positions={[[latestLocation.lat, latestLocation.lng], [predLat, predLng]]}
                pathOptions={{
                  color: '#F59E0B',
                  weight: 2,
                  opacity: 0.5,
                  dashArray: '6, 8',
                }}
              />
            );
          })()}

          {/* Accuracy Circle */}
          {latestLocation && latestLocation.accuracy && (
            <Circle
              center={[latestLocation.lat, latestLocation.lng]}
              radius={latestLocation.accuracy}
              pathOptions={{
                color: '#FFFFFF',
                fillColor: '#FFFFFF',
                fillOpacity: 0.06,
                weight: 1,
                opacity: 0.25,
              }}
            />
          )}

          {/* Device Marker — click flies to it (street level) and resumes
              follow, so the operator never fights the per-second re-centre.
              Position is the road-snapped point for coarse fixes (G1-17); the
              popup still shows the RAW server coords + accuracy so the snap is
              never mistaken for truth. */}
          {latestLocation && deviceMarkerPos && iconsReady && deviceIcon && (
            <Marker
              position={deviceMarkerPos}
              icon={deviceIcon}
              eventHandlers={{
                click: () => {
                  if (!mapRef.current) return;
                  setFollowDevice(true);
                  mapRef.current.flyTo(
                    deviceMarkerPos,
                    Math.max(mapRef.current.getZoom(), 16),
                    { animate: true, duration: 0.8 }
                  );
                },
              }}
            >
              <Popup>
                <div className="font-sans text-sm min-w-[220px]">
                  <div className="font-bold text-white mb-2 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/><path d="M2 12h20"/></svg>
                    DEVICE LOCATION
                  </div>
                  {deviceAddress && (
                    <div className="text-white text-xs font-bold mb-2 leading-tight">
                      📍 {deviceAddress}
                    </div>
                  )}
                  {isDeviceSnapped && (
                    <div className="text-[10px] font-mono text-amber-600 font-bold mb-2 leading-tight">
                      ⚠ Marker snapped to nearest road — fix accuracy ±{latestLocation.accuracy?.toFixed(0) || '?'}m. The circle shows the true uncertainty.
                    </div>
                  )}
                  <div className="space-y-1 text-gray-200">
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] font-bold">Latitude</span>
                      <span className="font-mono text-[11px] text-white font-bold">{latestLocation.lat.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] font-bold">Longitude</span>
                      <span className="font-mono text-[11px] text-white font-bold">{latestLocation.lng.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] font-bold">Accuracy</span>
                      <span className="font-mono text-[11px] text-white font-bold">±{latestLocation.accuracy?.toFixed(1) || '?'}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[11px] font-bold">Provider</span>
                      <span className="font-mono text-[11px] text-white font-bold">{latestLocation.provider}</span>
                    </div>
                    {latestLocation.speed != null && (
                      <div className="flex justify-between">
                        <span className="font-mono text-[11px] font-bold">Speed</span>
                        <span className="font-mono text-[11px] text-white font-bold">{(latestLocation.speed * 3.6).toFixed(1)} km/h</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-600/50 text-gray-200 font-mono text-[10px] font-bold">
                    {formatTimestamp(locationTimestamp(latestLocation))}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* User accuracy circle — honest visualization of the browser's own
              reported fix quality (tiny on mobile GPS, huge on desktop IP). */}
          {!userPinned && userPosition && userAccuracy != null && (
            <Circle
              center={userPosition}
              radius={userAccuracy}
              pathOptions={{
                color: '#06B6D4',
                fillColor: '#06B6D4',
                fillOpacity: 0.05,
                weight: 1,
                opacity: 0.25,
              }}
            />
          )}

          {/* Operator marker — click flies to YOU and pauses device follow */}
          {effectiveUserPos && iconsReady && userIcon && (
            <Marker
              position={effectiveUserPos}
              icon={userIcon}
              eventHandlers={{
                click: () => {
                  if (!mapRef.current) return;
                  setFollowDevice(false);
                  mapRef.current.flyTo(
                    effectiveUserPos,
                    Math.max(mapRef.current.getZoom(), 16),
                    { animate: true, duration: 0.8 }
                  );
                },
              }}
            >
              <Popup>
                <div className="font-sans text-sm">
                  <div className="font-bold text-white mb-1">YOUR POSITION</div>
                  <div className="text-white text-xs">
                    {effectiveUserPos[0].toFixed(5)}, {effectiveUserPos[1].toFixed(5)}
                    {userPinned && <span className="text-emerald-400 ml-1">(pinned)</span>}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

        </MapContainer>
      )}

      {/* Map controls — bottom left (mobile: raised above bottom nav) */}
      <div className="absolute bottom-4 left-3 z-[1000] flex flex-col gap-2 md:bottom-4 bottom-20">
        {/* PIN POSITION */}
        <button
          onClick={() => setPinning(!pinning)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
            pinning
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
          }`}
          title="Pin your position on the map"
        >
          <MapPin size={12} />
          {pinning ? 'Tap the map...' : 'Pin Position'}
        </button>

        {/* FOLLOW TOGGLE */}
        <button
          onClick={() => setFollowDevice(!followDevice)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
            followDevice
              ? 'bg-white text-gray-700 border border-gray-200 shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
          }`}
          title={followDevice ? 'Stop following device' : 'Follow device'}
        >
          {followDevice ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="1"/>
            </svg>
          )}
          {followDevice ? 'Following' : 'Follow'}
        </button>

        {/* TRAIL TOGGLE */}
        <button
          onClick={() => setShowTrail(!showTrail)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
            showTrail
              ? 'bg-white text-gray-700 border border-gray-200 shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
          }`}
          title={showTrail ? 'Hide trail' : 'Show trail'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 17l4-4 4 4 4-4 4 4"/>
          </svg>
          Trail
        </button>

        {/* SATELLITE / MAP */}
        <button
          onClick={() => setShowSatellite(!showSatellite)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50"
          title={showSatellite ? 'Switch to map view' : 'Switch to satellite view'}
        >
          {showSatellite ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>
            </svg>
          )}
          {showSatellite ? 'Map' : 'Sat'}
        </button>
      </div>

      {/* Map controls — bottom right (mobile: raised above bottom nav) */}
      <div className="absolute bottom-4 right-3 z-[1000] flex flex-col gap-2 md:bottom-4 bottom-20">
        {/* HEATMAP TOGGLE */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
            showHeatmap
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
              : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
          }`}
          title={showHeatmap ? 'Hide theft heatmap' : 'Show theft heatmap'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C8 6 4 10 4 14a8 8 0 0 0 16 0c0-4-4-8-8-12z"/>
          </svg>
          Heatmap
        </button>

        {/* Navigate button */}
        {effectiveUserPos && latestLocation && userNavigationUsable && (
          <button
            onClick={handleNavigate}
            disabled={navigating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            title="Get navigation route to device"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 11l19-9-9 19-2-8-8-2z"/>
            </svg>
            {navigating ? 'Loading...' : 'Navigate'}
          </button>
        )}

        {/* Replay Trail */}
        {locations.length > 2 && (
          <button
            onClick={() => {
              if (showPathTracker) {
                setShowPathTracker(false);
                setPathPlaying(false);
                // Restore follow if it was on before
                if (followBeforeReplay.current !== null) {
                  setFollowDevice(followBeforeReplay.current);
                  followBeforeReplay.current = null;
                }
              } else {
                followBeforeReplay.current = followDevice;
                setFollowDevice(false);
                setShowPathTracker(true);
                setPathIndex(0);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
              showPathTracker
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50'
            }`}
            title={showPathTracker ? 'Close replay' : 'Replay location trail'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {showPathTracker ? 'Close' : 'Replay'}
          </button>
        )}
      </div>

      {/* Path replay timeline — bottom center */}
      {showPathTracker && trailLocations.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] md:bottom-4 bottom-28">
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setPathPlaying(!pathPlaying)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              {pathPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            <input
              type="range"
              min={0}
              max={trailLocations.length - 1}
              value={pathIndex}
              onChange={(e) => {
                setPathIndex(Number(e.target.value));
                setPathPlaying(false);
              }}
              className="w-32 sm:w-48 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />

            <span className="font-mono text-[10px] text-gray-700 font-bold tabular-nums min-w-[40px]">
              {pathIndex + 1}/{trailLocations.length}
            </span>

            <select
              value={pathSpeed}
              onChange={(e) => setPathSpeed(Number(e.target.value))}
              className="font-mono text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200 rounded-md px-2 py-1"
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
              <option value={8}>8×</option>
            </select>

            {pathIndex > 0 && trailLocations[pathIndex] && (
              <span className="font-mono text-[10px] text-gray-500 font-bold hidden sm:inline">
                {formatTimestamp(locationTimestamp(trailLocations[pathIndex]))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
