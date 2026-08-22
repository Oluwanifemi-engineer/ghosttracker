'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin, AlertTriangle, Shield, TrendingUp, ChevronRight, ExternalLink } from 'lucide-react';

/**
 * Community Watch Map — standalone public page.
 * Shows theft hotspots, safe routes, and recent reports.
 * No authentication required for viewing.
 */

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7c3aed',
};

interface Hotspot {
  lat: number;
  lng: number;
  intensity: number;
  count: number;
  methods: string[];
  risk_level: string;
}

export default function CommunityPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0 });

  // Default to Lagos if no geolocation
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.5244, 3.3792]);

  useEffect(() => {
    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {} // Keep default
      );
    }
  }, []);

  const fetchHotspots = useCallback(async () => {
    try {
      const resp = await fetch(
        `/api/community/heatmap?lat=${mapCenter[0]}&lng=${mapCenter[1]}&radius_km=10`
      );
      if (resp.ok) {
        const data = await resp.json();
        setHotspots(data.hotspots);
        const critical = data.hotspots.filter((h: Hotspot) => h.risk_level === 'critical').length;
        const high = data.hotspots.filter((h: Hotspot) => h.risk_level === 'high').length;
        setStats({ total: data.total_reports, critical, high });
      }
    } catch {
      console.log('Heatmap data unavailable');
    } finally {
      setLoading(false);
    }
  }, [mapCenter]);

  useEffect(() => {
    fetchHotspots();
  }, [fetchHotspots]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/magneetar-mhalf.svg" alt="Magneetar" className="w-8 h-8 rounded-lg" />
              <span className="text-sm font-bold text-white tracking-[0.2em]">MAGNEETAR</span>
            </Link>
            <div className="w-px h-6 bg-gray-700" />
            <span className="text-[10px] font-mono text-gray-400 tracking-wider">COMMUNITY WATCH</span>
          </div>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
          >
            Join Magneetar
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Banner */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-display font-extrabold text-white">{stats.total}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">TOTAL REPORTS (30D)</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-display font-extrabold text-red-400">{stats.critical}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">CRITICAL AREAS</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-display font-extrabold text-amber-400">{stats.high}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">HIGH RISK AREAS</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="h-[500px]">
              <MapContainer
                center={mapCenter}
                zoom={12}
                className="w-full h-full"
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  maxZoom={19}
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                {hotspots.map((hotspot, i) => (
                  <Circle
                    key={i}
                    center={[hotspot.lat, hotspot.lng]}
                    radius={150}
                    pathOptions={{
                      color: RISK_COLORS[hotspot.risk_level],
                      fillColor: RISK_COLORS[hotspot.risk_level],
                      fillOpacity: 0.3,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-mono p-1">
                        <div className="font-bold text-gray-900 mb-1">
                          {hotspot.risk_level.toUpperCase()} RISK
                        </div>
                        <div className="text-gray-700">
                          {hotspot.count} incident{hotspot.count !== 1 ? 's' : ''}
                        </div>
                        <div className="text-gray-700">
                          Methods: {hotspot.methods.join(', ')}
                        </div>
                      </div>
                    </Popup>
                  </Circle>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Legend */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-3">RISK LEVELS</h3>
              <div className="space-y-2">
                {Object.entries(RISK_COLORS).map(([level, color]) => (
                  <div key={level} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-400 capitalize">{level}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-3">HOW IT WORKS</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-400">1</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Users report theft incidents in their area</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-400">2</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Hotspots appear on the map with risk levels</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-400">3</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Everyone avoids dangerous areas and stays safe</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl p-4">
              <Shield size={20} className="text-emerald-400 mb-2" />
              <h3 className="text-xs font-bold text-white mb-1">Protect Your Community</h3>
              <p className="text-[11px] text-gray-400 mb-3">
                Join Magneetar to report incidents, track your devices, and help others recover their phones.
              </p>
              <Link
                href="/signup"
                className="block w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold text-center transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
