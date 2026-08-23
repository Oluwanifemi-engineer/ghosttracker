"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAPI } from "@/lib/api";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  Phone,
  MapPin,
  Battery,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface TrustData {
  device_id: string;
  device_name: string;
  trust_score: number;
  status: "clean" | "suspicious" | "stolen" | "unknown";
  owner_info: { name: string; contact: string } | null;
  qr_url: string;
  scan_instructions: string;
  location?: { lat: number; lng: number } | null;
  battery?: number;
  last_seen?: string;
}

const STATUS_CONFIG = {
  clean: {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: ShieldCheck,
    label: "Verified Clean",
    description: "This device has no theft reports and is verified by its owner.",
    gradient: "from-emerald-500 to-teal-600",
  },
  suspicious: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: ShieldAlert,
    label: "Suspicious",
    description: "Low trust score. Proceed with caution and verify ownership.",
    gradient: "from-amber-500 to-orange-600",
  },
  stolen: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: AlertTriangle,
    label: "REPORTED STOLEN",
    description: "This device has been reported stolen. Do not purchase or keep this device.",
    gradient: "from-red-500 to-rose-600",
  },
  unknown: {
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: ShieldQuestion,
    label: "Unknown",
    description: "This device is not registered with Magneetar. Trust status unknown.",
    gradient: "from-gray-500 to-slate-600",
  },
};

function TrustScanContent() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device") || "";
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetchTrustData = async () => {
      try {
        const api = getAPI();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/trust/qr-data/${deviceId}`);
        if (!res.ok) throw new Error('Device not found');
        const trustData = await res.json() as TrustData;
        setData(trustData);
      } catch {
        setError(
          "Could not verify this device. It may not exist or the QR code is invalid."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTrustData();
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <AlertTriangle size={32} className="text-amber-400 sm:hidden" />
            <AlertTriangle size={40} className="text-amber-400 hidden sm:block" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            No Device Specified
          </h1>
          <p className="text-white/60 mb-4 sm:mb-6 text-sm sm:text-base">
            Scan a QR code on a Magneetar-protected device to verify its
            status.
          </p>
          <a
            href="/trust"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm sm:text-base"
          >
            Check IMEI Instead
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={40}
            className="text-white animate-spin mx-auto mb-4 sm:hidden"
          />
          <Loader2
            size={48}
            className="text-white animate-spin mx-auto mb-4 hidden sm:block"
          />
          <p className="text-white/70 text-base sm:text-lg">
            Verifying device...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <AlertTriangle size={32} className="text-red-400 sm:hidden" />
            <AlertTriangle size={40} className="text-red-400 hidden sm:block" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Verification Failed
          </h1>
          <p className="text-white/60 mb-4 sm:mb-6 text-sm sm:text-base">
            {error}
          </p>
          <a
            href="/trust"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm sm:text-base"
          >
            Go to Magneetar
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[data.status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div
        className={`bg-gradient-to-r ${config.gradient} py-8 sm:py-12 px-4`}
      >
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <StatusIcon size={32} className="text-white sm:hidden" />
            <StatusIcon size={48} className="text-white hidden sm:block" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {config.label}
          </h1>
          <p className="text-white/80 text-sm sm:text-base">
            {config.description}
          </p>
        </div>
      </div>

      {/* Trust Score Card */}
      <div className="max-w-md mx-auto p-4 -mt-4 sm:-mt-6">
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-4">
          {/* Trust Score Bar */}
          <div className="mb-5 sm:mb-6">
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="font-medium text-gray-700">Trust Score</span>
              <span className={`font-bold text-base sm:text-lg ${config.color}`}>
                {data.trust_score}/100
              </span>
            </div>
            <div className="w-full h-3 sm:h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  data.trust_score >= 70
                    ? "bg-emerald-500"
                    : data.trust_score >= 40
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${data.trust_score}%` }}
              />
            </div>
          </div>

          {/* Device Info */}
          <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Phone size={20} className="text-white sm:hidden" />
                <Phone size={24} className="text-white hidden sm:block" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">
                  {data.device_name}
                </h2>
                <p className="text-[10px] sm:text-sm text-gray-500">
                  Device ID: {data.device_id.slice(0, 12)}...
                </p>
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
            {data.battery !== undefined && data.battery !== null && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 sm:p-3">
                <Battery size={14} className="text-gray-500" />
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Battery
                  </p>
                  <p className="text-[11px] sm:text-sm font-medium text-gray-900">
                    {data.battery}%
                  </p>
                </div>
              </div>
            )}
            {data.last_seen && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 sm:p-3">
                <Clock size={14} className="text-gray-500" />
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Last Seen
                  </p>
                  <p className="text-[11px] sm:text-sm font-medium text-gray-900">
                    {new Date(data.last_seen).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            {data.location && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 sm:p-3 col-span-2">
                <MapPin size={14} className="text-gray-500" />
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Last Known Location
                  </p>
                  <p className="text-[11px] sm:text-sm font-medium text-gray-900">
                    {data.location.lat.toFixed(4)},{" "}
                    {data.location.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Owner Contact (only if not stolen) */}
          {data.owner_info && data.status !== "stolen" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4 mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-emerald-900 mb-2">
                Contact the Owner
              </h3>
              <p className="text-xs sm:text-sm text-emerald-700 mb-3">
                This device belongs to{" "}
                <strong>{data.owner_info.name}</strong>. If you found this
                device, please contact them.
              </p>
              <a
                href={`mailto:${data.owner_info.contact}?subject=Found your Magneetar device&body=Hi ${data.owner_info.name}, I found your device (ID: ${data.device_id}). Please contact me to arrange return.`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs sm:text-sm font-medium"
              >
                <Phone size={14} />
                Contact Owner
              </a>
            </div>
          )}

          {/* Stolen Warning */}
          {data.status === "stolen" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-red-900 mb-2">
                This Device is Stolen
              </h3>
              <p className="text-xs sm:text-sm text-red-700 mb-3">
                This device has been reported stolen to Magneetar. If you
                purchased this device, you may be in possession of stolen
                property. We recommend:
              </p>
              <ul className="text-xs sm:text-sm text-red-700 space-y-1 mb-3">
                <li>• Contact the nearest police station</li>
                <li>• Do not attempt to factory reset the device</li>
                <li>• Return the device to its rightful owner</li>
              </ul>
              <a
                href="tel:112"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs sm:text-sm font-medium"
              >
                <Phone size={14} />
                Call Emergency Services
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-4 sm:py-6">
          <p className="text-white/40 text-xs sm:text-sm">
            Powered by Magneetar · Device Trust Verification
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TrustScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <Loader2 size={48} className="text-white animate-spin" />
        </div>
      }
    >
      <TrustScanContent />
    </Suspense>
  );
}
