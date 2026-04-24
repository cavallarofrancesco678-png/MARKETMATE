#!/usr/bin/env python3
"""Regression test after ripartizione costo + Buongiorno AI senza messaggio init."""
import json
import requests

BASE_URL = "https://marketmate-hub-1.preview.emergentagent.com/api"

def test_ai_chat_init_greeting():
    print("\n" + "="*80)
    print("TEST 1: POST /api/ai/chat - __INIT_GREETING__ con contesto Marco/Roma/Frascati")
    print("="*80)
    context = {
        "nomeTitolare": "Marco",
        "mercatoOggi": "Roma",
        "partenzaDa": "Frascati",
        "fiereProssime": [{"nome": "Sagra del Pane", "data": "Mar 25 Giu", "luogo": "Alba"}],
        "appuntiProssimi": [{"data": "Mer 26 Giu", "testo": "Commercialista", "luogo": "Milano"}]
    }
    payload = {
        "message": "__INIT_GREETING__",
        "session_id": "init_test_001",
        "context": json.dumps(context, ensure_ascii=False)
    }
    try:
        r = requests.post(f"{BASE_URL}/ai/chat", json=payload, timeout=60)
        print(f"HTTP status: {r.status_code}")
        if r.status_code != 200:
            print(f"Body: {r.text[:500]}")
            return False
        data = r.json()
        resp_text = data.get("response", "")
        print(f"session_id: {data.get('session_id')}")
        print(f"--- AI response ---\n{resp_text}\n-------------------")

        checks = {
            "Contains 'Marco'": "Marco" in resp_text,
            "Mentions 'Sagra del Pane' OR 'Alba'": ("Sagra del Pane" in resp_text) or ("Alba" in resp_text),
            "Mentions 'Commercialista' OR 'Milano'": ("Commercialista" in resp_text.lower() or "commercialista" in resp_text.lower()) or ("Milano" in resp_text),
            "Is colloquial (no 'Rispondo a: INIT_GREETING')": "Rispondo a: INIT_GREETING" not in resp_text and "INIT_GREETING" not in resp_text,
        }
        all_ok = True
        for k, v in checks.items():
            print(f"  [{'OK' if v else 'FAIL'}] {k}")
            if not v:
                all_ok = False
        return all_ok
    except Exception as e:
        print(f"Exception: {e}")
        return False


def test_distance():
    print("\n" + "="*80)
    print("TEST 2: POST /api/distance/calculate Roma->Napoli")
    print("="*80)
    try:
        r = requests.post(f"{BASE_URL}/distance/calculate",
                          json={"partenza": "Roma", "destinazione": "Napoli"},
                          timeout=30)
        print(f"HTTP status: {r.status_code}")
        print(f"Body: {r.text[:300]}")
        return r.status_code == 200
    except Exception as e:
        print(f"Exception: {e}")
        return False


def test_weather():
    print("\n" + "="*80)
    print("TEST 3: POST /api/weather citta=Torino")
    print("="*80)
    try:
        r = requests.post(f"{BASE_URL}/weather",
                          json={"citta": "Torino"},
                          timeout=30)
        print(f"HTTP status: {r.status_code}")
        print(f"Body: {r.text[:300]}")
        return r.status_code == 200
    except Exception as e:
        print(f"Exception: {e}")
        return False


if __name__ == "__main__":
    r1 = test_ai_chat_init_greeting()
    r2 = test_distance()
    r3 = test_weather()
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"1) AI Chat __INIT_GREETING__  : {'SUCCESS' if r1 else 'FAIL'}")
    print(f"2) Distance Roma->Napoli      : {'SUCCESS' if r2 else 'FAIL'}")
    print(f"3) Weather Torino             : {'SUCCESS' if r3 else 'FAIL'}")
