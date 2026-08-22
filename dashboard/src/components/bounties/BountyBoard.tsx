'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { AlertTriangle, MapPin, Clock, DollarSign, Plus, X, ChevronRight } from 'lucide-react';

/**
 * BountyBoard — shows active recovery bounties near the user.
 * Users can post bounties for their stolen phones or claim found phones.
 */

interface Bounty {
  id: string;
  device_id: string;
  amount: number;
  amount_display: string;
  description: string;
  contact_phone?: string;
  device_name: string;
  created_at: string;
  expires_at: string;
}

interface BountyBoardProps {
  className?: string;
}

export function BountyBoard({ className }: BountyBoardProps) {
  const { selectedDeviceId, devices, isConnected } = useStore();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createAmount, setCreateAmount] = useState('5000');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchBounties = useCallback(async () => {
    if (!isConnected) return;
    try {
      const device = devices.find(d => d.id === selectedDeviceId);
      const lat = device?.lat || 6.5244;
      const lng = device?.lng || 3.3792;

      const api = getAPI();
      const data = await api.getActiveBounties(lat, lng, 20);
      setBounties(data.bounties);
    } catch (e) {
      console.log('Bounties not available');
    } finally {
      setLoading(false);
    }
  }, [isConnected, selectedDeviceId, devices]);

  useEffect(() => {
    fetchBounties();
    const interval = setInterval(fetchBounties, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBounties]);

  const handleCreate = async () => {
    if (!selectedDeviceId || !createAmount) return;
    setCreating(true);
    try {
      const api = getAPI();
      await api.createBounty({
        device_id: selectedDeviceId,
        amount: parseInt(createAmount) * 100, // Convert to kobo
        description: createDesc || undefined,
      });
      setShowCreate(false);
      setCreateAmount('5000');
      setCreateDesc('');
      fetchBounties();
    } catch (e: any) {
      alert(e?.message || 'Failed to create bounty');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
        <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
        <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={12} className="text-amber-500" />
          <span className="text-[10px] font-mono text-gray-700 uppercase tracking-wider font-bold">
            Recovery Bounties
          </span>
          {bounties.length > 0 && (
            <span className="text-[9px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
              {bounties.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 transition-all"
        >
          <Plus size={10} />
          Post
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-amber-700 font-bold">
              Post Bounty
            </span>
            <button onClick={() => setShowCreate(false)} className="text-amber-400 hover:text-amber-600">
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700">₦</span>
            <input
              type="number"
              value={createAmount}
              onChange={(e) => setCreateAmount(e.target.value)}
              placeholder="5000"
              className="flex-1 px-3 py-2 rounded-lg border border-amber-200 bg-white text-xs font-mono text-gray-900 placeholder:text-gray-700 focus:outline-none focus:border-amber-400"
              min="1000"
              max="500000"
            />
          </div>
          <input
            type="text"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-xs font-mono text-gray-900 placeholder:text-gray-700 focus:outline-none focus:border-amber-400"
          />
          <div className="text-[9px] font-mono text-amber-600">
            Min ₦1,000 · Max ₦500,000 · Expires in 30 days
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !selectedDeviceId}
            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-[10px] font-bold transition-colors"
          >
            {creating ? 'Posting...' : 'Post Bounty'}
          </button>
        </div>
      )}

      {/* Bounty List */}
      <div className="space-y-2">
        {bounties.map((bounty) => (
          <div
            key={bounty.id}
            className="p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-amber-200 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-600">
                    {bounty.amount_display}
                  </span>
                  <span className="text-[9px] font-mono text-gray-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    {bounty.device_name}
                  </span>
                </div>
                {bounty.description && (
                  <p className="text-[10px] text-gray-700 mt-1 line-clamp-2">
                    {bounty.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[9px] font-mono text-gray-700">
                    <Clock size={8} />
                    {formatTimeAgo(bounty.created_at)}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] font-mono text-gray-700">
                    <AlertTriangle size={8} />
                    Expires {formatExpiry(bounty.expires_at)}
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-700 shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>

      {bounties.length === 0 && (
        <div className="text-center py-4">
          <DollarSign size={16} className="mx-auto text-gray-300 mb-2" />
          <div className="text-[10px] font-mono text-gray-700">
            No active bounties nearby
          </div>
          <div className="text-[9px] font-mono text-gray-700 mt-1">
            Post a bounty if your phone is stolen
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch { return ''; }
}

function formatExpiry(expiresAt: string): string {
  try {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    return `in ${diffDays} days`;
  } catch { return ''; }
}
