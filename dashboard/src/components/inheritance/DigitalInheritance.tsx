"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Key,
  Copy,
  Trash2,
  Eye,
  Lock,
} from "lucide-react";

interface Beneficiary {
  id: string;
  name: string;
  email: string;
  relationship: string;
  access_level: string;
  delay_hours: number;
  status: string;
  created_at: string;
}

const RELATIONSHIP_OPTIONS = [
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "friend", label: "Friend" },
  { value: "lawyer", label: "Lawyer" },
  { value: "other", label: "Other" },
];

const ACCESS_LEVELS = [
  {
    value: "location",
    label: "Location Only",
    description: "See device location and battery",
    icon: Eye,
  },
  {
    value: "evidence",
    label: "Location + Evidence",
    description: "Location, photos, and recordings",
    icon: Shield,
  },
  {
    value: "full",
    label: "Full Access",
    description: "All device data and evidence",
    icon: Lock,
  },
];

export function DigitalInheritance() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    relationship: "spouse",
    access_level: "location",
    delay_hours: 48,
  });

  const fetchBeneficiaries = useCallback(async () => {
    try {
      const res = await fetch("/api/inheritance/beneficiaries", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBeneficiaries(data.beneficiaries);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  const addBeneficiary = async () => {
    if (!form.name || !form.email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/inheritance/beneficiary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        setNewAccessCode(data.access_code);
        setShowAddForm(false);
        setForm({ name: "", email: "", relationship: "spouse", access_level: "location", delay_hours: 48 });
        fetchBeneficiaries();
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const removeBeneficiary = async (id: string) => {
    if (!confirm("Remove this beneficiary? Their access code will be invalidated.")) return;

    try {
      await fetch(`/api/inheritance/beneficiary/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      fetchBeneficiaries();
    } catch {
      // silently fail
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(newAccessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "expired":
        return "bg-gray-100 text-gray-500";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Digital Inheritance</h2>
            <p className="text-sm text-gray-500">Designate trusted people for emergency access</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus size={16} />
          Add Beneficiary
        </button>
      </div>

      {/* New Access Code Alert */}
      {newAccessCode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Key size={20} className="text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-emerald-900">Access Code Generated</h4>
              <p className="text-sm text-emerald-700 mb-3">
                Share this code with your beneficiary. It will only be shown once.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-4 py-2 rounded-lg font-mono text-lg border border-emerald-200">
                  {newAccessCode}
                </code>
                <button
                  onClick={copyCode}
                  className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors"
                >
                  {copied ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <Copy size={16} className="text-emerald-600" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewAccessCode("")}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Add Beneficiary</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
              <select
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Window
              </label>
              <select
                value={form.delay_hours}
                onChange={(e) => setForm({ ...form, delay_hours: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
                <option value={168}>7 days</option>
              </select>
            </div>
          </div>

          {/* Access Level */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Access Level</label>
            <div className="grid grid-cols-3 gap-3">
              {ACCESS_LEVELS.map((level) => {
                const LevelIcon = level.icon;
                return (
                  <button
                    key={level.value}
                    onClick={() => setForm({ ...form, access_level: level.value })}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      form.access_level === level.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <LevelIcon
                      size={18}
                      className={
                        form.access_level === level.value ? "text-indigo-600" : "text-gray-400"
                      }
                    />
                    <p className="text-sm font-medium text-gray-900 mt-1">{level.label}</p>
                    <p className="text-xs text-gray-500">{level.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={addBeneficiary}
              disabled={loading || !form.name || !form.email}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? "Adding..." : "Add Beneficiary"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Beneficiaries List */}
      <div className="space-y-3">
        {beneficiaries.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">No Beneficiaries Yet</h3>
            <p className="text-sm text-gray-500">
              Add trusted people who can access your device data in emergencies.
            </p>
          </div>
        ) : (
          beneficiaries.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-700 font-semibold text-sm">
                    {b.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{b.name}</p>
                  <p className="text-sm text-gray-500">
                    {b.relationship} · {b.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(b.status)}`}
                  >
                    {b.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {b.access_level} · {b.delay_hours}h delay
                  </p>
                </div>
                <button
                  onClick={() => removeBeneficiary(b.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* How It Works */}
      <div className="bg-purple-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">How Digital Inheritance Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-700 font-bold text-sm">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Designate</p>
              <p className="text-xs text-gray-500">Add trusted people</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-700 font-bold text-sm">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Share Code</p>
              <p className="text-xs text-gray-500">Give them the access code</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-700 font-bold text-sm">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Emergency</p>
              <p className="text-xs text-gray-500">They request access</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-700 font-bold text-sm">4</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Cancel Window</p>
              <p className="text-xs text-gray-500">You can cancel within delay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
