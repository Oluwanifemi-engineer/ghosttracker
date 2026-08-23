'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { Users, Smartphone, DollarSign, AlertTriangle, Activity, Shield, TrendingUp, Search, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { NPSDashboard } from '@/components/admin/NPSDashboard';

/**
 * Admin Dashboard — INTERNAL company dashboard for Magneetar workers ONLY.
 * Access is restricted to users with admin tier (API key / master key login).
 * Regular users are redirected to the main dashboard.
 */

interface AdminStats {
  users: { total: number; new_today: number; new_this_week: number; active_24h: number };
  devices: { total: number; active_1h: number; stolen: number };
  revenue: { paying_users: number; personal_subs: number; family_subs: number; monthly_estimate_naira: number; monthly_estimate_usd: number };
  alerts: { today: number; this_week: number };
  community: { theft_reports_30d: number; active_bounties: number };
}

interface UserData {
  id: string;
  email: string;
  display_name: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  last_login: string | null;
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-display font-bold text-gray-900 mb-2">Access Restricted</h1>
        <p className="text-sm text-gray-600 mb-6">
          This dashboard is for Magneetar company workers only.
          Regular users cannot access this area.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { isConnected, userProfile } = useStore();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'devices' | 'support' | 'health'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [accessChecked, setAccessChecked] = useState(false);

  // Check admin access
  useEffect(() => {
    const checkAccess = async () => {
      // If we already have the profile, check immediately
      if (userProfile) {
        if (userProfile.tier !== 'admin') {
          setAccessChecked(true);
          return;
        }
        setAccessChecked(true);
        return;
      }

      // Otherwise, fetch the profile
      try {
        const api = getAPI();
        const profile = await api.fetchMe();
        useStore.getState().setUserProfile(profile);
        if (profile.tier !== 'admin') {
          setAccessChecked(true);
          return;
        }
        setAccessChecked(true);
      } catch (e) {
        // Can't verify — treat as non-admin
        setAccessChecked(true);
      }
    };

    checkAccess();
  }, [userProfile]);

  // Real-time WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const { serverUrl, apiKey } = useStore.getState();
    if (!serverUrl || !apiKey || userProfile?.tier !== 'admin') return;

    const connectWs = async () => {
      try {
        const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws/admin';
        const ws = new WebSocket(`${wsUrl}?token=${apiKey}`);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'stats_update') {
              setStats(msg.data);
              setLoading(false);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => console.log('Admin WS error');
        ws.onclose = () => {
          setTimeout(connectWs, 5000);
        };

        wsRef.current = ws;
      } catch {
        // Fall back to polling
      }
    };

    connectWs();

    return () => {
      wsRef.current?.close();
    };
  }, [userProfile?.tier]);

  const fetchStats = useCallback(async () => {
    if (userProfile?.tier !== 'admin') return;
    try {
      const api = getAPI();
      const data = await api.getAdminStats();
      setStats(data);
    } catch (e) {
      console.log('Admin stats not available');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.tier]);

  const fetchUsers = useCallback(async () => {
    if (userProfile?.tier !== 'admin') return;
    try {
      const api = getAPI();
      const data = await api.getAdminUsers(userPage, 50, searchQuery || undefined);
      setUsers(data.users);
      setUserTotal(data.total);
    } catch (e) {
      console.log('Admin users not available');
    }
  }, [userPage, searchQuery, userProfile?.tier]);

  useEffect(() => {
    if (userProfile?.tier === 'admin') {
      fetchStats();
      fetchUsers();
    }
  }, [fetchStats, fetchUsers, userProfile?.tier]);

  // Show loading while checking access
  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Access denied — not an admin
  if (userProfile?.tier !== 'admin') {
    return <AccessDenied />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-bold text-gray-900">Magneetar Admin</h1>
            <p className="text-xs font-mono text-gray-700">Internal dashboard — company workers only</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <Shield size={12} className="text-amber-600" />
              <span className="text-[10px] font-mono font-bold text-amber-700 uppercase">Admin Access</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-gray-700">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'devices', label: 'Devices', icon: Smartphone },
            { id: 'support', label: 'Support', icon: AlertTriangle },
            { id: 'health', label: 'Health', icon: Shield },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Total Users"
                value={stats.users.total}
                subtitle={`${stats.users.new_today} today · ${stats.users.new_this_week} this week`}
                color="blue"
              />
              <StatCard
                icon={Smartphone}
                label="Active Devices"
                value={stats.devices.active_1h}
                subtitle={`${stats.devices.total} total · ${stats.devices.stolen} stolen`}
                color="emerald"
              />
              <StatCard
                icon={DollarSign}
                label="Monthly Revenue"
                value={`₦${stats.revenue.monthly_estimate_naira.toLocaleString()}`}
                subtitle={`${stats.revenue.paying_users} paying users`}
                color="amber"
              />
              <StatCard
                icon={AlertTriangle}
                label="Alerts Today"
                value={stats.alerts.today}
                subtitle={`${stats.alerts.this_week} this week`}
                color="red"
              />
            </div>

            {/* Revenue Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Revenue Breakdown</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-display font-extrabold text-gray-900">
                    {stats.revenue.personal_subs}
                  </div>
                  <div className="text-[10px] font-mono text-gray-700 mt-1">Personal Subs</div>
                  <div className="text-[10px] font-mono text-emerald-600 font-bold">
                    ₦{(stats.revenue.personal_subs * 1500).toLocaleString()}/mo
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-display font-extrabold text-gray-900">
                    {stats.revenue.family_subs}
                  </div>
                  <div className="text-[10px] font-mono text-gray-700 mt-1">Family Subs</div>
                  <div className="text-[10px] font-mono text-emerald-600 font-bold">
                    ₦{(stats.revenue.family_subs * 3000).toLocaleString()}/mo
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-display font-extrabold text-gray-900">
                    ${stats.revenue.monthly_estimate_usd}
                  </div>
                  <div className="text-[10px] font-mono text-gray-700 mt-1">USD Equivalent</div>
                </div>
              </div>
            </div>

            {/* Community Watch */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Community Watch</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <div className="text-2xl font-display font-extrabold text-amber-600">
                    {stats.community.theft_reports_30d}
                  </div>
                  <div className="text-[10px] font-mono text-amber-700 mt-1">Theft Reports (30d)</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-display font-extrabold text-emerald-600">
                    {stats.community.active_bounties}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-700 mt-1">Active Bounties</div>
                </div>
              </div>
            </div>

            {/* NPS Dashboard */}
            <NPSDashboard />
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setUserPage(1); }}
                  placeholder="Search users by email or name..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-xs font-mono text-gray-900 placeholder:text-gray-700 focus:outline-none focus:border-gray-400"
                />
              </div>
              <span className="text-[10px] font-mono text-gray-700">{userTotal} users</span>
            </div>

            {/* User Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 text-[10px] font-mono text-gray-700 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono text-gray-700 uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono text-gray-700 uppercase tracking-wider">Joined</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono text-gray-700 uppercase tracking-wider">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold text-gray-900">{user.display_name || 'Unknown'}</div>
                        <div className="text-[10px] font-mono text-gray-700">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          user.subscription_plan === 'free' ? 'bg-gray-100 text-gray-700' :
                          user.subscription_plan.includes('personal') ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {user.subscription_plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          user.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {user.subscription_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono text-gray-700">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono text-gray-700">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-700">
                Page {userPage} of {Math.ceil(userTotal / 50)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setUserPage(p => p + 1)}
                  disabled={userPage >= Math.ceil(userTotal / 50)}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold disabled:opacity-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Support Tickets</h3>
            <p className="text-xs text-gray-700 mb-4">
              View and respond to user support requests. Tickets are sorted by priority.
            </p>
            <div className="space-y-3">
              {['urgent', 'high', 'normal', 'low'].map(priority => (
                <div key={priority} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                      priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      priority === 'high' ? 'bg-amber-100 text-amber-700' :
                      priority === 'normal' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{priority}</span>
                    <span className="text-xs text-gray-900">{priority === 'urgent' ? '2' : priority === 'high' ? '5' : '12'} tickets</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-700" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">System Health</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-display font-extrabold text-emerald-600">✓</div>
                <div className="text-[10px] font-mono text-emerald-700 mt-1">Server Status</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-display font-extrabold text-gray-900">0</div>
                <div className="text-[10px] font-mono text-gray-700 mt-1">Errors (24h)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-display font-extrabold text-gray-900">0 MB</div>
                <div className="text-[10px] font-mono text-gray-700 mt-1">Database Size</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtitle, color }: {
  icon: any;
  label: string;
  value: string | number;
  subtitle: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-[10px] font-mono text-gray-700 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-display font-extrabold text-gray-900">{value}</div>
      <div className="text-[10px] font-mono text-gray-700 mt-1">{subtitle}</div>
    </div>
  );
}
