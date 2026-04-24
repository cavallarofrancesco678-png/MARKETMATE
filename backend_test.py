#!/usr/bin/env python3
"""
MarketMate Backend Tests — Context-per-message freshness + endpoint regression.
"""
import os
import sys
import time
import requests

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "https://marketmate-hub-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

TIMEOUT = 60
RESULTS = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    RESULTS.append((name, ok, detail))
    print(f"[{status}] {name}")
    if detail:
        print(f"        {detail}")


def post(path, payload, timeout=TIMEOUT):
    url = f"{API}{path}"
    try:
        return requests.post(url, json=payload, timeout=timeout)
    except Exception as e:
        return e


def get(path, timeout=TIMEOUT):
    url = f"{API}{path}"
    try:
        return requests.get(url, timeout=timeout)
    except Exception as e:
        return e


def test_root():
    r = get("/")
    if not hasattr(r, "status_code"):
        record("GET /api/", False, f"Exception: {r}")
        return
    try:
        ok = r.status_code == 200 and r.json().get("message") == "Hello World"
    except Exception:
        ok = False
    record("GET /api/ (hello world)", ok, f"status={r.status_code} body={r.text[:120]}")


def test_weather():
    r1 = post("/weather", {"lat": 41.9, "lon": 12.5})
    if not hasattr(r1, "status_code"):
        record("POST /api/weather {lat,lon} (review payload)", False, f"Exception: {r1}")
    else:
        record(
            "POST /api/weather {lat,lon} (review payload, expected 422 due to contract)",
            r1.status_code in (200, 422),
            f"status={r1.status_code} body={r1.text[:180]}",
        )

    r2 = post("/weather", {"citta": "Roma"})
    if not hasattr(r2, "status_code"):
        record("POST /api/weather {citta:Roma}", False, f"Exception: {r2}")
        return
    if r2.status_code != 200:
        record("POST /api/weather {citta:Roma}", False, f"status={r2.status_code} body={r2.text[:180]}")
        return
    body = r2.json()
    record(
        "POST /api/weather {citta:Roma}",
        bool(body.get("success")),
        f"temp={body.get('temperatura')}°C desc='{body.get('descrizione')}' vento={body.get('vento_kmh')} msg={body.get('message')[:100]}",
    )


def test_distance():
    r1 = post("/distance/calculate", {"from": "Roma", "to": "Milano"})
    if not hasattr(r1, "status_code"):
        record("POST /api/distance/calculate {from,to} (review payload)", False, f"Exception: {r1}")
    else:
        record(
            "POST /api/distance/calculate {from,to} (review payload, expected 422 due to contract)",
            r1.status_code in (200, 422),
            f"status={r1.status_code} body={r1.text[:180]}",
        )

    r2 = post("/distance/calculate", {"partenza": "Roma", "destinazione": "Milano"})
    if not hasattr(r2, "status_code"):
        record("POST /api/distance/calculate {partenza,destinazione}", False, f"Exception: {r2}")
        return
    if r2.status_code != 200:
        record(
            "POST /api/distance/calculate {partenza,destinazione}",
            False,
            f"status={r2.status_code} body={r2.text[:180]}",
        )
        return
    body = r2.json()
    record(
        "POST /api/distance/calculate {partenza,destinazione}",
        bool(body.get("success")) and body.get("km", 0) > 400,
        f"km={body.get('km')} A/R={body.get('km_andata_ritorno')}",
    )


def test_ai_context_freshness():
    sid = f"test_A_{int(time.time())}"

    ctx1 = (
        "Mercato oggi: Testaccio\n"
        "Settimana precedente totale: Lordo: €2300 in 5 giornate"
    )
    payload1 = {
        "message": "Quanto ho guadagnato la settimana scorsa?",
        "context": ctx1,
        "session_id": sid,
    }
    r1 = post("/ai/chat", payload1, timeout=90)
    if not hasattr(r1, "status_code") or r1.status_code != 200:
        record(
            "POST /api/ai/chat — call #1 (ctx: €2300 / 5 giornate)",
            False,
            f"status={getattr(r1,'status_code','EXC')} body={getattr(r1,'text',str(r1))[:200]}",
        )
        return
    body1 = r1.json()
    resp1 = body1.get("response", "")
    sid1 = body1.get("session_id", "")
    mentions_2300 = any(t in resp1 for t in ["2300", "2.300", "2'300", "2 300"])
    mentions_5 = "5" in resp1 and ("giornat" in resp1.lower() or "gg" in resp1.lower())
    ok1 = mentions_2300 or mentions_5
    record(
        "AI chat call #1 — context €2300 / 5 giornate reflected",
        ok1,
        f"sid={sid1} | mentions_2300={mentions_2300} mentions_5giornate={mentions_5}\n        response={resp1[:500]}",
    )

    ctx2 = "Top 3 mercati: Sanzeno €4500 (10 gg); Rho €2200 (4 gg); Brera €900 (2 gg)"
    payload2 = {
        "message": "Qual è il mio miglior mercato?",
        "context": ctx2,
        "session_id": sid,
    }
    r2 = post("/ai/chat", payload2, timeout=90)
    if not hasattr(r2, "status_code") or r2.status_code != 200:
        record(
            "POST /api/ai/chat — call #2 (NEW ctx Sanzeno €4500)",
            False,
            f"status={getattr(r2,'status_code','EXC')} body={getattr(r2,'text',str(r2))[:200]}",
        )
        return
    body2 = r2.json()
    resp2 = body2.get("response", "")
    sid2 = body2.get("session_id", "")
    mentions_sanzeno = "sanzeno" in resp2.lower()
    mentions_4500 = any(t in resp2 for t in ["4500", "4.500", "4'500", "4 500"])
    leaking_testaccio_as_best = "testaccio" in resp2.lower() and ("miglior" in resp2.lower() or "top" in resp2.lower())
    ok2 = (mentions_sanzeno or mentions_4500)
    record(
        "AI chat call #2 — FRESH context (Sanzeno €4500) picked up (cache NOT locked)",
        ok2,
        f"sid={sid2} | mentions_sanzeno={mentions_sanzeno} mentions_4500={mentions_4500} leaks_testaccio_as_best={leaking_testaccio_as_best}\n        response={resp2[:500]}",
    )

    record(
        "AI chat session_id continuity across calls",
        sid1 == sid2 == sid,
        f"sent={sid} got1={sid1} got2={sid2}",
    )


def test_init_greeting():
    sid = f"test_init_{int(time.time())}"
    ctx = (
        "nomeTitolare: Marco\n"
        "mercatoOggi: Testaccio\n"
        "partenzaDa: Frascati\n"
        "fiereProssime: [Sagra del Tartufo ad Alba, 25 Giu]\n"
        "appuntiProssimi: [Commercialista a Milano, 26 Giu]\n"
    )
    payload = {"message": "__INIT_GREETING__", "context": ctx, "session_id": sid}
    r = post("/ai/chat", payload, timeout=90)
    if not hasattr(r, "status_code") or r.status_code != 200:
        record(
            "POST /api/ai/chat __INIT_GREETING__",
            False,
            f"status={getattr(r,'status_code','EXC')} body={getattr(r,'text',str(r))[:200]}",
        )
        return
    body = r.json()
    resp = body.get("response", "")
    low = resp.lower()
    has_name = "marco" in low
    has_appuntamenti = ("commercialista" in low) or ("milano" in low)
    has_fiere = ("tartufo" in low) or ("alba" in low) or ("sagra" in low)
    no_literal_echo = "__init_greeting__" not in low
    ok = has_name and no_literal_echo and (has_appuntamenti or has_fiere)
    record(
        "POST /api/ai/chat __INIT_GREETING__ (colloquial + context)",
        ok,
        f"has_marco={has_name} has_appunti={has_appuntamenti} has_fiere={has_fiere} no_echo={no_literal_echo}\n        response={resp[:500]}",
    )


def main():
    print(f"Testing against: {API}")
    print("=" * 80)
    test_root()
    test_weather()
    test_distance()
    test_ai_context_freshness()
    test_init_greeting()
    print("=" * 80)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    total = len(RESULTS)
    print(f"RESULT: {passed}/{total} passed")
    for name, ok, _ in RESULTS:
        print(f"  {'PASS' if ok else 'FAIL'} — {name}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
