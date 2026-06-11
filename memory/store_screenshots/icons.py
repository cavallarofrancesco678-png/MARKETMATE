"""
MarketMate — Vector Icons Library for PIL
═══════════════════════════════════════════════════════════════
Set di icone minimal/vector disegnate in PIL invece di emoji,
così evitiamo dipendenze da NotoColorEmoji (problemi PIL/freetype).

Ogni funzione accetta (draw, cx, cy, size, color) e disegna l'icona
centrata nel punto (cx, cy) con dimensione `size` (lato del quadrato).
"""
from PIL import ImageDraw

def _pad(cx, cy, size, frac=0.1):
    """Return (x0,y0,x1,y1) bounding box with inner padding."""
    half = size // 2
    p = int(size * frac)
    return (cx - half + p, cy - half + p, cx + half - p, cy + half - p)

def home(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.05)
    w = x1 - x0
    h = y1 - y0
    # roof triangle
    d.polygon([(cx, y0), (x0, y0 + int(h * 0.45)), (x1, y0 + int(h * 0.45))], fill=color)
    # body
    bx0 = x0 + int(w * 0.12)
    bx1 = x1 - int(w * 0.12)
    by0 = y0 + int(h * 0.45)
    d.rectangle((bx0, by0, bx1, y1), fill=color)
    # door
    dw = int(w * 0.18)
    dx0 = cx - dw // 2
    d.rectangle((dx0, y1 - int(h * 0.35), dx0 + dw, y1), fill=(255, 255, 255))

def chart(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    # 3 bars
    bw = (x1 - x0) // 4
    gap = bw // 2
    base = y1
    heights = [0.45, 0.75, 0.55, 0.9]
    bx = x0
    for hf in heights:
        bh = int((y1 - y0) * hf)
        d.rounded_rectangle((bx, base - bh, bx + bw, base), radius=4, fill=color)
        bx += bw + gap

def users(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.05)
    w = x1 - x0
    h = y1 - y0
    # main head
    r = w // 6
    head_y = y0 + int(h * 0.25)
    d.ellipse((cx - r, head_y - r, cx + r, head_y + r), fill=color)
    # main body (rounded)
    by0 = head_y + r + 4
    d.rounded_rectangle((cx - int(w * 0.30), by0, cx + int(w * 0.30), y1 - int(h * 0.05)),
                        radius=r, fill=color)
    # second person behind (smaller)
    r2 = int(r * 0.75)
    hx = cx + int(w * 0.30)
    d.ellipse((hx - r2, head_y - r2 + 2, hx + r2, head_y + r2 + 2), fill=color)

def settings(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.1)
    r_out = (x1 - x0) // 2
    r_in = int(r_out * 0.45)
    # gear (8 teeth)
    import math
    teeth = 8
    pts = []
    for i in range(teeth * 2):
        ang = 2 * math.pi * i / (teeth * 2)
        rr = r_out if i % 2 == 0 else int(r_out * 0.78)
        pts.append((cx + int(rr * math.cos(ang)), cy + int(rr * math.sin(ang))))
    d.polygon(pts, fill=color)
    d.ellipse((cx - r_in, cy - r_in, cx + r_in, cy + r_in), fill=(255, 255, 255))

def plus(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.05)
    bw = (x1 - x0) // 6
    # horizontal
    d.rounded_rectangle((x0, cy - bw // 2, x1, cy + bw // 2), radius=bw // 2, fill=color)
    # vertical
    d.rounded_rectangle((cx - bw // 2, y0, cx + bw // 2, y1), radius=bw // 2, fill=color)

def cart(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    w = x1 - x0
    h = y1 - y0
    # basket trapezoid
    d.polygon([(x0 + int(w * 0.15), y0 + int(h * 0.30)),
               (x1, y0 + int(h * 0.30)),
               (x1 - int(w * 0.12), y0 + int(h * 0.65)),
               (x0 + int(w * 0.25), y0 + int(h * 0.65))], fill=color)
    # handle line
    d.line([(x0, y0 + int(h * 0.20)), (x0 + int(w * 0.18), y0 + int(h * 0.30))],
           fill=color, width=max(3, w // 18))
    # wheels
    r = w // 12
    d.ellipse((x0 + int(w * 0.30) - r, y1 - r * 2, x0 + int(w * 0.30) + r, y1), fill=color)
    d.ellipse((x1 - int(w * 0.25) - r, y1 - r * 2, x1 - int(w * 0.25) + r, y1), fill=color)

def search(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    r = (x1 - x0) // 3
    sx, sy = x0 + r + 2, y0 + r + 2
    d.ellipse((sx - r, sy - r, sx + r, sy + r), outline=color, width=max(3, size // 16))
    # handle
    d.line([(sx + int(r * 0.7), sy + int(r * 0.7)), (x1, y1)],
           fill=color, width=max(3, size // 14))

def lock(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.05)
    w = x1 - x0
    h = y1 - y0
    # shackle (semicircle)
    sh_w = int(w * 0.55)
    sh_h = int(h * 0.45)
    sh_x = cx - sh_w // 2
    sh_y = y0
    d.arc((sh_x, sh_y, sh_x + sh_w, sh_y + sh_h * 2),
          start=180, end=0, fill=color, width=max(4, w // 12))
    # body
    by0 = y0 + sh_h
    d.rounded_rectangle((cx - int(w * 0.40), by0, cx + int(w * 0.40), y1),
                        radius=max(6, w // 18), fill=color)
    # keyhole
    r = w // 14
    d.ellipse((cx - r, by0 + int(h * 0.18), cx + r, by0 + int(h * 0.18) + r * 2), fill=(255, 255, 255))

def cloud(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.05)
    w = x1 - x0
    h = y1 - y0
    # cluster of overlapping circles forming a cloud
    base_y = y0 + int(h * 0.65)
    # bottom rect
    d.rounded_rectangle((x0 + int(w * 0.10), base_y, x1 - int(w * 0.10), y1 - int(h * 0.10)),
                        radius=int(h * 0.18), fill=color)
    # circles
    r1 = int(w * 0.22)
    d.ellipse((x0 + int(w * 0.05), y0 + int(h * 0.30), x0 + int(w * 0.05) + r1 * 2, y0 + int(h * 0.30) + r1 * 2), fill=color)
    r2 = int(w * 0.28)
    d.ellipse((cx - r2, y0 + int(h * 0.10), cx + r2, y0 + int(h * 0.10) + r2 * 2), fill=color)
    r3 = int(w * 0.20)
    d.ellipse((x1 - int(w * 0.05) - r3 * 2, y0 + int(h * 0.30), x1 - int(w * 0.05), y0 + int(h * 0.30) + r3 * 2), fill=color)

def shield(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    w = x1 - x0
    h = y1 - y0
    pts = [
        (cx, y0),
        (x1, y0 + int(h * 0.18)),
        (x1 - int(w * 0.05), y0 + int(h * 0.60)),
        (cx, y1),
        (x0 + int(w * 0.05), y0 + int(h * 0.60)),
        (x0, y0 + int(h * 0.18)),
    ]
    d.polygon(pts, fill=color)
    # checkmark inside
    cm_color = (255, 255, 255)
    d.line([(cx - int(w * 0.18), cy), (cx - int(w * 0.05), cy + int(h * 0.15)),
            (cx + int(w * 0.22), cy - int(h * 0.15))],
           fill=cm_color, width=max(4, w // 14))

def trash(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.10)
    w = x1 - x0
    h = y1 - y0
    # lid
    d.rounded_rectangle((x0, y0 + int(h * 0.15), x1, y0 + int(h * 0.25)), radius=3, fill=color)
    # handle on top
    d.rounded_rectangle((cx - int(w * 0.16), y0, cx + int(w * 0.16), y0 + int(h * 0.18)),
                        radius=3, outline=color, width=max(3, w // 16))
    # body
    d.rounded_rectangle((x0 + int(w * 0.06), y0 + int(h * 0.25), x1 - int(w * 0.06), y1),
                        radius=8, fill=color)
    # vertical lines (white)
    for i in (-1, 0, 1):
        lx = cx + i * int(w * 0.14)
        d.line([(lx, y0 + int(h * 0.40)), (lx, y1 - int(h * 0.10))],
               fill=(255, 255, 255), width=max(2, w // 22))

def robot(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.05)
    w = x1 - x0
    h = y1 - y0
    # antenna
    d.line([(cx, y0), (cx, y0 + int(h * 0.08))], fill=color, width=max(3, w // 18))
    d.ellipse((cx - 6, y0 - 6, cx + 6, y0 + 6), fill=color)
    # head (rounded square)
    head_top = y0 + int(h * 0.10)
    head_bot = y0 + int(h * 0.60)
    d.rounded_rectangle((x0 + int(w * 0.10), head_top, x1 - int(w * 0.10), head_bot),
                        radius=int(w * 0.10), fill=color)
    # eyes (white)
    er = w // 12
    d.ellipse((cx - int(w * 0.22) - er, cy - er - int(h * 0.05),
               cx - int(w * 0.22) + er, cy + er - int(h * 0.05)), fill=(255, 255, 255))
    d.ellipse((cx + int(w * 0.22) - er, cy - er - int(h * 0.05),
               cx + int(w * 0.22) + er, cy + er - int(h * 0.05)), fill=(255, 255, 255))
    # smile
    d.rounded_rectangle((cx - int(w * 0.15), cy + int(h * 0.05),
                         cx + int(w * 0.15), cy + int(h * 0.12)), radius=3, fill=(255, 255, 255))
    # body
    d.rounded_rectangle((x0 + int(w * 0.20), head_bot + 4, x1 - int(w * 0.20), y1),
                        radius=int(w * 0.06), fill=color)

def crown(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.06)
    w = x1 - x0
    h = y1 - y0
    # base
    d.rectangle((x0, y0 + int(h * 0.62), x1, y1 - int(h * 0.08)), fill=color)
    # pointed top with 3 peaks
    mid = y0 + int(h * 0.62)
    pts = [
        (x0, mid),
        (x0 + int(w * 0.15), y0 + int(h * 0.15)),
        (x0 + int(w * 0.32), mid - int(h * 0.05)),
        (cx, y0),
        (x1 - int(w * 0.32), mid - int(h * 0.05)),
        (x1 - int(w * 0.15), y0 + int(h * 0.15)),
        (x1, mid),
    ]
    d.polygon(pts, fill=color)
    # 3 gems
    r = w // 14
    for ratio in (0.18, 0.50, 0.82):
        gx = x0 + int(w * ratio)
        gy = y0 + int(h * 0.78)
        d.ellipse((gx - r, gy - r, gx + r, gy + r), fill=(255, 255, 255))

def calendar(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    w = x1 - x0
    h = y1 - y0
    # top hooks
    d.rounded_rectangle((x0 + int(w * 0.12), y0, x0 + int(w * 0.22), y0 + int(h * 0.18)),
                        radius=4, fill=color)
    d.rounded_rectangle((x1 - int(w * 0.22), y0, x1 - int(w * 0.12), y0 + int(h * 0.18)),
                        radius=4, fill=color)
    # body
    d.rounded_rectangle((x0, y0 + int(h * 0.10), x1, y1),
                        radius=int(w * 0.08), fill=color, outline=color)
    # white interior
    d.rectangle((x0 + int(w * 0.08), y0 + int(h * 0.30), x1 - int(w * 0.08), y1 - int(h * 0.10)),
                fill=(255, 255, 255))
    # grid dots
    for row in range(3):
        for col in range(4):
            dx = x0 + int(w * 0.15) + col * int(w * 0.18)
            dy = y0 + int(h * 0.40) + row * int(h * 0.18)
            rr = max(3, w // 26)
            d.ellipse((dx - rr, dy - rr, dx + rr, dy + rr), fill=color)

def briefcase(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    w = x1 - x0
    h = y1 - y0
    # handle
    hw = int(w * 0.32)
    hh = int(h * 0.18)
    d.rounded_rectangle((cx - hw, y0, cx + hw, y0 + hh),
                        radius=hh // 2, outline=color, width=max(3, w // 18))
    # body
    d.rounded_rectangle((x0, y0 + int(h * 0.18), x1, y1),
                        radius=int(w * 0.08), fill=color)
    # buckle (white line)
    d.line([(x0 + int(w * 0.05), y0 + int(h * 0.55)),
            (x1 - int(w * 0.05), y0 + int(h * 0.55))],
           fill=(255, 255, 255), width=max(3, w // 22))

def target(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.06)
    w = x1 - x0
    r_max = w // 2
    d.ellipse((cx - r_max, cy - r_max, cx + r_max, cy + r_max), outline=color, width=max(4, w // 14))
    d.ellipse((cx - int(r_max * 0.66), cy - int(r_max * 0.66),
               cx + int(r_max * 0.66), cy + int(r_max * 0.66)),
              outline=color, width=max(4, w // 14))
    d.ellipse((cx - int(r_max * 0.30), cy - int(r_max * 0.30),
               cx + int(r_max * 0.30), cy + int(r_max * 0.30)), fill=color)

def send(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    w = x1 - x0
    h = y1 - y0
    # paper plane (triangle)
    d.polygon([(x0, y0 + int(h * 0.40)),
               (x1, cy),
               (x0, y1 - int(h * 0.20)),
               (x0 + int(w * 0.32), cy)], fill=color)
    d.polygon([(x0 + int(w * 0.32), cy),
               (x0, y1 - int(h * 0.20)),
               (x0 + int(w * 0.20), y1 - int(h * 0.05))], fill=(255, 255, 255, 80))

def euro(d, cx, cy, size, color):
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.10)
    w = x1 - x0
    r = w // 2
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    # E inside (white)
    d.text  # placeholder if needed
    # draw € by lines
    er = int(r * 0.55)
    cx2 = cx - int(r * 0.15)
    d.arc((cx2 - er, cy - er, cx2 + er, cy + er),
          start=30, end=330, fill=(255, 255, 255), width=max(4, w // 14))
    # cross bars
    d.line([(cx2 - er, cy - int(er * 0.25)), (cx2 + int(er * 0.4), cy - int(er * 0.25))],
           fill=(255, 255, 255), width=max(3, w // 18))
    d.line([(cx2 - er, cy + int(er * 0.10)), (cx2 + int(er * 0.4), cy + int(er * 0.10))],
           fill=(255, 255, 255), width=max(3, w // 18))

def pin(d, cx, cy, size, color):
    """Numeric keypad icon."""
    x0, y0, x1, y1 = _pad(cx, cy, size, 0.08)
    w = x1 - x0
    h = y1 - y0
    dot_r = max(3, w // 14)
    for row in range(3):
        for col in range(3):
            dx = x0 + int(w * 0.18) + col * int(w * 0.30)
            dy = y0 + int(h * 0.15) + row * int(h * 0.28)
            d.ellipse((dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r), fill=color)
