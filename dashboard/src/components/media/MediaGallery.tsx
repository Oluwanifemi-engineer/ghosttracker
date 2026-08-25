'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/store/useStore';
import { getAPI } from '@/lib/api';
import { cn, formatTimestamp, locationTimestamp, stepUpPasswordHint } from '@/lib/utils';
import { Camera, Music, Play, Pause, X, ChevronLeft, Trash2, ShieldCheck, Lock, ImageOff } from 'lucide-react';
import { MediaSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export function MediaGallery() {
  const { media, setMedia, selectedDeviceId, devices } = useStore();
  const { toast } = useToast();
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const accessRole: 'owner' | 'admin' | 'viewer' | 'device_only' = selectedDevice?.access_role ?? 'owner';
  const canManage = accessRole === 'owner' || accessRole === 'admin';
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemData, setItemData] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleted, setDeleted] = useState('');

  const fetchMedia = useCallback(async () => {
    if (!selectedDeviceId) return;
    try { const api = getAPI(); const res = await api.getMedia(selectedDeviceId); setMedia(res.media); }
    catch (e) { console.error('Failed to fetch media:', e); }
  }, [selectedDeviceId, setMedia]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const handleSelect = async (item: any) => {
    setSelectedItem(item);
    try { const api = getAPI(); const data = await api.getMediaFile(item.id); setItemData(data); }
    catch (e) { console.error('Failed to load media:', e); }
  };

  const handleClose = () => { setSelectedItem(null); setItemData(null); setPlaying(false); setPlayError(''); };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else {
      setPlayError('');
      audio.play().then(() => setPlaying(true)).catch((e) => {
        console.error('Audio playback failed:', e);
        setPlaying(false); setPlayError('Playback failed — try downloading the file.');
      });
    }
  }, [playing]);

  const toggleManage = () => { setManageMode(!manageMode); setSelectedIds(new Set()); setSelectedItem(null); };
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const deleteMediaItem = useCallback(async (id: number, password: string) => {
    await getAPI().deleteMedia(id, password);
  }, []);

  const handleDelete = async () => {
    if (deleting) return;
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setDeleting(true); setDeleteError('');
    const failed: string[] = [];
    for (const id of ids) {
      try { await deleteMediaItem(id, deletePassword); } catch (e: any) { failed.push(String(id)); }
    }
    setDeletePassword(''); setDeleteOpen(false); setSelectedIds(new Set());
    if (failed.length === 0) {
      const msg = ids.length > 1 ? `${ids.length} items deleted` : 'Media deleted';
      setDeleted(msg); toast(msg, 'success');
    } else {
      const msg = `${ids.length - failed.length}/${ids.length} deleted · ${failed.length} failed`;
      setDeleted(msg); toast(msg, 'warning');
    }
    setTimeout(() => setDeleted(''), 4000);
    await fetchMedia(); setDeleting(false);
  };

  const viewerTimestamp = locationTimestamp(selectedItem);

  if (selectedDeviceId && media.length === 0 && !selectedItem) {
    return <div className="p-4"><MediaSkeleton /></div>;
  }

  return (
    <div className="p-4 space-y-4">
      {selectedItem && !manageMode ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleClose} className="text-white/30 hover:text-white/60 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider font-bold flex-1 truncate">
              {selectedItem.type === 'photo' ? 'PHOTO' : 'AUDIO'} — {formatTimestamp(viewerTimestamp)}
            </span>
            {canManage && (
              <button onClick={() => { setDeletePassword(''); setDeleteError(''); setDeleteOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] border border-red-500/15 hover:border-red-500/30 transition-all">
                <Trash2 size={11} />
                DELETE
              </button>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            {itemData?.type === 'photo' && itemData?.data_b64 && (
              <img src={`data:image/jpeg;base64,${itemData.data_b64}`} alt="Captured photo" className="w-full h-auto" />
            )}
            {itemData?.type === 'audio' && itemData?.data_b64 && (
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                  <Music size={24} className="text-white/40" />
                </div>
                <button onClick={togglePlay}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-mono font-bold transition-all">
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                  {playing ? 'PAUSE' : 'PLAY'}
                </button>
                <audio ref={audioRef} src={`data:audio/mp4;base64,${itemData.data_b64}`} preload="auto"
                  onEnded={() => setPlaying(false)}
                  onError={() => { setPlaying(false); setPlayError('Playback failed — the audio file may be unsupported.'); }} />
                {playError && <div className="mt-3 text-[10px] font-mono text-red-400 animate-fade-in">{playError}</div>}
                <a href={`data:audio/mp4;base64,${itemData.data_b64}`} download={`evidence_${selectedItem.id}.m4a`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-white/30 hover:text-white/60 transition-colors">
                  <ChevronLeft size={11} className="rotate-90" />
                  DOWNLOAD FILE
                </a>
              </div>
            )}
            {!itemData && (
              <div className="p-8 text-center">
                <div className="text-white/20 text-xs font-mono">Loading...</div>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            {selectedItem.lat && selectedItem.lng && (
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-white/30 font-bold">Location</span>
                <span className="text-white/60 font-bold">{selectedItem.lat.toFixed(6)}, {selectedItem.lng.toFixed(6)}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/40 uppercase tracking-wider font-bold mb-3 px-1">
            <Camera size={12} className="text-white/25" />
            Captured Media
            {manageMode && (
              <span className="ml-auto flex items-center gap-1 text-white/25">
                <Lock size={9} />
                delete requires password
              </span>
            )}
            {canManage && !manageMode && (
              <button onClick={toggleManage}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15] text-[9px] font-mono font-bold transition-all">
                <Trash2 size={9} />
                MANAGE
              </button>
            )}
          </div>

          {deleted && (
            <div className="mb-2.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold animate-fade-in">
              <ShieldCheck size={11} />
              {deleted}
            </div>
          )}

          {media.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                <ImageOff size={22} className="text-white/10" />
              </div>
              <div className="text-white/40 text-sm font-bold mb-1">No media captured</div>
              <div className="text-white/20 text-xs font-mono leading-relaxed max-w-[220px] mx-auto">
                Use the <span className="text-white/40 font-bold">Commands</span> tab to capture photos and audio remotely.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {media.map((item) => {
                  const checked = selectedIds.has(item.id);
                  return (
                    <button key={item.id}
                      onClick={() => (manageMode ? toggleSelected(item.id) : handleSelect(item))}
                      className={cn(
                        'text-left rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 p-3 relative',
                        'bg-white/[0.02] hover:bg-white/[0.04]',
                        manageMode && checked && 'border-emerald-500/40 bg-emerald-500/[0.06]'
                      )}>
                      {manageMode && (
                        <span className={cn(
                          'absolute top-2 right-2 w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold transition-all',
                          checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/[0.15] text-transparent'
                        )}>✓</span>
                      )}
                      <div className="flex items-center justify-center h-16 mb-2 rounded-lg bg-white/[0.03]">
                        {item.type === 'photo' ? (
                          <Camera size={20} className="text-white/15" />
                        ) : (
                          <Music size={20} className="text-white/15" />
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-white/60 font-bold flex items-center gap-1.5">
                        <span>{item.type === 'photo' ? '📷' : '🎤'}</span>
                        {item.type.toUpperCase()}
                      </div>
                      <div className="font-mono text-[10px] text-white/25 mt-0.5 font-bold">
                        {formatTimestamp(locationTimestamp(item))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {manageMode && (
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => setSelectedIds(new Set(media.map((m) => m.id)))}
                    className="px-3 py-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white/60 text-[10px] font-mono font-bold transition-all">
                    Select all
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white/60 text-[10px] font-mono font-bold transition-all">
                    Clear
                  </button>
                  <button onClick={() => { setDeletePassword(''); setDeleteError(''); setDeleteOpen(true); }}
                    disabled={selectedIds.size === 0}
                    className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider transition-all">
                    <Trash2 size={11} />
                    Delete ({selectedIds.size})
                  </button>
                  <button onClick={toggleManage}
                    className="px-3 py-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-white/60 text-[10px] font-mono font-bold transition-all">
                    <X size={11} className="inline -mt-0.5 mr-1" />
                    Exit
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {deleteOpen && createPortal(
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteOpen(false)} />
          <div className="relative bg-[#111118] border border-white/[0.08] shadow-2xl w-full max-w-sm p-5 space-y-4 animate-fade-in rounded-2xl">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/[0.08] border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={14} className="text-red-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white/90 tracking-wide">DELETE MEDIA</div>
                <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em] font-bold mt-0.5">
                  {selectedIds.size > 0 ? `${selectedIds.size} item(s)` : '1 item'} · irreversible
                </div>
              </div>
              <button onClick={() => !deleting && setDeleteOpen(false)} className="ml-auto w-7 h-7 rounded-lg border border-white/[0.08] text-white/30 hover:text-white/60 flex items-center justify-center transition-all">
                <X size={13} />
              </button>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/15">
              <Lock size={12} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[10px] font-mono text-white/40 leading-relaxed">
                Deletions require a step-up password: <span className="font-bold text-white/60">{stepUpPasswordHint()}</span>.
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/35 font-bold mb-1 block">Password</label>
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDelete()} autoFocus aria-label="Password"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
                placeholder="Enter password" />
            </div>

            {deleteError && <div className="text-[10px] font-mono text-red-400 animate-fade-in">{deleteError}</div>}

            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting || !deletePassword}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider transition-all">
                <Trash2 size={11} />
                {deleting ? 'Deleting...' : 'Confirm delete'}
              </button>
              <button onClick={() => setDeleteOpen(false)} disabled={deleting}
                className="px-3 py-2 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 text-[10px] font-mono font-bold transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
