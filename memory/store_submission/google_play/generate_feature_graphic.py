"""Genera la Feature Graphic 1024x500 per Google Play Console.
Requisiti Google Play:
  - Dimensioni esatte: 1024 x 500 px
  - Formato: PNG o JPG (no trasparenza)
  - Mostra il brand + value proposition in italiano
  - Nessun testo che descriva azioni utente ("Scarica ora", ecc.)

Run: python3 /app/memory/store_submission/google_play/generate_feature_graphic.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT = "/app/memory/store_submission/google_play/feature_graphic_1024x500.png"
ICON_PATH = "/app/frontend/assets/images/icon.png"

# Brand palette MarketMate
BG_TEAL = "#1E7F85"     # teal scuro
BG_TEAL_2 = "#155F66"   # gradiente
ACCENT_ORANGE = "#E89B4A"
TEXT_WHITE = "#FFFFFF"
TEXT_CREAM = "#F5EFE0"


def find_font(size, bold=False):
    """Cerca font di sistema disponibili."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def make_gradient(w, h, top_color, bottom_color):
    """Gradiente verticale da top a bottom."""
    top_rgb = tuple(int(top_color[i:i+2], 16) for i in (1, 3, 5))
    bot_rgb = tuple(int(bottom_color[i:i+2], 16) for i in (1, 3, 5))
    img = Image.new("RGB", (w, h), top_rgb)
    px = img.load()
    for y in range(h):
        ratio = y / max(1, h - 1)
        r = int(top_rgb[0] + (bot_rgb[0] - top_rgb[0]) * ratio)
        g = int(top_rgb[1] + (bot_rgb[1] - top_rgb[1]) * ratio)
        b = int(top_rgb[2] + (bot_rgb[2] - top_rgb[2]) * ratio)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img


def main():
    W, H = 1024, 500
    img = make_gradient(W, H, BG_TEAL, BG_TEAL_2)
    draw = ImageDraw.Draw(img)

    # Icona arrotondata a destra
    try:
        icon = Image.open(ICON_PATH).convert("RGBA")
        icon_size = 320
        icon = icon.resize((icon_size, icon_size), Image.LANCZOS)

        # Maschera arrotondata (radius 60)
        mask = Image.new("L", (icon_size, icon_size), 0)
        mdraw = ImageDraw.Draw(mask)
        radius = 60
        mdraw.rounded_rectangle((0, 0, icon_size, icon_size), radius=radius, fill=255)

        icon_pos_x = W - icon_size - 80
        icon_pos_y = (H - icon_size) // 2

        # Ombra sotto l'icona
        shadow = Image.new("RGBA", (icon_size + 40, icon_size + 40), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        sdraw.rounded_rectangle((20, 20, icon_size + 20, icon_size + 20),
                                radius=radius, fill=(0, 0, 0, 80))
        img.paste(shadow, (icon_pos_x - 20, icon_pos_y - 5), shadow)

        img.paste(icon, (icon_pos_x, icon_pos_y), mask)
    except Exception as e:
        print(f"Icon paste failed: {e}")

    # Testo lato sinistro
    f_brand = find_font(72, bold=True)
    f_tagline = find_font(34, bold=True)
    f_sub = find_font(24, bold=False)

    pad_x = 60
    # Brand "MarketMate"
    draw.text((pad_x, 130), "MarketMate", font=f_brand, fill=TEXT_WHITE)

    # Tagline
    draw.text((pad_x, 230), "Il gestionale degli", font=f_tagline, fill=ACCENT_ORANGE)
    draw.text((pad_x, 275), "ambulanti italiani", font=f_tagline, fill=ACCENT_ORANGE)

    # Sub
    draw.text((pad_x, 345), "Mercati • Fiere • Bilancio", font=f_sub, fill=TEXT_CREAM)
    draw.text((pad_x, 380), "AI di settore • Calendario fiscale", font=f_sub, fill=TEXT_CREAM)

    # Strisce decorative
    for i, y in enumerate([60, 80]):
        draw.rectangle((pad_x, y, pad_x + 60 + i * 10, y + 6), fill=ACCENT_ORANGE)

    img.save(OUTPUT, "PNG", optimize=True)
    print(f"✅ Feature graphic salvata: {OUTPUT}")
    print(f"   Dimensioni: {img.size}")
    print(f"   Size: {os.path.getsize(OUTPUT) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
