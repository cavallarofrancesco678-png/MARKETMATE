"""
Round 64 backend sanity check after FE-only changes.
Tests against EXPO_PUBLIC_BACKEND_URL/api.
"""
import json
import os
import sys
import requests

BASE = "https://marketmate-hub-1.preview.emergentagent.com/api"

results = []

def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} — {detail}")
    results.append((name, ok, detail))


# ── 1. GET /api/ healthcheck ─────────────────────────────────────────────
try:
    r = requests.get(f"{BASE}/", timeout=15)
    ok = r.status_code == 200
    body = r.json() if ok else r.text
    log("1. GET /api/ (healthcheck)", ok and isinstance(body, dict) and bool(body),
        f"HTTP {r.status_code} body={body}")
except Exception as e:
    log("1. GET /api/", False, f"EXC {e}")


# ── 2. POST /api/weather ─────────────────────────────────────────────────
# Review asks for {latitude, longitude} payload — backend actually expects {citta}.
# Test BOTH so the report is unambiguous.

# 2a. Review-literal payload
try:
    r = requests.post(f"{BASE}/weather",
                      json={"latitude": 41.9, "longitude": 12.5}, timeout=20)
    log("2a. POST /api/weather {latitude,longitude} (review payload)",
        r.status_code == 200,
        f"HTTP {r.status_code} body={str(r.text)[:200]}")
except Exception as e:
    log("2a. POST /api/weather lat/lon", False, f"EXC {e}")

# 2b. Actual backend contract {citta}
try:
    r = requests.post(f"{BASE}/weather", json={"citta": "Roma"}, timeout=30)
    b = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200
          and b.get("success") is True
          and isinstance(b.get("descrizione"), str)
          and b.get("descrizione"))
    log("2b. POST /api/weather {citta:Roma} (backend contract)",
        ok,
        f"HTTP {r.status_code} success={b.get('success')} desc={b.get('descrizione')} temp={b.get('temperatura')}")
except Exception as e:
    log("2b. POST /api/weather citta", False, f"EXC {e}")


# ── 3. POST /api/ai/chat ────────────────────────────────────────────────
# Review-literal: context as dict {tipoUtente, nome}.
# Backend expects context: str. Test both.

# 3a. Review payload (context as dict) — likely 422
try:
    r = requests.post(f"{BASE}/ai/chat", json={
        "message": "Ciao",
        "language": "it",
        "context": {"tipoUtente": "NEGOZIANTE", "nome": "Mario"}
    }, timeout=60)
    log("3a. POST /api/ai/chat (review payload — context as dict)",
        r.status_code == 200,
        f"HTTP {r.status_code} body={str(r.text)[:300]}")
except Exception as e:
    log("3a. POST /api/ai/chat dict", False, f"EXC {e}")

# 3b. Backend contract (context as string)
try:
    ctx_str = "Tipo utente: NEGOZIANTE\nNome titolare: Mario"
    r = requests.post(f"{BASE}/ai/chat", json={
        "message": "Ciao",
        "context": ctx_str,
        "session_id": "round64_smoke"
    }, timeout=90)
    b = r.json() if r.status_code == 200 else {}
    resp_text = (b.get("response") or "")
    ok = (r.status_code == 200
          and isinstance(resp_text, str)
          and len(resp_text.strip()) > 0
          and not resp_text.startswith("Errore"))
    log("3b. POST /api/ai/chat (string context)",
        ok,
        f"HTTP {r.status_code} reply_len={len(resp_text)} reply='{resp_text[:160]}'")
except Exception as e:
    log("3b. POST /api/ai/chat string", False, f"EXC {e}")


# ── 4. GET /api/team/status ─────────────────────────────────────────────
try:
    r = requests.get(f"{BASE}/team/status", timeout=15)
    ok = r.status_code in (200, 401, 403)
    log("4a. GET /api/team/status (no auth)", ok,
        f"HTTP {r.status_code} (accepted 200/401/403)")
except Exception as e:
    log("4a. GET /api/team/status", False, f"EXC {e}")

try:
    r = requests.get(f"{BASE}/team/status",
                     headers={"Authorization": "Bearer not-a-real-token"}, timeout=15)
    ok = r.status_code in (200, 401, 403)
    log("4b. GET /api/team/status (fake auth)", ok,
        f"HTTP {r.status_code} (accepted 200/401/403)")
except Exception as e:
    log("4b. GET /api/team/status fake", False, f"EXC {e}")


# ── 5. POST /api/team/login_by_code (empty body → 4xx, NOT 5xx) ─────────
try:
    r = requests.post(f"{BASE}/team/login_by_code", json={}, timeout=15)
    ok = 400 <= r.status_code < 500
    log("5. POST /api/team/login_by_code (empty body)", ok,
        f"HTTP {r.status_code} (must be 4xx, not 5xx)")
except Exception as e:
    log("5. POST /api/team/login_by_code", False, f"EXC {e}")


# ── 6. POST /api/auth/invites/create (no auth → 401, NOT 5xx) ───────────
try:
    r = requests.post(f"{BASE}/auth/invites/create",
                      json={"role": "full"}, timeout=15)
    ok = r.status_code == 401
    # accept 403 too if the backend prefers that for missing auth
    if not ok and r.status_code in (401, 403):
        ok = True
    log("6. POST /api/auth/invites/create (no auth)", ok,
        f"HTTP {r.status_code} (expected 401, no 5xx)")
except Exception as e:
    log("6. POST /api/auth/invites/create", False, f"EXC {e}")


# ── 7. POST /api/receipt/analyze (REMOVED → must be 404) ─────────────────
try:
    r = requests.post(f"{BASE}/receipt/analyze",
                      json={"image_base64": "x"}, timeout=15)
    ok = r.status_code == 404
    log("7. POST /api/receipt/analyze (REMOVED endpoint)", ok,
        f"HTTP {r.status_code} (expected 404)")
except Exception as e:
    log("7. POST /api/receipt/analyze", False, f"EXC {e}")


# ── 5xx-anywhere assertion ───────────────────────────────────────────────
print("\n══════ SUMMARY ══════")
ok_count = sum(1 for _, ok, _ in results if ok)
print(f"{ok_count}/{len(results)} checks passed")
for name, ok, detail in results:
    print(("  ✅ " if ok else "  ❌ ") + name)
sys.exit(0 if ok_count == len(results) else 1)
