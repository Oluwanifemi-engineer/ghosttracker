# Magneetar Product Demo — Screen Recording Guide

## Overview

This guide walks you through recording a 30-second product demo video
for the landing page `VideoDemo` component. The video shows the command
center in action: tracking a device, detecting theft, and executing
remote commands.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Device** | Android phone with Magneetar installed (D1 or D2) |
| **Dashboard** | Open `https://magneetar.me` in Chrome on a laptop |
| **Screen recorder** | OBS Studio (free) or built-in OS recorder |
| **Resolution** | 1920×1080 (Full HD) |
| **Frame rate** | 30 fps |
| **Audio** | None (mute system audio) |

---

## Recording Script (30 seconds)

### Scene 1: Dashboard Overview (0:00 – 0:05)
1. Open the Magneetar dashboard in Chrome
2. Show the full dashboard with map, sidebar, and panels
3. Mouse hovers over the device in the sidebar (Galaxy A03s)
4. **No interaction** — just show the live dashboard

### Scene 2: Real-time Tracking (0:05 – 0:12)
1. Click on the device in the sidebar
2. Map zooms to the device location
3. Show the GPS trail (multiple location points)
4. Show the battery indicator and signal strength
5. Point out the "3s ago" timestamp updating

### Scene 3: Sentinel AI Detection (0:12 – 0:18)
1. Click the "Sentinel" tab in the right panel
2. Show the theft score (animated bar)
3. Show the signal breakdown (SIM, location, battery, etc.)
4. Point out the "SAFE" → "ELEVATED" transition if possible

### Scene 4: Remote Command (0:18 – 0:25)
1. Click the "Commands" tab
2. Click "Lock Screen" button
3. Show the confirmation dialog
4. Click "Execute" — show the command status changing to "DELIVERED"
5. (Optional) Show the device screen locking

### Scene 5: Evidence Capture (0:25 – 0:30)
1. Click "Capture Photo" in the commands panel
2. Show the camera burst indicator
3. Show the evidence appearing in the media gallery
4. End with the dashboard in its final state

---

## OBS Studio Settings

```
Settings → Video:
  Base Canvas: 1920x1080
  Output Canvas: 1920x1080
  FPS: 30

Settings → Output:
  Encoder: x264 (or NVENC if available)
  Rate Control: CBR
  Bitrate: 8000 Kbps
  Keyframe Interval: 2 seconds

Settings → Audio:
  Sample Rate: 44.1 kHz
  Channels: Stereo
  Desktop Audio: Muted
  Mic/Aux: Muted

Scene Setup:
  - Add "Window Capture" → select Chrome
  - OR add "Display Capture" → select your monitor
  - Crop to dashboard area if needed
```

---

## Post-Production

### Recommended Edits (in CapCut, DaVinci Resolve, or iMovie)
1. **Trim** to exactly 30 seconds
2. **Add subtle zoom** on key moments (Sentinel score, lock command)
3. **Speed ramp** the map zoom (0:05-0:07) to 1.5x
4. **Add text overlays** at each scene transition:
   - "Real-time Tracking" (0:05)
   - "Sentinel AI Detection" (0:12)
   - "Remote Commands" (0:18)
   - "Evidence Capture" (0:25)
5. **Export** as MP4, H.264, 1080p, 30fps
6. **Target size**: < 10MB for fast loading

### Upload
1. Upload to YouTube (unlisted) or Loom
2. Copy the embed URL
3. Set `DEMO_VIDEO_URL` in `dashboard/src/components/landing/VideoDemo.tsx`:
   ```typescript
   const DEMO_VIDEO_URL = 'https://www.youtube.com/watch?v=XXXXX';
   ```
4. Rebuild and deploy

---

## Quick Test Recording Checklist

- [ ] Dashboard is fully loaded (all panels visible)
- [ ] Device is online (green dot in sidebar)
- [ ] Map shows location markers
- [ ] Sentinel score is visible (not 0)
- [ ] No error panels or empty states
- [ ] Browser zoom is 100%
- [ ] No bookmarks bar or dev tools visible
- [ ] Screen recording is started
- [ ] 30 seconds captured
- [ ] Video exported as 1080p MP4

---

## Fallback: Animated GIF

If video upload isn't possible, create an animated GIF:

1. Use [ScreenToGif](https://www.screentogif.com/) (Windows) or
   [GIPHY Capture](https://giphy.com/apps/giphycapture) (Mac)
2. Record 10 seconds of the map tracking view
3. Export as GIF, < 5MB
4. Use as a fallback in the `VideoDemo` component
