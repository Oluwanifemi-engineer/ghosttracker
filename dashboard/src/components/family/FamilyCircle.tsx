'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { MapPin, Battery, Shield, UserPlus, X, Clock, Wifi, WifiOff } from 'lucide-react';

/**
 * FamilyCircle — shows family members with real-time locations.
 * Integrates with the Sentinel panel area in the dashboard.
 */

interface FamilyMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  last_seen: string | null;
  location: { lat: number; lng: number } | null;
  battery_percent: number | null;
  is_online: boolean;
}

interface CircleData {
  circle_id: string;
  circle_name: string;
  member_count: number;
  members: FamilyMember[];
}

export function FamilyCircle() {
  const { isConnected } = useStore();
  const [circle, setCircle] = useState<CircleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  const fetchCircle = useCallback(async () => {
    if (!isConnected) return;
    try {
      const api = getAPI();
      const data = await api.getFamilyCircle();
      setCircle(data);
    } catch (e) {
      // Family circle may not be available on free tier
      console.log('Family circle not available');
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    fetchCircle();
    const interval = setInterval(fetchCircle, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchCircle]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      const api = getAPI();
      await api.inviteFamilyMember(inviteEmail.trim());
      setInviteEmail('');
      setShowInvite(false);
      fetchCircle(); // Refresh
    } catch (e: any) {
      setInviteError(e?.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/[0.06] rounded animate-pulse w-1/2" />
        <div className="h-20 bg-white/[0.03] rounded-lg animate-pulse" />
        <div className="h-20 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="p-4 text-center">
        <Shield size={20} className="mx-auto text-gray-300 mb-2" />
        <div className="text-xs text-white/40 font-bold">Family Circle</div>
        <div className="text-[10px] font-mono text-white/40 mt-1">
          Upgrade to Personal plan to create a family circle
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-emerald-500" />
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-bold">
            {circle.circle_name}
          </span>
          <span className="text-[9px] font-mono text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded">
            {circle.member_count} member{circle.member_count !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-all"
        >
          <UserPlus size={10} />
          Invite
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-700 font-bold">
              Invite to Circle
            </span>
            <button onClick={() => setShowInvite(false)} className="text-emerald-400 hover:text-emerald-600">
              <X size={12} />
            </button>
          </div>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-3 py-2 rounded-lg border border-emerald-200 bg-white text-xs font-mono text-white/80 placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          {inviteError && (
            <div className="text-[10px] font-mono text-red-500">{inviteError}</div>
          )}
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold transition-colors"
          >
            {inviting ? 'Inviting...' : 'Send Invite'}
          </button>
        </div>
      )}

      {/* Members */}
      <div className="space-y-2">
        {circle.members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-gray-100 hover:border-white/[0.08] transition-colors"
          >
            {/* Avatar */}
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  member.is_online ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white/80 truncate">
                  {member.name}
                </span>
                {member.role === 'admin' && (
                  <span className="text-[7px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {member.is_online ? (
                  <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-600">
                    <Wifi size={8} /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-mono text-white/40">
                    <WifiOff size={8} /> Offline
                  </span>
                )}
                {member.last_seen && (
                  <span className="flex items-center gap-1 text-[9px] font-mono text-white/40">
                    <Clock size={8} /> {formatLastSeen(member.last_seen)}
                  </span>
                )}
              </div>
            </div>

            {/* Location + Battery */}
            <div className="text-right shrink-0">
              {member.location && (
                <div className="flex items-center gap-1 text-[9px] font-mono text-white/40">
                  <MapPin size={8} className="text-emerald-500" />
                  {member.location.lat.toFixed(4)}, {member.location.lng.toFixed(4)}
                </div>
              )}
              {member.battery_percent != null && (
                <div className="flex items-center gap-1 text-[9px] font-mono text-white/40 justify-end">
                  <Battery
                    size={8}
                    className={member.battery_percent <= 20 ? 'text-red-500' : 'text-emerald-500'}
                  />
                  {member.battery_percent}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {circle.members.length === 0 && (
        <div className="text-center py-4">
          <UserPlus size={16} className="mx-auto text-gray-300 mb-2" />
          <div className="text-[10px] font-mono text-white/40">
            No family members yet. Invite someone!
          </div>
        </div>
      )}
    </div>
  );
}

function formatLastSeen(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return '';
  }
}
