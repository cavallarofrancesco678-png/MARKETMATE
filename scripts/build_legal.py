"""Converte i 3 markdown legali in HTML stilizzati e in MD pubblicabili."""
import markdown
from pathlib import Path

SRC_DIR = Path("/app/memory/legal")
DST_DIR = Path("/app/backend/static/legal")
DST_DIR.mkdir(parents=True, exist_ok=True)

TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__TITLE__ — MarketMate</title>
<meta name="description" content="__TITLE__ di MarketMate, conforme al GDPR. Email: contact@marketmateapp.info">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
    color: #1A3535; line-height: 1.6; max-width: 820px; margin: 0 auto;
    padding: 30px 24px; background: #FDFBF6; }
  h1 { font-size: 30px; color: #1E7F85; border-bottom: 3px solid #1E7F85; padding-bottom: 12px; margin-top: 0; }
  h2 { font-size: 21px; color: #1E7F85; border-left: 4px solid #D2691E; padding-left: 12px; margin-top: 30px; }
  h3 { font-size: 16px; color: #1A3535; margin-top: 20px; }
  p, li { font-size: 14px; }
  a { color: #1E7F85; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { padding: 9px 11px; text-align: left; border-bottom: 1px solid #DCD5C4; vertical-align: top; }
  th { background: #1E7F85; color: white; font-weight: 700; }
  tr:nth-child(even) td { background: #F5F1E8; }
  blockquote { background: #FFF8E6; border-left: 4px solid #D4AF37; padding: 12px 18px; margin: 14px 0; border-radius: 6px; font-size: 13px; color: #5A4A1F; }
  code { background: #F5F1E8; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  strong { color: #1A3535; }
  hr { border: none; border-top: 1px solid #DCD5C4; margin: 28px 0; }
  .footer { border-top: 2px solid #DCD5C4; margin-top: 40px; padding-top: 16px; text-align: center; font-size: 11px; color: #8B8B8B; }
  .legal-nav { background: #EAF7F8; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; border-left: 4px solid #1E7F85; }
  .legal-nav a { margin-right: 14px; font-weight: 700; }
  @media print { body { background: white; padding: 0; } th { background: #1E7F85 !important; color: white !important; -webkit-print-color-adjust: exact; } blockquote { background: #FFF8E6 !important; -webkit-print-color-adjust: exact; } .legal-nav { display: none; } }
</style>
</head>
<body>
<div class="legal-nav">
  📄 <a href="/api/legal/privacy">Privacy Policy</a>
  📄 <a href="/api/legal/terms">Termini di Servizio</a>
  🍪 <a href="/api/legal/cookies">Cookie Policy</a>
  🏠 <a href="https://www.marketmateapp.info">www.marketmateapp.info</a>
</div>
__BODY__
<div class="footer">MarketMate · contact@marketmateapp.info · <a href="https://www.marketmateapp.info">www.marketmateapp.info</a></div>
</body>
</html>
"""

files = [
    ("PRIVACY_POLICY.md", "privacy.html", "Privacy Policy"),
    ("TERMS_OF_SERVICE.md", "terms.html", "Termini di Servizio"),
    ("COOKIE_POLICY.md", "cookies.html", "Cookie Policy"),
]

for src_name, dst_name, title in files:
    md_text = (SRC_DIR / src_name).read_text(encoding="utf-8")
    html_body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "nl2br"])
    html_full = TEMPLATE.replace("__BODY__", html_body).replace("__TITLE__", title)
    (DST_DIR / dst_name).write_text(html_full, encoding="utf-8")
    (DST_DIR / src_name).write_text(md_text, encoding="utf-8")
    print(f"✓ {src_name} → {dst_name} ({len(html_full)} bytes)")

print("DONE")
