'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { ClipboardList, FileText, Loader, ShieldCheck } from 'lucide-react';
import { EvidenceSkeleton } from '@/components/ui/Skeleton';

export function EvidencePanel() {
  const { selectedDeviceId } = useStore();
  const { toast } = useToast();
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchEvidence = useCallback(async () => {
    if (!selectedDeviceId) return;
    try { const api = getAPI(); const res = await api.getEvidence(selectedDeviceId); setEvidence(res); }
    catch (e) { console.error('Failed to fetch evidence:', e); }
  }, [selectedDeviceId]);

  useEffect(() => { fetchEvidence(); }, [fetchEvidence]);

  const handleGenerate = async () => {
    if (!selectedDeviceId) return;
    setGenerating(true); setError('');
    try {
      const api = getAPI();
      await api.generateEvidencePDF(selectedDeviceId);
      toast('Recovery dossier downloaded', 'success');
      await fetchEvidence();
    } catch (e: any) {
      const message = e?.message || 'Failed to generate dossier';
      setError(message); toast(message, 'error');
    } finally { setGenerating(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/40 uppercase tracking-wider font-bold mb-3 px-1">
        <ClipboardList size={12} className="text-white/25" />
        Evidence Locker
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        {loading && !evidence ? (
          <EvidenceSkeleton />
        ) : evidence?.case_id ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-white/35 font-bold">Case ID</span>
                <div className="text-white/80 font-bold">#{evidence.case_id}</div>
              </div>
              <div>
                <span className="text-white/35 font-bold">Status</span>
                <div className={cn(
                  'font-bold',
                  evidence.status === 'active' ? 'text-amber-400' : 'text-white/80'
                )}>
                  {evidence.status?.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-center">
                <div className="font-mono text-lg font-bold text-white/80">{evidence.item_counts?.locations || 0}</div>
                <div className="text-[9px] font-mono text-white/30 font-bold">LOCATIONS</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-center">
                <div className="font-mono text-lg font-bold text-white/80">{evidence.item_counts?.photos || 0}</div>
                <div className="text-[9px] font-mono text-white/30 font-bold">PHOTOS</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-center">
                <div className="font-mono text-lg font-bold text-white/80">{evidence.item_counts?.audio || 0}</div>
                <div className="text-[9px] font-mono text-white/30 font-bold">AUDIO</div>
              </div>
            </div>

            {evidence.sha256_chain && (
              <div className="text-[10px] font-mono text-white/20 break-all">
                <span className="text-white/35 font-bold">Integrity Chain: </span>
                {evidence.sha256_chain.slice(0, 32)}...
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={20} className="text-white/15" />
            </div>
            <div className="text-white/40 text-sm font-bold mb-1">No active evidence case</div>
            <div className="text-white/20 text-xs font-mono leading-relaxed max-w-[240px] mx-auto">
              Evidence is automatically created when theft is detected.
            </div>
          </div>
        )}
      </div>

      <button onClick={handleGenerate} disabled={generating || !selectedDeviceId}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-400 text-xs font-mono font-bold transition-all">
        {generating ? (
          <><Loader size={14} className="animate-spin" />GENERATING DOSSIER...</>
        ) : (
          <><FileText size={14} />EXPORT RECOVERY DOSSIER (PDF)</>
        )}
      </button>

      {error && <div className="text-[10px] font-mono text-red-400 break-words">{error}</div>}

      <p className="text-[10px] font-mono text-white/20 leading-relaxed">
        One-click PDF for police or insurers: device info, location trail, command
        timeline, tamper-proof photos & audio, and alert history.
      </p>
    </div>
  );
}
