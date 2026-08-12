#!/usr/bin/env python3
"""Generate Play Store listing assets (feature graphic + icon) on-brand."""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUA = (6, 182, 212)       # #06B6D4
EMERALD = (16, 185, 129)   # #10B981
WHITE = (255, 255, 255)
SOFT = (178, 231, 240)     # soft aqua for secondary text
DARK = (17, 24, 39)        # #111827

FD = "/usr/share/fonts/truetype/dejavu"


def F(name, size):
    return ImageFont.truetype(f"{FD}/{name}", size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def diagonal_gradient(w, h, c1, c2):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t0 = y / h
        for x in range(w):
            t = (t0 + x / w) / 2
            px[x, y] = lerp(c1, c2, t)
    return img


def draw_m_logo(draw, cx, cy, size, color, width, joint="curve"):
    s = size
    pts = [
        (cx - s, cy + s), (cx - s, cy - s), (cx - s * 0.25, cy - s * 0.10),
        (cx, cy + s * 0.15), (cx + s * 0.25, cy - s * 0.10),
        (cx + s, cy - s), (cx + s, cy + s),
    ]
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width, joint=joint)


def make_icon(path, size=512):
    """Dark rounded square, aqua ring, white M with aqua→emerald stroke."""
    pad = int(size * 0.10)
    img = Image.new("RGB", (size, size), DARK)
    # rounded mask
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size, size], radius=int(size * 0.22), fill=255)
    # subtle gradient fill inside
    grad = diagonal_gradient(size, size, (4, 30, 46), (7, 62, 54))
    img = Image.composite(grad, img, mask)

    d = ImageDraw.Draw(img)
    # aqua ring circle
    cx = cy = size / 2
    r = size / 2 - pad
    ring = int(size * 0.055)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=AQUA, width=ring)
    # white M
    msize = r * 0.52
    stroke = max(int(size * 0.045), 8)
    draw_m_logo(d, cx, cy, msize, WHITE, stroke)
    # small emerald accent dot (bottom right of ring)
    ad = size * 0.12
    d.ellipse([cx + r - ad - ring, cy + r - ad - ring, cx + r - ring, cy + r - ring],
              fill=EMERALD)
    img.save(path)
    print("wrote", path, img.size)


def make_feature(path, w=1024, h=500):
    img = diagonal_gradient(w, h, (4, 30, 46), (7, 62, 54))
    # soft radial glow behind logo area
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([70 - 260, 90 - 260, 70 + 620, 90 + 620], fill=80)
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    tint = Image.new("RGB", (w, h), AQUA)
    img = Image.composite(Image.blend(img, tint, 0.18), img, glow)

    d = ImageDraw.Draw(img)

    # ---------- LEFT: logo + wordmark ----------
    logo_cx, logo_cy, logo_s = 190, 190, 96
    draw_m_logo(d, logo_cx, logo_cy, logo_s, WHITE, 18)

    wm_font = F("DejaVuSans-Bold.ttf", 72)
    wm = "Magneetar"
    d.text((72, 320), wm, font=wm_font, fill=WHITE)

    tag_font = F("DejaVuSans-Bold.ttf", 22)
    tag = "ANTI-THEFT TRACKING & RECOVERY"
    d.text((76, 414), tag, font=tag_font, fill=AQUA)

    # ---------- RIGHT: feature bullets (fixed rows, measured) ----------
    bullets = [
        "Live GPS tracking",
        "Stealth photo capture",
        "One-tap lock & alarm",
        "SIM-change detection",
        "Remote data wipe",
    ]
    b_font = F("DejaVuSans-Bold.ttf", 30)
    x0, y0, row = 560, 128, 72
    max_w = 0
    for i, b in enumerate(bullets):
        y = y0 + i * row
        # aqua diamond marker
        rad = 8
        m = 0.707 * rad
        d.polygon(
            [(x0, y + rad), (x0 + m, y + m), (x0 + rad, y),
             (x0 + m, y - m), (x0, y - rad), (x0 - m, y - m),
             (x0 - rad, y), (x0 - m, y + m)],
            fill=AQUA,
        )
        tw = d.textlength(b, font=b_font)
        max_w = max(max_w, tw)
        d.text((x0 + 34, y - 20), b, font=b_font, fill=WHITE)

    # right column must fit within w
    assert x0 + 34 + max_w < w - 24, f"bullets overflow: {max_w}px"
    # no vertical overlap with tagline (tagline bottom ~446)
    assert y0 + (len(bullets) - 1) * row + 20 <= h - 20

    # bottom-right small print
    sp = F("DejaVuSans.ttf", 17)
    d.text((w - 360, h - 34), "Personal anti-theft protection", font=sp, fill=SOFT)

    img.save(path)
    print("wrote", path, img.size)


OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "play-assets")
os.makedirs(OUT, exist_ok=True)
make_feature(os.path.join(OUT, "feature-graphic-1024x500.png"))
make_icon(os.path.join(OUT, "icon-512.png"))
print("done")
