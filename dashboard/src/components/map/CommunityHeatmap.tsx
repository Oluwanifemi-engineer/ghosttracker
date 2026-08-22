'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { MapPin, AlertTriangle, TrendingUp, Filter } from 'lucide-react';

/**
 * CommunityHeatmap — overlay theft hotspot data on the map.
 * Shows colored circles based on risk level with hover details.
 */

interface Hotspot {
  lat: number;
  lng: number;
  intensity: number;
  count: number;
  methods: string[];
  risk_level: string;
}

interface CommunityHeatmapProps {
  visible: boolean;
  onToggle: () => void;
}

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7c3aed',
};

const RISK_RADII: Record<string, number> = {
  low: 100,
  medium: 150,
  high: 200,
  critical: 250,
};

export function CommunityHeatmap({ visible, onToggle }: CommunityHeatmapProps) {
  const { selectedDeviceId, devices } = useStore();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0 });

  const fetchHotspots = useCallback(async () => {
    if (!visible) return;
    try {
      const device = devices.find(d => d.id === selectedDeviceId);
      const lat = device?.lat || 6.5244;
      const lng = device?.lng || 3.3792;

      const api = getAPI();
      const data = await api.getHeatmap(lat, lng, 10);
      setHotspots(data.hotspots);

      const critical = data.hotspots.filter(h => h.risk_level === 'critical').length;
      const high = data.hotspots.filter(h => h.risk_level === 'high').length;
      setStats({ total: data.total_reports, critical, high });
    } catch (e) {
      console.log('Heatmap not available');
    }
  }, [visible, selectedDeviceId, devices]);

  useEffect(() => {
    fetchHotspots();
    if (visible) {
      const interval = setInterval(fetchHotspots, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [fetchHotspots, visible]);

  const filteredHotspots = filter === 'all'
    ? hotspots
    : hotspots.filter(h => h.risk_level === filter);

  // Dynamically import Leaflet components to avoid SSR issues
  const [MapComponents, setMapComponents] = useState<any>(null);

  useEffect(() => {
    if (visible && !MapComponents) {
      Promise.all([
        import('react-leaflet'),
        import('leaflet'),
      ]).then(([rl, L]) => {
        setMapComponents({ Circle: rl.Circle, Popup: rl.Popup, L });
      });
    }
  }, [visible, MapComponents]);

  if (!visible || !MapComponents) return null;

  const { Circle, Popup } = MapComponents;

  return (
    <>
      {/* Hotspot circles on map */}
      {filteredHotspots.map((hotspot, i) => (
        <Circle
          key={`hotspot-${i}`}
          center={[hotspot.lat, hotspot.lng]}
          radius={RISK_RADII[hotspot.risk_level] || 150}
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

      {/* Control panel (overlaid on map) */}
      <div className="absolute top-4 right-4 z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3 w-56">
          {/* Toggle */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-mono font-bold text-gray-900">COMMUNITY WATCH</span>
            </div>
            <button
              onClick={onToggle}
              className={`w-8 h-4 rounded-full transition-colors ${
                visible ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                visible ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Stats */}
          {visible && (
            <>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                  <div className="text-xs font-bold text-gray-900">{stats.total}</div>
                  <div className="text-[7px] font-mono text-gray-700">TOTAL</div>
                </div>
                <div className="text-center p-1.5 bg-red-50 rounded-lg">
                  <div className="text-xs font-bold text-red-600">{stats.critical}</div>
                  <div className="text-[7px] font-mono text-gray-700">CRITICAL</div>
                </div>
                <div className="text-center p-1.5 bg-amber-50 rounded-lg">
                  <div className="text-xs font-bold text-amber-600">{stats.high}</div>
                  <div className="text-[7px] font-mono text-gray-700">HIGH</div>
                </div>
              </div>

              {/* Filter */}
              <div className="flex gap-1">
                {['all', 'critical', 'high', 'medium'].map(level => (
                  <button
                    key={level}
                    onClick={() => setFilter(level)}
                    className={`flex-1 py-1 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                      filter === level
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-2 flex items-center gap-2">
                {Object.entries(RISK_COLORS).map(([level, color]) => (
                  <div key={level} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[7px] font-mono text-gray-700 capitalize">{level}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
