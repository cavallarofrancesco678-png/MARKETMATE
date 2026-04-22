"""
Regression test v2 after frontend-only changes (Spese Extra Fornitori + Buongiorno Widget).
Backend NOT modified. Verifying 3 endpoints still work.
"""
import os
import json
import sys
import requests

BASE = "https://marketmate-hub-1.preview.emergentagent.com"
API = f"{BASE}/api"

results = []

def test_distance():
    url = f"{API}/distance/calculate"
    payload = {"partenza": "Roma", "destinazione": "Firenze"}
    try:
        r = requests.post(url, json=payload, timeout=30)
        ok = r.status_code == 200
        body = r.json() if r.headers.get("content-type","").startswith("application/json") else r.text
        results.append({
            "test": "POST /api/distance/calculate Roma->Firenze",
            "status_code": r.status_code,
            "ok": ok,
            "body": body,
        })
        return ok
    except Exception as e:
        results.append({"test": "distance", "ok": False, "error": str(e)})
        return False

def test_weather():
    url = f"{API}/weather"
    payload = {"citta": "Torino"}
    try:
        r = requests.post(url, json=payload, timeout=30)
        ok = r.status_code == 200
        body = r.json() if r.headers.get("content-type","").startswith("application/json") else r.text
        results.append({
            "test": "POST /api/weather Torino",
            "status_code": r.status_code,
            "ok": ok,
            "body": body,
        })
        return ok
    except Exception as e:
        results.append({"test": "weather", "ok": False, "error": str(e)})
        return False

def test_ai_chat():
    url = f"{API}/ai/chat"
    context_obj = {
        "nomeTitolare": "Marco",
        "pagamentiImminenti": [
            {
                "fornitore": "Andrea Pane",
                "numeroFattura": "2025/127",
                "importo": 150,
                "scadenza": "2025-06-20",
                "giorniRestanti": 2
            }
        ]
    }
    payload = {
        "message": "Buongiorno!",
        "session_id": "reg_pag_001",
        "context": json.dumps(context_obj, ensure_ascii=False)
    }
    try:
        r = requests.post(url, json=payload, timeout=90)
        ok = r.status_code == 200
        body = r.json() if r.headers.get("content-type","").startswith("application/json") else r.text
        results.append({
            "test": "POST /api/ai/chat Buongiorno w/ pagamentiImminenti",
            "status_code": r.status_code,
            "ok": ok,
            "body": body,
        })
        return ok
    except Exception as e:
        results.append({"test": "ai/chat", "ok": False, "error": str(e)})
        return False

if __name__ == "__main__":
    r1 = test_distance()
    r2 = test_weather()
    r3 = test_ai_chat()
    print(json.dumps(results, indent=2, ensure_ascii=False))
    passed = sum([r1, r2, r3])
    print(f"\n=== {passed}/3 PASSED ===")
    sys.exit(0 if passed == 3 else 1)
