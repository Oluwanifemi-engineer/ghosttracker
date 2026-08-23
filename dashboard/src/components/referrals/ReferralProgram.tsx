"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Copy,
  CheckCircle2,
  Share2,
  Trophy,
  Users,
  Star,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Send,
  Smartphone,
  Link2,
} from "lucide-react";

interface ReferralCode {
  code: string;
  share_url: string;
  share_message: string;
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  reward_balance: number;
  tier: string;
}

interface Leader {
  rank: number;
  name: string;
  referral_count: number;
  tier: string;
}

const TIER_CONFIG = {
  bronze: { color: "text-amber-600", bg: "bg-amber-100", label: "Bronze", icon: "🥉", next: 5 },
  silver: { color: "text-gray-600", bg: "bg-gray-100", label: "Silver", icon: "🥈", next: 10 },
  gold: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Gold", icon: "🥇", next: 25 },
  platinum: { color: "text-purple-600", bg: "bg-purple-100", label: "Platinum", icon: "💎", next: 999 },
};

export function ReferralProgram() {
  const [code, setCode] = useState<ReferralCode | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [codeRes, leaderRes] = await Promise.all([
        fetch("/api/referrals/code", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/referrals/leaderboard"),
      ]);

      if (codeRes.ok) setCode(await codeRes.json());
      if (leaderRes.ok) {
        const data = await leaderRes.json();
        setLeaderboard(data.leaders);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code.share_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Track share
    fetch("/api/referrals/share?platform=copy", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
  };

  const shareWhatsApp = () => {
    if (!code) return;
    const url = `https://wa.me/?text=${encodeURIComponent(code.share_message)}`;
    window.open(url, "_blank");

    fetch("/api/referrals/share?platform=whatsapp", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
  };

  const shareTelegram = () => {
    if (!code) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(code.share_url)}&text=${encodeURIComponent(code.share_message)}`;
    window.open(url, "_blank");

    fetch("/api/referrals/share?platform=telegram", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
  };

  const shareTwitter = () => {
    if (!code) return;
    const tweet = `🛡️ I use Magneetar to protect my phone and stay connected. Join me and get 1 week free premium! Use code: ${code.code}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    window.open(url, "_blank");

    fetch("/api/referrals/share?platform=twitter", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const tierConfig = code ? TIER_CONFIG[code.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.bronze : TIER_CONFIG.bronze;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
          <Gift size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Referral Program</h2>
          <p className="text-sm text-gray-500">Invite friends, earn free premium months</p>
        </div>
      </div>

      {/* Referral Code Card */}
      {code && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm">Your Referral Code</p>
              <p className="text-3xl font-mono font-bold tracking-widest">{code.code}</p>
            </div>
            <div className={`px-3 py-1 rounded-full ${tierConfig.bg} text-sm font-medium`}>
              {tierConfig.icon} {tierConfig.label}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{code.successful_referrals}</p>
              <p className="text-white/80 text-xs">Successful</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{code.pending_referrals}</p>
              <p className="text-white/80 text-xs">Pending</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{code.reward_balance}</p>
              <p className="text-white/80 text-xs">Months Earned</p>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex gap-3">
            <button
              onClick={shareWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors font-medium"
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
            <button
              onClick={shareTelegram}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors font-medium"
            >
              <Send size={18} />
              Telegram
            </button>
            <button
              onClick={shareTwitter}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors font-medium"
            >
              <Smartphone size={18} />
              Twitter
            </button>
          </div>
        </div>
      )}

      {/* Copy Link */}
      {code && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-2">Share Link</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code.share_url}
              readOnly
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
            />
            <button
              onClick={copyCode}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Share Your Code</p>
              <p className="text-xs text-gray-500">Send to friends via WhatsApp, SMS, or social media</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Friends Sign Up</p>
              <p className="text-xs text-gray-500">They install Magneetar and enter your code</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Both Get Rewards</p>
              <p className="text-xs text-gray-500">You get 1 month free, they get 1 week free</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Progress */}
      {code && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Your Tier Progress</h3>
          <div className="space-y-3">
            {Object.entries(TIER_CONFIG).map(([key, config]) => {
              const isActive = code.tier === key;
              const isUnlocked = code.successful_referrals >= config.next ||
                (key === "bronze") ||
                (key === "silver" && code.successful_referrals >= 5) ||
                (key === "gold" && code.successful_referrals >= 10) ||
                (key === "platinum" && code.successful_referrals >= 25);

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isActive ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${isActive ? "text-emerald-900" : "text-gray-900"}`}>
                        {config.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {key === "platinum" ? "25+ referrals" : `${config.next} referrals needed`}
                      </p>
                    </div>
                  </div>
                  {isUnlocked ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : (
                    <span className="text-xs text-gray-400">
                      {code.successful_referrals}/{config.next}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900">Top Referrers</h3>
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((leader) => {
              const config = TIER_CONFIG[leader.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.bronze;
              return (
                <div
                  key={leader.rank}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      leader.rank === 1 ? "bg-amber-100 text-amber-700" :
                      leader.rank === 2 ? "bg-gray-100 text-gray-600" :
                      leader.rank === 3 ? "bg-orange-100 text-orange-700" :
                      "bg-gray-50 text-gray-500"
                    }`}>
                      {leader.rank}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{leader.name}</p>
                      <p className="text-xs text-gray-500">{config.icon} {config.label}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">
                    {leader.referral_count} referrals
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rewards Breakdown */}
      <div className="bg-emerald-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Reward Structure</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Gift size={18} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Referrer Reward</p>
              <p className="text-xs text-gray-600">1 month free premium per successful referral</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Star size={18} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Referred Friend Reward</p>
              <p className="text-xs text-gray-600">1 week free premium on signup</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Trophy size={18} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Tier Bonuses</p>
              <p className="text-xs text-gray-600">Higher tiers = more rewards per referral</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users size={18} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Leaderboard Recognition</p>
              <p className="text-xs text-gray-600">Top referrers get public recognition</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
