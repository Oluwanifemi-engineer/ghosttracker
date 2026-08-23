"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Code,
  Key,
  Copy,
  CheckCircle2,
  ExternalLink,
  Shield,
  Zap,
  Clock,
  AlertTriangle,
  Book,
  Terminal,
  Globe,
  Lock,
  BarChart3,
  ArrowRight,
} from "lucide-react";

interface APIKey {
  id: string;
  name: string;
  key_preview: string;
  scopes: string[];
  rate_limit: number;
  created_at: string;
  last_used: string | null;
  active: boolean;
}

const API_SECTIONS = [
  {
    id: "auth",
    title: "Authentication",
    icon: Key,
    content: `All API requests require authentication via an API key passed in the X-API-Key header.

\`\`\`bash
curl -H "X-API-Key: YOUR_API_KEY" https://api.magneetar.me/api/v1/devices
\`\`\`

API keys are scoped to specific permissions. Generate keys in the dashboard under Settings → API Keys.`,
  },
  {
    id: "trust",
    title: "Trust Score API",
    icon: Shield,
    content: `Verify any phone's trust score via IMEI.

**Endpoint:** POST /api/v1/trust/check

\`\`\`json
{
  "imei": "123456789012345"
}
\`\`\`

**Response:**
\`\`\`json
{
  "imei": "123456789012345",
  "trust_score": 85,
  "status": "clean",
  "device_info": {
    "brand": "Samsung",
    "model": "Galaxy A54"
  },
  "owner_verified": true,
  "theft_reports": 0
}
\`\`\`

**Rate Limit:** 100 requests/hour per key`,
  },
  {
    id: "devices",
    title: "Device Tracking API",
    icon: Globe,
    content: `Track device locations in real-time.

**Get Device Location:** GET /api/v1/devices/{device_id}/location

**Response:**
\`\`\`json
{
  "device_id": "dev_abc123",
  "lat": 6.5244,
  "lng": 3.3792,
  "battery": 85,
  "last_seen": "2026-08-23T10:30:00Z",
  "accuracy_meters": 10
}
\`\`\`

**Get Location History:** GET /api/v1/devices/{device_id}/history?hours=24

**Rate Limit:** 1000 requests/hour per key`,
  },
  {
    id: "geofence",
    title: "Smart Geofencing API",
    icon: BarChart3,
    content: `Manage AI-powered geofence zones.

**Create Zone:** POST /api/v1/geofence/zones

\`\`\`json
{
  "name": "Office",
  "lat": 6.5244,
  "lng": 3.3792,
  "radius_meters": 200,
  "alert_on_enter": true,
  "alert_on_exit": true
}
\`\`\`

**Get Anomalies:** GET /api/v1/geofence/anomalies

Returns detected unusual behavior patterns for tracked devices.

**Rate Limit:** 100 requests/hour per key`,
  },
  {
    id: "webhooks",
    title: "Webhooks",
    icon: Zap,
    content: `Receive real-time notifications via webhooks.

**Supported Events:**
- device.location_update — Device location updated
- device.theft_detected — Theft behavior detected
- device.geofence_enter — Device entered a zone
- device.geofence_exit — Device exited a zone
- device.offline — Device went offline
- bounty.claimed — A bounty was claimed

**Webhook Payload:**
\`\`\`json
{
  "event": "device.theft_detected",
  "device_id": "dev_abc123",
  "timestamp": "2026-08-23T10:30:00Z",
  "data": {
    "location": {"lat": 6.5244, "lng": 3.3792},
    "confidence": 0.95
  }
}
\`\`\`

**Webhook Security:** All webhooks are signed with HMAC-SHA256. Verify the X-Magneetar-Signature header.`,
  },
  {
    id: "rate-limits",
    title: "Rate Limits",
    icon: Clock,
    content: `API rate limits by plan:

| Plan | Requests/Hour | Requests/Day |
|------|---------------|--------------|
| Free | 100 | 1,000 |
| Personal | 1,000 | 10,000 |
| Family | 5,000 | 50,000 |
| Enterprise | 50,000 | 500,000 |

Rate limit headers are included in every response:
- X-RateLimit-Limit: Maximum requests per window
- X-RateLimit-Remaining: Requests remaining
- X-RateLimit-Reset: Time when the window resets

When rate limited, you'll receive a 429 Too Many Requests response.`,
  },
];

export default function DevelopersPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [activeSection, setActiveSection] = useState("auth");
  const [copied, setCopied] = useState("");
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/developers/keys", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  const createKey = async () => {
    if (!newKeyName) return;
    try {
      const res = await fetch("/api/developers/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ name: newKeyName, scopes: ["read"] }),
      });
      if (res.ok) {
        setShowCreateKey(false);
        setNewKeyName("");
        fetchKeys();
      }
    } catch {
      // silently fail
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    try {
      await fetch(`/api/developers/keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      fetchKeys();
    } catch {
      // silently fail
    }
  };

  const activeContent = API_SECTIONS.find((s) => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
            <Code size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Magneetar API</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Build on Magneetar&apos;s phone safety infrastructure. Trust Scores, real-time tracking,
            smart geofencing, and webhooks — all via a RESTful API.
          </p>
          <div className="flex justify-center gap-4 mt-8">
            <a
              href="#docs"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 rounded-xl hover:bg-white/90 font-semibold transition-colors"
            >
              <Book size={18} />
              API Documentation
            </a>
            <a
              href="#keys"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold transition-colors"
            >
              <Key size={18} />
              Get API Key
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 -mt-8">
        {/* Quick Start */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Quick Start</h2>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-sm">
            <p className="text-emerald-400 mb-2"># Check a phone&apos;s trust score</p>
            <p className="text-white/80">
              curl -X POST https://api.magneetar.me/api/v1/trust/check \
            </p>
            <p className="text-white/80 ml-4">-H &quot;X-API-Key: YOUR_API_KEY&quot; \</p>
            <p className="text-white/80 ml-4">
              -H &quot;Content-Type: application/json&quot; \
            </p>
            <p className="text-white/80 ml-4">
              -d &apos;{`{"imei": "123456789012345"}`}&apos;
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 sticky top-4">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                Documentation
              </h3>
              <nav className="space-y-1">
                {API_SECTIONS.map((section) => {
                  const SectionIcon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === section.id
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <SectionIcon size={16} />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Documentation Section */}
            {activeContent && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <activeContent.icon size={24} className="text-indigo-400" />
                  <h2 className="text-xl font-bold text-white">{activeContent.title}</h2>
                </div>
                <div className="prose prose-invert max-w-none">
                  <div className="text-white/80 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {activeContent.content.split("\n").map((line, i) => {
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return (
                          <p key={i} className="font-bold text-white mt-4 mb-1">
                            {line.replace(/\*\*/g, "")}
                          </p>
                        );
                      }
                      if (line.startsWith("```")) {
                        return null;
                      }
                      if (line.startsWith("|")) {
                        return (
                          <p key={i} className="text-white/60">
                            {line}
                          </p>
                        );
                      }
                      if (line.startsWith("- ")) {
                        return (
                          <p key={i} className="text-white/70 ml-4">
                            • {line.slice(2)}
                          </p>
                        );
                      }
                      return (
                        <p key={i} className="text-white/80">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* API Keys Section */}
            <div id="keys" className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">API Keys</h2>
                <button
                  onClick={() => setShowCreateKey(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  <Key size={16} />
                  Create Key
                </button>
              </div>

              {showCreateKey && (
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g., Production, Staging)"
                    className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createKey}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowCreateKey(false)}
                      className="px-4 py-2 border border-white/20 text-white/60 rounded-lg hover:bg-white/5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8 text-white/40">Loading...</div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key size={40} className="mx-auto text-white/20 mb-3" />
                  <p className="text-white/60">No API keys yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="bg-black/20 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-white">{key.name}</p>
                        <p className="text-sm text-white/40 font-mono">{key.key_preview}</p>
                        <p className="text-xs text-white/30 mt-1">
                          {key.scopes.join(", ")} · {key.rate_limit} req/hr
                        </p>
                      </div>
                      <button
                        onClick={() => deleteKey(key.id)}
                        className="text-white/30 hover:text-red-400 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rate Limits */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Rate Limits</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { plan: "Free", limit: "100/hr", color: "text-gray-400" },
                  { plan: "Personal", limit: "1K/hr", color: "text-blue-400" },
                  { plan: "Family", limit: "5K/hr", color: "text-purple-400" },
                  { plan: "Enterprise", limit: "50K/hr", color: "text-amber-400" },
                ].map((tier) => (
                  <div
                    key={tier.plan}
                    className="bg-black/20 rounded-xl p-4 text-center"
                  >
                    <p className={`text-2xl font-bold ${tier.color}`}>{tier.limit}</p>
                    <p className="text-sm text-white/60">{tier.plan}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
