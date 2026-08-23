"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Search,
  ScanLine,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ArrowRight,
  Phone,
  Users,
  MapPin,
  Lock,
} from "lucide-react";

// Trust page is PUBLIC — no login required. Call the API server directly.
const API_SERVER = "https://api.magneetar.me";

interface TrustResult {
  imei: string;
  trust_score: number;
  status: "clean" | "suspicious" | "stolen" | "unknown" | "registered";
  device_info: { brand: string; model: string; type: string; id?: string; name?: string } | null;
  owner_verified: boolean;
  theft_reports: number;
  last_active: string | null;
  warnings: string[];
}

const STATUS_CONFIG: Record<string, {
  color: string;
  bg: string;
  border: string;
  ring: string;
  icon: typeof ShieldCheck;
  label: string;
  description: string;
}> = {
  clean: {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-500/20",
    icon: ShieldCheck,
    label: "Clean",
    description: "No theft reports. Device is verified.",
  },
  registered: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    ring: "ring-blue-500/20",
    icon: ShieldCheck,
    label: "Registered",
    description: "Device is registered with Magneetar and verified.",
  },
  suspicious: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    ring: "ring-amber-500/20",
    icon: ShieldAlert,
    label: "Suspicious",
    description: "Low trust score. Verify ownership before buying.",
  },
  stolen: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    ring: "ring-red-500/20",
    icon: XCircle,
    label: "Reported Stolen",
    description: "This device has active theft reports. DO NOT BUY.",
  },
  unknown: {
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    ring: "ring-gray-500/20",
    icon: ShieldQuestion,
    label: "Unknown",
    description: "Device not registered with Magneetar.",
  },
};

export default function TrustPage() {
  const [imei, setImei] = useState("");
  const [result, setResult] = useState<TrustResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkIMEI = async () => {
    const cleanImei = imei.replace(/\D/g, "").trim();
    if (cleanImei.length < 15) {
      setError("Please enter a valid IMEI (15 digits)");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Call the API server directly — this is a PUBLIC endpoint
      const res = await fetch(`${API_SERVER}/trust/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: cleanImei, check_type: "full" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data as TrustResult);
    } catch (e: any) {
      setError(e?.message || "Failed to check IMEI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const config = result ? STATUS_CONFIG[result.status] || STATUS_CONFIG.unknown : null;
  const Icon = config?.icon ?? ShieldQuestion;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 py-12 sm:py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <ScanLine size={32} className="text-white sm:hidden" />
            <ScanLine size={40} className="text-white hidden sm:block" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-3">
            Phone Trust Verification
          </h1>
          <p className="text-white/80 text-sm sm:text-lg">
            Check if a phone is stolen before buying it. Free, instant,
            anonymous.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-6 sm:-mt-8">
        {/* IMEI Check Card */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
            Check IMEI Number
          </h2>
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                inputMode="numeric"
                value={imei}
                onChange={(e) =>
                  setImei(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
                placeholder="Enter 15-digit IMEI"
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-lg sm:text-xl text-center tracking-widest transition-all"
                onKeyDown={(e) => e.key === "Enter" && checkIMEI()}
              />
            </div>
            <button
              onClick={checkIMEI}
              disabled={loading || imei.replace(/\D/g, "").length < 15}
              className="px-5 sm:px-8 py-3 sm:py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all text-sm sm:text-base whitespace-nowrap"
            >
              {loading ? "Checking..." : "Check"}
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3 text-center">
            Dial{" "}
            <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">
              *#06#
            </code>{" "}
            on any phone to find its IMEI
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 flex items-center gap-3 mb-6">
            <AlertTriangle
              size={18}
              className="text-red-600 shrink-0"
            />
            <p className="text-xs sm:text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && config && (
          <div
            className={`rounded-2xl border-2 ${config.border} ${config.bg} p-4 sm:p-6 mb-6 ring-1 ${config.ring}`}
          >
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${config.bg} flex items-center justify-center shrink-0`}
              >
                <Icon size={28} className={`${config.color} sm:hidden`} />
                <Icon size={32} className={`${config.color} hidden sm:block`} />
              </div>
              <div>
                <h3
                  className={`text-xl sm:text-2xl font-bold ${config.color}`}
                >
                  {config.label}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  {config.description}
                </p>
              </div>
            </div>

            {/* Trust Score Bar */}
            <div className="mb-5 sm:mb-6">
              <div className="flex justify-between text-xs sm:text-sm mb-2">
                <span className="font-medium text-gray-700">Trust Score</span>
                <span
                  className={`font-bold text-lg sm:text-xl ${config.color}`}
                >
                  {result.trust_score}/100
                </span>
              </div>
              <div className="w-full h-3 sm:h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    result.trust_score >= 70
                      ? "bg-emerald-500"
                      : result.trust_score >= 40
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${result.trust_score}%` }}
                />
              </div>
            </div>

            {/* Device Info */}
            {result.device_info && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div className="bg-white/60 rounded-lg p-2 sm:p-3 text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Brand
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-900">
                    {result.device_info.brand || result.device_info.model || "—"}
                  </p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 sm:p-3 text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Model
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-900">
                    {result.device_info.model || "—"}
                  </p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 sm:p-3 text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500">Status</p>
                  <p className="text-xs sm:text-sm font-medium text-gray-900 capitalize">
                    {result.status}
                  </p>
                </div>
              </div>
            )}

            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {result.owner_verified ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <Info size={16} className="text-gray-400" />
                )}
                <span className="text-[11px] sm:text-sm text-gray-700">
                  Owner {result.owner_verified ? "Verified ✓" : "Not Verified"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {result.theft_reports > 0 ? (
                  <XCircle size={16} className="text-red-600" />
                ) : (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                )}
                <span className="text-[11px] sm:text-sm text-gray-700">
                  {result.theft_reports} Theft Report
                  {result.theft_reports !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-2 mt-4">
                {result.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs sm:text-sm text-amber-700 bg-amber-100/50 rounded-lg px-3 py-2"
                  >
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
              <Phone size={20} className="text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white text-sm sm:text-base mb-1">
              Verify Before Buying
            </h3>
            <p className="text-xs sm:text-sm text-white/60">
              Check any phone&apos;s trust score before purchasing a used
              device.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
              <MapPin size={20} className="text-blue-400" />
            </div>
            <h3 className="font-semibold text-white text-sm sm:text-base mb-1">
              Find Lost Devices
            </h3>
            <p className="text-xs sm:text-sm text-white/60">
              Scan a found phone&apos;s QR code to contact the owner.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
              <Lock size={20} className="text-purple-400" />
            </div>
            <h3 className="font-semibold text-white text-sm sm:text-base mb-1">
              Report Theft
            </h3>
            <p className="text-xs sm:text-sm text-white/60">
              Flag stolen phones so others can avoid buying them.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-6 sm:py-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
            Protect Your Phone
          </h2>
          <p className="text-white/60 mb-4 sm:mb-6 text-sm sm:text-base">
            Install Magneetar to get a trust score for your device and join the
            community watch network.
          </p>
          <a
            href="/download"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold text-base sm:text-lg transition-colors"
          >
            Download Magneetar
            <ArrowRight size={20} />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center py-4 sm:py-6 border-t border-white/10">
          <p className="text-white/40 text-xs sm:text-sm">
            Powered by Magneetar · Free Trust Verification
          </p>
        </div>
      </div>
    </div>
  );
}
