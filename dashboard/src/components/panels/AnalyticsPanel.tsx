'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { BarChart3, Activity, Cpu, Users, TrendingUp, Zap } from 'lucide-react';

interface AnalyticsData {
  active_devices_7d: Array<{ day: string; count: number }>;
  command_stats: Record<string, number>;
  total_devices: number;
  total_locations: number;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color?: 'emerald' | 'blue' | 'amber' | 'red';
}

function MetricCard({ label, value, subtext, icon, color = 'emerald' }: MetricCardProps) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', colorClasses[color])}>
          {icon}
        </div>
        <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[20px] font-bold text-white/85 tabular-nums">{value}</div>
      {subtext && (
        <div className="text-[9px] font-mono text-white/25 mt-0.5">{subtext}</div>
      )}
    </div>
  );
}

function MiniBarChart({ data, label }: { data: Array<{ day: string; count: number }>; label: string }) {
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-3">{label}</div>
      <div className="flex items-end gap-1 h-16">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-emerald-500/40 rounded-t-sm min-h-[2px]"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
            <span className="text-[7px] font-mono text-white/20">
              {new Date(d.day).toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] font-mono text-white/40">
        {data.reduce((sum, d) => sum + d.count, 0)} total active device-days
      </div>
    </div>
  );
}

function CommandStats({ stats }: { stats: Record<string, number> }) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);

  if (total === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-2">Command Stats</div>
        <div className="text-[11px] font-mono text-white/25">No commands issued yet</div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-2">Command Stats</div>
      <div className="space-y-1.5">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/40">{status}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    status === 'executed' ? 'bg-emerald-500/60' :
                    status === 'failed' ? 'bg-red-500/60' :
                    status === 'expired' ? 'bg-amber-500/60' :
                    'bg-white/20'
                  )}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-white/50 tabular-nums w-6 text-right">{count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { serverUrl } = useStore();

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const baseUrl = serverUrl || '';
        const res = await fetch(`${baseUrl}/api/dashboard/analytics`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [serverUrl]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Analytics</div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-2">Analytics</div>
        <div className="text-[11px] font-mono text-red-400/60">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const successRate = data.command_stats['executed'] || 0;
  const totalCommands = Object.values(data.command_stats).reduce((a, b) => a + b, 0);
  const successPercent = totalCommands > 0 ? Math.round((successRate / totalCommands) * 100) : 0;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={12} className="text-white/30" />
        <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Analytics</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Active Devices (7d)"
          value={data.active_devices_7d.reduce((sum, d) => sum + d.count, 0)}
          subtext="device-days"
          icon={<Users size={12} />}
          color="emerald"
        />
        <MetricCard
          label="Total Devices"
          value={data.total_devices}
          icon={<Cpu size={12} />}
          color="blue"
        />
        <MetricCard
          label="Command Success"
          value={`${successPercent}%`}
          subtext={`${successRate}/${totalCommands} commands`}
          icon={<Zap size={12} />}
          color={successPercent >= 90 ? 'emerald' : successPercent >= 70 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Location Pings"
          value={data.total_locations.toLocaleString()}
          subtext="total recorded"
          icon={<Activity size={12} />}
          color="blue"
        />
      </div>

      {data.active_devices_7d.length > 0 && (
        <MiniBarChart data={data.active_devices_7d} label="Daily Active Devices" />
      )}

      <CommandStats stats={data.command_stats} />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={12} className="text-white/30" />
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Quick Insights</span>
        </div>
        <div className="space-y-1.5">
          {data.active_devices_7d.length >= 2 && (
            <div className="text-[10px] font-mono text-white/40">
              {data.active_devices_7d[data.active_devices_7d.length - 1].count > data.active_devices_7d[0].count
                ? '📈 Active devices trending up'
                : data.active_devices_7d[data.active_devices_7d.length - 1].count < data.active_devices_7d[0].count
                ? '📉 Active devices trending down'
                : '➡️ Active devices stable'}
            </div>
          )}
          {data.total_devices > 0 && (
            <div className="text-[10px] font-mono text-white/40">
              {data.total_devices < 10
                ? '🎯 Goal: 10 devices — keep going!'
                : data.total_devices < 50
                ? '🚀 Great progress — 10+ devices!'
                : '🏆 Impressive scale — 50+ devices!'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
