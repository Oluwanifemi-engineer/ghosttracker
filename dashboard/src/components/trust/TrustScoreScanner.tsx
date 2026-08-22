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
} from "lucide-react";

interface TrustScoreData {
  imei: string;
  trust_score: number;
  status: "clean" | "suspicious" | "stolen" | "unknown";
  device_info: { brand: string; model: string; type: string } | null;
  owner_verified: boolean;
  theft_reports: number;
  last_active: string | null;
  warnings: string[];
}

const STATUS_CONFIG = {
  clean: {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: ShieldCheck,
    label: "Clean",
    description: "No theft reports. Device is verified.",
  },
  suspicious: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: ShieldAlert,
    label: "Suspicious",
    description: "Low trust score. Verify ownership.",
  },
  stolen: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
    label: "Reported Stolen",
    description: "This device has active theft reports.",
  },
  unknown: {
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: ShieldQuestion,
    label: "Unknown",
    description: "Device not registered with Magneetar.",
  },
};

export function TrustScoreScanner() {
  const [imei, setImei] = useState("");
  const [result, setResult] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkIMEI = async () => {
    if (!imei || imei.length < 15) {
      setError("Please enter a valid IMEI (15 digits)");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/trust/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei, check_type: "full" }),
      });

      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Failed to check IMEI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const config = result ? STATUS_CONFIG[result.status] : null;
  const Icon = config?.icon ?? ShieldQuestion;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <ScanLine size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Trust Score Scanner</h2>
          <p className="text-sm text-gray-500">Verify any phone before buying or after finding</p>
        </div>
      </div>

      {/* IMEI Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enter IMEI Number
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
              placeholder="123456789012345"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-lg"
              onKeyDown={(e) => e.key === "Enter" && checkIMEI()}
            />
          </div>
          <button
            onClick={checkIMEI}
            disabled={loading || imei.length < 15}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? "Checking..." : "Check"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Find the IMEI by dialing *#06# on the phone, or check the device settings.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && config && (
        <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-6`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-full ${config.bg} flex items-center justify-center`}>
              <Icon size={28} className={config.color} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${config.color}`}>{config.label}</h3>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
          </div>

          {/* Trust Score Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Trust Score</span>
              <span className={`font-bold ${config.color}`}>{result.trust_score}/100</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
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
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Brand</p>
                <p className="font-medium text-gray-900">{result.device_info.brand}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Model</p>
                <p className="font-medium text-gray-900">{result.device_info.model}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-medium text-gray-900">{result.device_info.type}</p>
              </div>
            </div>
          )}

          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              {result.owner_verified ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <Info size={16} className="text-gray-400" />
              )}
              <span className="text-sm text-gray-700">
                Owner {result.owner_verified ? "Verified" : "Not Verified"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {result.theft_reports > 0 ? (
                <XCircle size={16} className="text-red-600" />
              ) : (
                <CheckCircle2 size={16} className="text-emerald-600" />
              )}
              <span className="text-sm text-gray-700">
                {result.theft_reports} Theft Report{result.theft_reports !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((warning, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle size={14} />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">How Trust Score Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Enter IMEI</p>
              <p className="text-xs text-gray-500">Dial *#06# to find the IMEI number</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Check Score</p>
              <p className="text-xs text-gray-500">See theft status and owner verification</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Make Decision</p>
              <p className="text-xs text-gray-500">Buy with confidence or report theft</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
