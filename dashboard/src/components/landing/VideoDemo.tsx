'use client';

import { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

/**
 * VideoDemo — embeds a product demo video with a cinematic overlay.
 *
 * Placeholders are shown until a real video URL is configured.
 * Supports YouTube, Loom, and direct MP4 URLs.
 */

const DEMO_VIDEO_URL = ''; // Set to YouTube/Loom URL when available
const DEMO_THUMBNAIL = '/magneetar-mhalf.svg';

export function VideoDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // If no video URL configured, show a cinematic placeholder
  if (!DEMO_VIDEO_URL) {
    return (
      <section className="py-20 sm:py-28 bg-black relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 mb-5">
              <Play size={10} className="text-emerald-400" />
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400">WATCH THE DEMO</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white mb-4">
              See Magneetar in 30 seconds.
            </h2>
            <p className="text-gray-400 text-base max-w-lg mx-auto">
              From installation to theft detection — watch how the command center
              protects your device in real time.
            </p>
          </div>

          {/* Video player frame */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-800 group">
            {/* Cinematic letterbox frame */}
            <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
              {/* Animated background grid */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-transparent to-blue-900/20" />

              {/* Center logo + play button */}
              <div className="relative z-10 flex flex-col items-center gap-6">
                {/* Logo */}
                <div className="relative">
                  <img
                    src={DEMO_THUMBNAIL}
                    alt="Magneetar"
                    className="w-20 h-20 rounded-2xl opacity-60"
                  />
                  <div className="absolute -inset-1 rounded-2xl border border-white/5" />
                </div>

                {/* Play button */}
                <button
                  className="group/play relative"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label="Play demo video"
                >
                  {/* Outer ring */}
                  <div className="absolute -inset-4 rounded-full border border-white/10 group-hover/play:border-white/20 transition-colors" />
                  {/* Pulsing ring */}
                  <div className="absolute -inset-6 rounded-full border border-white/5 animate-ping" />
                  {/* Button */}
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover/play:bg-white/20 transition-all duration-300 group-hover/play:scale-110">
                    <Play size={24} className="text-white ml-1" fill="white" />
                  </div>
                </button>

                {/* Duration badge */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-gray-400 tracking-wider">30 SEC DEMO</span>
                </div>
              </div>

              {/* Corner decorations — tactical feel */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/10 rounded-tl" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/10 rounded-tr" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/10 rounded-bl" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/10 rounded-br" />
            </div>

            {/* Bottom controls bar (mockup) */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-800/80 border-t border-gray-700/50">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>

              {/* Progress bar */}
              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-emerald-500 rounded-full" />
              </div>

              <span className="text-[10px] font-mono text-gray-500">0:00 / 0:30</span>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>

              <button className="text-gray-500 hover:text-gray-300 transition-colors">
                <Maximize size={12} />
              </button>
            </div>
          </div>

          {/* Below-video trust indicators */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {[
              { label: 'SHA-256 signed', icon: '🔐' },
              { label: 'End-to-end encrypted', icon: '🛡️' },
              { label: 'Open source', icon: '📂' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="text-xs">{item.icon}</span>
                <span className="text-[10px] font-mono text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // When a real video URL is provided, render the actual embed
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('/').pop()?.split('?')[0]
        : new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1`;
    }
    if (url.includes('loom.com')) {
      return `${url}/embed`;
    }
    return url;
  };

  return (
    <section className="py-20 sm:py-28 bg-black relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 mb-5">
            <Play size={10} className="text-emerald-400" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400">WATCH THE DEMO</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white mb-4">
            See Magneetar in 30 seconds.
          </h2>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
          <div className="aspect-video">
            <iframe
              src={getEmbedUrl(DEMO_VIDEO_URL)}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Magneetar Product Demo"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
