"""
MarketMate — Store Screenshots Generator (v2 with vector icons)
═══════════════════════════════════════════════════════════════
Sostituisce gli emoji con icone vettoriali disegnate in PIL.
Output:
  /app/memory/store_screenshots/ios/01..05.png     (1290 × 2796)
  /app/memory/store_screenshots/android/01..08.png (1080 × 2400)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import icons as IC

OUT_IOS = "/app/memory/store_screenshots/ios"
OUT_AND = "/app/memory/store_screenshots/android"
os.makedirs(OUT_IOS, exist_ok=True)
os.makedirs(OUT_AND, exist_ok=True)

BRAND = (14, 90, 74)
BRAND_LIGHT = (216, 237, 229)
BRAND_ACCENT = (242, 180, 90)
LIGHT = (245, 247, 248)
TEXT_DARK = (24, 38, 36)
TEXT_LIGHT = (255, 255, 255)
MUTED = (124, 138, 134)
DANGER = (208, 78, 78)
SUCCESS = (76, 175, 124)

def font(size, bold=False):
    p = "/usr/share/fonts/truetype/liberation/" + (
        "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf"
    )
    return ImageFont.truetype(p, size)

SCREENS = [
    {"headline": "Gestisci la giornata\nin 1 tap",
     "subtitle": "Incassi, spese e fornitori\nsotto controllo, sempre.",
     "kind": "home"},
    {"headline": "Il tuo netto,\nsempre chiaro",
     "subtitle": "Grafici e statistiche\nche parlano la tua lingua.",
     "kind": "stats"},
    {"headline": "Tutti i fornitori\nin tasca",
     "subtitle": "Storico ordini, contatti\ne saldi in tempo reale.",
     "kind": "fornitori"},
    {"headline": "Spese ripartite\nsenza calcoli",
     "subtitle": "Suddivisione automatica\ntra giornate e mercati.",
     "kind": "spese"},
    {"headline": "L'AI fa i conti\nper te",
     "subtitle": "Chiedi, calcola, archivia.\nIn italiano.",
     "kind": "ai"},
    {"headline": "Pianifica\nla stagione",
     "subtitle": "Calendario fiere e mercati\nin un solo colpo d'occhio.",
     "kind": "calendar"},
    {"headline": "I tuoi dati\nal sicuro",
     "subtitle": "PIN, Cloud Sync\ne GDPR by design.",
     "kind": "security"},
    {"headline": "Sblocca\nMarketMate Pro",
     "subtitle": "Cloud Sync illimitato,\nAI senza limiti, multi-device.",
     "kind": "premium"},
]

# ── HELPERS ─────────────────────────────────────────────────
def vert_gradient(size, c1, c2):
    w, h = size
    base = Image.new("RGB", size, c1)
    top = Image.new("RGB", size, c2)
    mask = Image.new("L", size)
    md = mask.load()
    for y in range(h):
        v = int(255 * (y / max(1, h - 1)))
        for x in range(w):
            md[x, y] = v
    base.paste(top, (0, 0), mask)
    return base

def round_rect(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def signal_bars(d, x, y, color):
    """iOS-style signal bars."""
    for i, h in enumerate([6, 10, 14, 18]):
        bx = x + i * 6
        d.rounded_rectangle((bx, y + 18 - h, bx + 4, y + 18), radius=1, fill=color)

def battery(d, x, y, color):
    d.rounded_rectangle((x, y, x + 50, y + 20), radius=4, outline=color, width=2)
    d.rounded_rectangle((x + 4, y + 4, x + 42, y + 16), radius=1, fill=color)
    d.rectangle((x + 50, y + 6, x + 55, y + 14), fill=color)

def status_bar(d, w, color=TEXT_DARK):
    d.text((40, 12), "9:41", font=font(28, bold=True), fill=color)
    # right side: signal + wifi + battery
    signal_bars(d, w - 220, 14, color)
    # wifi (3 arcs)
    wx, wy = w - 160, 22
    for i, r in enumerate([14, 9, 4]):
        d.arc((wx - r, wy - r, wx + r, wy + r), start=210, end=330, fill=color, width=3)
    d.ellipse((wx - 3, wy - 3, wx + 3, wy + 3), fill=color)
    battery(d, w - 100, 12, color)

# ── DEVICE FRAME ────────────────────────────────────────────
def make_device_frame(content, fw, fh, pad=22, radius=72):
    canvas = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((0, 0, fw, fh), radius=radius, fill=(20, 26, 32, 255))
    inner = (pad, pad, fw - pad, fh - pad)
    ir = max(8, radius - pad)
    cw = inner[2] - inner[0]
    ch = inner[3] - inner[1]
    c = content.resize((cw, ch))
    if c.mode != "RGBA":
        c = c.convert("RGBA")
    mask = Image.new("L", (cw, ch), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, cw, ch), radius=ir, fill=255)
    canvas.paste(c, (inner[0], inner[1]), mask)
    # dynamic island
    nd = ImageDraw.Draw(canvas)
    nw = int(fw * 0.32)
    nh = int(fh * 0.020)
    nx = (fw - nw) // 2
    ny = pad + 14
    nd.rounded_rectangle((nx, ny, nx + nw, ny + nh), radius=nh // 2, fill=(8, 12, 16, 255))
    return canvas

# ═══════════════════════════════════════════════════════════
# MOCK UI
# ═══════════════════════════════════════════════════════════

def mock_home(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    # header
    d.rectangle((0, 80, w, 240), fill=BRAND_LIGHT)
    d.text((40, 110), "Buongiorno, Antonio", font=font(34, bold=True), fill=TEXT_DARK)
    d.text((40, 170), "Mercoledì 12 giugno", font=font(24), fill=MUTED)

    # Today big card
    round_rect(d, (40, 280, w - 40, 580), 28, fill=BRAND)
    d.text((70, 310), "OGGI", font=font(22, bold=True), fill=(220, 240, 234))
    d.text((70, 350), "€ 487,50", font=font(72, bold=True), fill=TEXT_LIGHT)
    d.text((70, 440), "Incasso netto", font=font(24), fill=(220, 240, 234))
    d.text((70, 490), "+ 18% vs ieri", font=font(22, bold=True), fill=(180, 240, 200))
    # green pulse
    d.ellipse((w - 130, 320, w - 80, 370), fill=(180, 240, 200))
    d.ellipse((w - 120, 330, w - 90, 360), fill=BRAND_ACCENT)

    # Action quick row
    actions = [(IC.plus, "Nuova\ngiornata"), (IC.cart, "Spesa"),
               (IC.users, "Fornitori"), (IC.chart, "Stats")]
    ax = 40
    aw = (w - 80 - 30) // 4
    ay = 620
    for icon_fn, label in actions:
        round_rect(d, (ax, ay, ax + aw, ay + aw), 22, fill="white", outline=(232, 234, 236), width=2)
        icon_fn(d, ax + aw // 2, ay + aw // 2 - 30, int(aw * 0.55), BRAND)
        # multi-line label
        lines = label.split("\n")
        ly = ay + aw // 2 + 35
        for ln in lines:
            d.text((ax + aw // 2, ly), ln, font=font(18, bold=True), fill=TEXT_DARK, anchor="mm")
            ly += 22
        ax += aw + 10

    # day list header
    list_y = ay + aw + 50
    d.text((40, list_y), "Ultime giornate", font=font(28, bold=True), fill=TEXT_DARK)
    items = [
        ("LUN 10", "Loreto Aprutino", "€ 312,00", SUCCESS),
        ("SAB 8", "Penne", "€ 580,40", SUCCESS),
        ("GIO 6", "Pescara", "€ 145,00", DANGER),
    ]
    iy = list_y + 60
    for day, place, amt, col in items:
        round_rect(d, (40, iy, w - 40, iy + 110), 18, fill="white", outline=(235, 238, 240), width=2)
        # left date pill
        round_rect(d, (60, iy + 22, 200, iy + 88), 14, fill=BRAND_LIGHT)
        d.text((130, iy + 55), day, font=font(22, bold=True), fill=BRAND, anchor="mm")
        d.text((230, iy + 30), place, font=font(28, bold=True), fill=TEXT_DARK)
        d.text((230, iy + 70), "Incasso netto", font=font(20), fill=MUTED)
        d.text((w - 70, iy + 55), amt, font=font(28, bold=True), fill=col, anchor="rm")
        iy += 130

    # bottom tabs
    d.rectangle((0, h - 130, w, h), fill="white")
    d.line((0, h - 130, w, h - 130), fill=(230, 232, 234), width=2)
    tabs = [(IC.home, True), (IC.chart, False), (IC.users, False), (IC.settings, False)]
    tw = w // 4
    for i, (icon_fn, active) in enumerate(tabs):
        col = BRAND if active else MUTED
        icon_fn(d, tw * i + tw // 2, h - 70, 56, col)
    return img


def mock_stats(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    d.text((40, 90), "Statistiche", font=font(40, bold=True), fill=TEXT_DARK)
    d.text((40, 145), "Giugno 2026", font=font(24), fill=MUTED)

    cards = [
        ("INCASSO", "€ 8.420", SUCCESS),
        ("SPESE", "€ 3.180", DANGER),
        ("NETTO", "€ 5.240", BRAND),
        ("MARGINE", "62%", BRAND_ACCENT),
    ]
    cy = 200
    for i, (lbl, val, col) in enumerate(cards):
        cx = 40 + (i % 2) * ((w - 80) // 2 + 20)
        cyy = cy + (i // 2) * 200
        cw = (w - 100) // 2
        round_rect(d, (cx, cyy, cx + cw, cyy + 180), 22, fill="white", outline=(232, 234, 236), width=2)
        d.text((cx + 30, cyy + 30), lbl, font=font(20, bold=True), fill=MUTED)
        d.text((cx + 30, cyy + 70), val, font=font(48, bold=True), fill=col)
        # tiny trend arrow
        if lbl in ("INCASSO", "NETTO"):
            ax_, ay_ = cx + cw - 60, cyy + 50
            d.polygon([(ax_, ay_ + 20), (ax_ + 18, ay_ - 5), (ax_ + 36, ay_ + 20)], fill=SUCCESS)

    chart_y = 620
    round_rect(d, (40, chart_y, w - 40, chart_y + 720), 22, fill="white", outline=(232, 234, 236), width=2)
    d.text((70, chart_y + 30), "Andamento settimanale", font=font(26, bold=True), fill=TEXT_DARK)
    bars = [320, 480, 290, 560, 620, 410, 540]
    days = ["L", "M", "M", "G", "V", "S", "D"]
    bx = 80
    bar_w = (w - 220) // 7
    max_h = 460
    max_v = max(bars)
    for i, v in enumerate(bars):
        bh = int((v / max_v) * max_h)
        bxc = bx + i * (bar_w + 18)
        col = BRAND_ACCENT if i == 4 else BRAND
        round_rect(d, (bxc, chart_y + 600 - bh, bxc + bar_w, chart_y + 600), 10, fill=col)
        d.text((bxc + bar_w // 2, chart_y + 640), days[i], font=font(22, bold=True), fill=MUTED, anchor="mm")
    # value on top of best day
    bxc = bx + 4 * (bar_w + 18)
    d.text((bxc + bar_w // 2, chart_y + 600 - max_h - 30), "€ 620", font=font(20, bold=True), fill=BRAND_ACCENT, anchor="mb")

    py = chart_y + 720 + 30
    round_rect(d, (40, py, w - 40, py + 200), 22, fill=BRAND_LIGHT)
    d.text((70, py + 30), "Obiettivo mensile", font=font(24, bold=True), fill=BRAND)
    d.text((70, py + 70), "€ 5.240 / € 7.000", font=font(36, bold=True), fill=TEXT_DARK)
    round_rect(d, (70, py + 140, w - 70, py + 170), 15, fill="white")
    round_rect(d, (70, py + 140, 70 + int((w - 140) * 0.75), py + 170), 15, fill=BRAND)
    d.text((w - 70, py + 30), "75%", font=font(28, bold=True), fill=BRAND, anchor="rt")
    return img


def mock_fornitori(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    d.text((40, 90), "Fornitori", font=font(42, bold=True), fill=TEXT_DARK)
    # search bar
    round_rect(d, (40, 160, w - 40, 240), 22, fill="white", outline=(230, 232, 234), width=2)
    IC.search(d, 90, 200, 50, MUTED)
    d.text((140, 200), "Cerca fornitore...", font=font(26), fill=MUTED, anchor="lm")
    # tags
    tags = ["Tutti", "Tessuti", "Calzature", "Accessori"]
    tx = 40
    for i, t in enumerate(tags):
        bbox = d.textbbox((0, 0), t, font=font(22, bold=True))
        tw = bbox[2] - bbox[0] + 60
        if i == 0:
            round_rect(d, (tx, 270, tx + tw, 330), 18, fill=BRAND)
            d.text((tx + tw // 2, 300), t, font=font(22, bold=True), fill=TEXT_LIGHT, anchor="mm")
        else:
            round_rect(d, (tx, 270, tx + tw, 330), 18, fill="white", outline=(230, 232, 234), width=2)
            d.text((tx + tw // 2, 300), t, font=font(22, bold=True), fill=TEXT_DARK, anchor="mm")
        tx += tw + 14

    forn = [
        ("Tessuti Bianchi srl", "Lecce — IT", "€ 1.240 saldo", "TB", SUCCESS),
        ("Calzature Sud", "Napoli — IT", "€ 380 saldo", "CS", BRAND_ACCENT),
        ("Modolab Atelier", "Milano — IT", "€ 0", "MA", MUTED),
        ("Ricami Romagna", "Rimini — IT", "€ 720 saldo", "RR", SUCCESS),
    ]
    fy = 380
    for name, city, saldo, init, col in forn:
        round_rect(d, (40, fy, w - 40, fy + 180), 22, fill="white", outline=(232, 234, 236), width=2)
        d.ellipse((70, fy + 40, 170, fy + 140), fill=col)
        d.text((120, fy + 90), init, font=font(36, bold=True), fill="white", anchor="mm")
        d.text((200, fy + 45), name, font=font(28, bold=True), fill=TEXT_DARK)
        d.text((200, fy + 88), city, font=font(22), fill=MUTED)
        d.text((200, fy + 130), saldo, font=font(24, bold=True), fill=col)
        # chevron right
        cv = w - 70
        d.polygon([(cv - 14, fy + 78), (cv, fy + 90), (cv - 14, fy + 102)], fill=MUTED)
        fy += 200
    return img


def mock_spese(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    d.text((40, 90), "Spesa ripartita", font=font(38, bold=True), fill=TEXT_DARK)
    d.text((40, 145), "Affitto magazzino", font=font(26), fill=MUTED)
    # big card
    round_rect(d, (40, 200, w - 40, 460), 28, fill=BRAND)
    d.text((70, 230), "TOTALE", font=font(22, bold=True), fill=(220, 240, 234))
    d.text((70, 270), "€ 1.800,00", font=font(72, bold=True), fill=TEXT_LIGHT)
    d.text((70, 370), "÷ 30 giornate attive", font=font(24), fill=(220, 240, 234))
    d.text((w - 70, 370), "€ 60/g", font=font(34, bold=True), fill=BRAND_ACCENT, anchor="rt")

    # period
    round_rect(d, (40, 500, w - 40, 600), 18, fill="white", outline=(232, 234, 236), width=2)
    IC.calendar(d, 100, 550, 60, BRAND)
    d.text((170, 525), "PERIODO", font=font(18, bold=True), fill=MUTED)
    d.text((170, 555), "01/06/2026 → 30/06/2026", font=font(24, bold=True), fill=TEXT_DARK)
    # category
    round_rect(d, (40, 620, w - 40, 720), 18, fill="white", outline=(232, 234, 236), width=2)
    IC.briefcase(d, 100, 670, 60, BRAND)
    d.text((170, 645), "CATEGORIA", font=font(18, bold=True), fill=MUTED)
    d.text((170, 675), "Costi fissi", font=font(24, bold=True), fill=TEXT_DARK)

    d.text((40, 770), "Suddivisione automatica", font=font(28, bold=True), fill=TEXT_DARK)
    rows = [
        ("Lun 1 — Avezzano", "€ 60,00"),
        ("Mar 2 — Sulmona", "€ 60,00"),
        ("Gio 4 — Penne", "€ 60,00"),
        ("Sab 6 — Pescara", "€ 60,00"),
        ("Lun 8 — Chieti", "€ 60,00"),
    ]
    ry = 830
    for label, amt in rows:
        round_rect(d, (40, ry, w - 40, ry + 90), 14, fill="white", outline=(235, 238, 240), width=2)
        d.text((70, ry + 30), label, font=font(24, bold=True), fill=TEXT_DARK)
        d.text((70, ry + 60), "Categoria: Costi fissi", font=font(18), fill=MUTED)
        d.text((w - 70, ry + 45), amt, font=font(24, bold=True), fill=BRAND, anchor="rm")
        ry += 110
    round_rect(d, (40, ry + 30, w - 40, ry + 150), 22, fill=BRAND_ACCENT)
    d.text((w // 2, ry + 90), "Conferma e salva", font=font(28, bold=True), fill="white", anchor="mm")
    return img


def mock_ai(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    # header
    d.rectangle((0, 80, w, 220), fill=BRAND)
    d.ellipse((50, 100, 170, 220), fill="white")
    IC.robot(d, 110, 160, 90, BRAND)
    d.text((200, 115), "MarketMate AI", font=font(34, bold=True), fill=TEXT_LIGHT)
    d.text((200, 165), "Online · risponde in italiano", font=font(22), fill=(200, 230, 220))
    # chat
    msgs = [
        ("user", "Ho speso €240 di benzina in 4 giornate, come lo spezzo?"),
        ("bot", "Ti consiglio di registrarlo come Spesa Ripartita: €60/giornata su categoria Carburante. Vuoi che lo inserisco?"),
        ("user", "Sì, dal 1 al 8 giugno"),
        ("bot", "Fatto! Ho creato 4 voci da €60 nelle giornate attive del periodo. Tutto coerente con il Netto di giugno."),
        ("user", "Grazie!"),
    ]
    cy = 260
    for kind, text in msgs:
        f = font(24)
        max_w = int(w * 0.72)
        # wrap
        words = text.split(" ")
        lines, cur = [], ""
        for word in words:
            test = cur + (" " if cur else "") + word
            if d.textlength(test, font=f) > max_w:
                lines.append(cur)
                cur = word
            else:
                cur = test
        if cur:
            lines.append(cur)
        bub_h = 30 * len(lines) + 50
        widest = max(d.textlength(l, font=f) for l in lines)
        bub_w = max(int(w * 0.4), int(widest) + 70)
        bub_w = min(bub_w, max_w + 60)
        if kind == "user":
            bx = w - 40 - bub_w
            fill_b = BRAND_ACCENT
            txt_col = "white"
        else:
            bx = 40
            fill_b = "white"
            txt_col = TEXT_DARK
        round_rect(d, (bx, cy, bx + bub_w, cy + bub_h), 24, fill=fill_b,
                   outline=(230, 232, 234) if kind == "bot" else None, width=2)
        ty = cy + 25
        for ln in lines:
            d.text((bx + 30, ty), ln, font=f, fill=txt_col)
            ty += 30
        cy += bub_h + 25
    # input bar
    iy = h - 200
    d.rectangle((0, iy, w, h), fill="white")
    d.line((0, iy, w, iy), fill=(230, 232, 234), width=1)
    round_rect(d, (40, iy + 40, w - 180, iy + 130), 26, fill=(238, 240, 242))
    d.text((70, iy + 85), "Scrivi un messaggio...", font=font(22), fill=MUTED, anchor="lm")
    d.ellipse((w - 150, iy + 35, w - 50, iy + 135), fill=BRAND)
    IC.send(d, w - 100, iy + 85, 56, "white")
    return img


def mock_calendar(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    d.text((40, 90), "Calendario", font=font(42, bold=True), fill=TEXT_DARK)
    round_rect(d, (40, 170, w - 40, 250), 18, fill=BRAND_LIGHT)
    # left chevron
    d.polygon([(110, 210), (80, 195), (80, 225)], fill=BRAND)
    d.text((w // 2, 210), "Giugno 2026", font=font(28, bold=True), fill=TEXT_DARK, anchor="mm")
    d.polygon([(w - 110, 210), (w - 80, 195), (w - 80, 225)], fill=BRAND)

    days = ["L", "M", "M", "G", "V", "S", "D"]
    grid_y = 290
    cell = (w - 80) // 7
    for i, dn in enumerate(days):
        d.text((40 + i * cell + cell // 2, grid_y + cell // 2), dn,
               font=font(22, bold=True), fill=MUTED, anchor="mm")
    grid_y += cell
    day_num = 1
    today_index = 12
    has_event = {2, 5, 8, 10, 12, 15, 18, 21, 23, 28}
    for r in range(5):
        for c in range(7):
            if day_num > 30:
                break
            cx = 40 + c * cell
            cy2 = grid_y + r * cell
            if day_num == today_index:
                d.ellipse((cx + 12, cy2 + 12, cx + cell - 12, cy2 + cell - 12), fill=BRAND)
                d.text((cx + cell // 2, cy2 + cell // 2), str(day_num),
                       font=font(28, bold=True), fill="white", anchor="mm")
            else:
                d.text((cx + cell // 2, cy2 + cell // 2), str(day_num),
                       font=font(26, bold=True), fill=TEXT_DARK, anchor="mm")
            if day_num in has_event and day_num != today_index:
                d.ellipse((cx + cell // 2 - 6, cy2 + cell - 24,
                           cx + cell // 2 + 6, cy2 + cell - 12), fill=BRAND_ACCENT)
            day_num += 1
    grid_y += 5 * cell + 30
    d.text((40, grid_y), "Prossime fiere", font=font(28, bold=True), fill=TEXT_DARK)
    grid_y += 60
    evs = [
        ("SAB 14", "Fiera di Sulmona", "Piazza Garibaldi", BRAND_ACCENT),
        ("DOM 15", "Mercato di Penne", "Centro storico", BRAND),
        ("MER 18", "Festa patronale", "Loreto Aprutino", SUCCESS),
    ]
    for date, title, loc, col in evs:
        round_rect(d, (40, grid_y, w - 40, grid_y + 160), 22, fill="white", outline=(232, 234, 236), width=2)
        round_rect(d, (60, grid_y + 30, 220, grid_y + 130), 18, fill=col)
        d.text((140, grid_y + 80), date, font=font(22, bold=True), fill="white", anchor="mm")
        d.text((250, grid_y + 50), title, font=font(28, bold=True), fill=TEXT_DARK)
        # pin icon + location
        IC.target(d, 270, grid_y + 105, 24, MUTED)
        d.text((290, grid_y + 105), loc, font=font(22), fill=MUTED, anchor="lm")
        grid_y += 180
    return img


def mock_security(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    d.text((40, 90), "Sicurezza", font=font(42, bold=True), fill=TEXT_DARK)
    d.text((40, 145), "I tuoi dati sono al sicuro", font=font(24), fill=MUTED)

    round_rect(d, (40, 210, w - 40, 660), 32, fill=BRAND)
    # big shield icon
    IC.lock(d, w // 2, 410, 280, "white")
    d.text((w // 2, 570), "Crittografia end-to-end", font=font(30, bold=True), fill="white", anchor="mm")
    d.text((w // 2, 615), "Solo tu hai accesso ai tuoi dati", font=font(22), fill=(200, 230, 220), anchor="mm")

    feats = [
        (IC.pin, "PIN di 6 cifre", "Protezione locale al primo avvio"),
        (IC.cloud, "Cloud Sync", "Backup sicuro su server EU"),
        (IC.shield, "GDPR by design", "Conformità al regolamento UE"),
        (IC.trash, "Diritto all'oblio", "Cancella account in 1 tap"),
    ]
    fy = 700
    for icon_fn, title, sub in feats:
        round_rect(d, (40, fy, w - 40, fy + 160), 22, fill="white", outline=(230, 232, 234), width=2)
        icon_fn(d, 100, fy + 80, 70, BRAND)
        d.text((190, fy + 50), title, font=font(28, bold=True), fill=TEXT_DARK)
        d.text((190, fy + 95), sub, font=font(22), fill=MUTED)
        fy += 180
    return img


def mock_premium(w, h):
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    status_bar(d, w)
    # premium hero
    grad = vert_gradient((w, 700), (14, 90, 74), (28, 130, 100))
    img.paste(grad, (0, 80))
    d = ImageDraw.Draw(img)
    d.text((w // 2, 200), "MarketMate Pro", font=font(48, bold=True), fill="white", anchor="mm")
    d.text((w // 2, 260), "Sblocca tutta la potenza dell'app", font=font(24), fill=(200, 230, 220), anchor="mm")
    IC.crown(d, w // 2, 440, 280, BRAND_ACCENT)
    d.text((w // 2, 630), "€ 7,99 / mese", font=font(50, bold=True), fill=BRAND_ACCENT, anchor="mm")
    d.text((w // 2, 700), "o € 79,99/anno · risparmia il 17%", font=font(22), fill=(200, 230, 220), anchor="mm")

    by = 830
    benefits = [
        (IC.cloud, "Cloud Sync illimitato", "Backup automatico su tutti i device"),
        (IC.robot, "AI senza limiti", "Chat e suggerimenti illimitati"),
        (IC.users, "Multi-utente", "Aggiungi collaboratori al tuo team"),
        (IC.chart, "Statistiche avanzate", "Esporta CSV, PDF, grafici personalizzati"),
        (IC.target, "Supporto prioritario", "Risposta entro 4 ore"),
    ]
    for icon_fn, title, sub in benefits:
        round_rect(d, (40, by, w - 40, by + 130), 22, fill="white", outline=(230, 232, 234), width=2)
        icon_fn(d, 100, by + 65, 60, BRAND)
        d.text((190, by + 38), title, font=font(24, bold=True), fill=TEXT_DARK)
        d.text((190, by + 80), sub, font=font(20), fill=MUTED)
        by += 145
    round_rect(d, (40, h - 200, w - 40, h - 80), 30, fill=BRAND_ACCENT)
    d.text((w // 2, h - 140), "Inizia ora", font=font(34, bold=True), fill="white", anchor="mm")
    return img


RENDERERS = {
    "home": mock_home,
    "stats": mock_stats,
    "fornitori": mock_fornitori,
    "spese": mock_spese,
    "ai": mock_ai,
    "calendar": mock_calendar,
    "security": mock_security,
    "premium": mock_premium,
}

# ── COMPOSITE ───────────────────────────────────────────────
def build_screenshot(W, H, screen):
    bg = vert_gradient((W, H), (216, 237, 229), (180, 220, 205))
    img = bg.convert("RGBA")
    d = ImageDraw.Draw(img)

    fh = int(W * 0.078)
    fs = int(W * 0.040)
    head_f = font(fh, bold=True)
    sub_f = font(fs, bold=False)

    cy = int(H * 0.06)
    for ln in screen["headline"].split("\n"):
        d.text((W // 2, cy), ln, font=head_f, fill=BRAND, anchor="mt")
        bbox = head_f.getbbox(ln)
        cy += int((bbox[3] - bbox[1]) * 1.18) + 6
    cy += 10
    for ln in screen["subtitle"].split("\n"):
        d.text((W // 2, cy), ln, font=sub_f, fill=(60, 86, 78), anchor="mt")
        bbox = sub_f.getbbox(ln)
        cy += int((bbox[3] - bbox[1]) * 1.22) + 2

    dev_w = int(W * 0.74)
    dev_h = int(dev_w * 2.16)
    dev_x = (W - dev_w) // 2
    dev_y = int(H * 0.30)
    if dev_y + dev_h > H - int(H * 0.06):
        dev_h = H - dev_y - int(H * 0.06)
        dev_w = int(dev_h / 2.16)
        dev_x = (W - dev_w) // 2

    ui_w = 1200
    ui_h = int(ui_w * (dev_h - 44) / (dev_w - 44))
    ui = RENDERERS[screen["kind"]](ui_w, ui_h)
    frame = make_device_frame(ui, dev_w, dev_h, pad=22, radius=72)

    # drop shadow
    sh = Image.new("RGBA", (dev_w + 80, dev_h + 80), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle((40, 40, dev_w + 40, dev_h + 40), radius=72, fill=(0, 0, 0, 100))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=28))
    img.alpha_composite(sh, (dev_x - 40, dev_y - 20))
    img.alpha_composite(frame, (dev_x, dev_y))

    d = ImageDraw.Draw(img)
    f_brand = font(int(W * 0.034), bold=True)
    d.text((W // 2, H - int(H * 0.035)),
           "MarketMate · Mobile Vendor's Agenda",
           font=f_brand, fill=BRAND, anchor="mb")
    return img.convert("RGB")


def main():
    # iOS 5 main
    for i, s in enumerate(SCREENS[:5], 1):
        print(f"[iOS] {i}/5 — {s['kind']}")
        out = build_screenshot(1290, 2796, s)
        out.save(f"{OUT_IOS}/{i:02d}_{s['kind']}.png", "PNG", optimize=True)
    # Android 8 all
    for i, s in enumerate(SCREENS, 1):
        print(f"[Android] {i}/8 — {s['kind']}")
        out = build_screenshot(1080, 2400, s)
        out.save(f"{OUT_AND}/{i:02d}_{s['kind']}.png", "PNG", optimize=True)
    print("\nDONE")


if __name__ == "__main__":
    main()
