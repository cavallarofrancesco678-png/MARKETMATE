"""
MarketMate backend regression tests (round 2).

Focus:
1. POST /api/weather without `data` -> today's weather, must NOT fail with 422.
2. POST /api/weather with future `data` (today+3) -> forecast.
3. POST /api/weather with past `data` (today-30) -> archive.
4. Regression: GET /api/, POST /api/distance/calculate, POST /api/ai/chat (context mentions Marco).
"""

import os
import sys
import json
from datetime import datetime, timedelta, date

import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL")
if not BASE:
    print("ERROR: No backend URL found in /app/frontend/.env")
    sys.exit(2)
API = f"{BASE.rstrip('/')}/api"

print(f"Using API base: {API}\n" + "=" * 60)

results = []  # list of (name, passed, detail)


def check(name, passed, detail=""):
    print(f"[{'PASS' if passed else 'FAIL'}] {name}: {detail}")
    results.append((name, passed, detail))


def safe_json(r):
    try:
        return r.json()
    except Exception:
        return {"_raw": r.text[:300]}


# ---------------- 1) Weather TODAY (no data field) -----------------
print("\n--- 1) Weather TODAY (no data field) ---")
try:
    r = requests.post(f"{API}/weather", json={"citta": "Roma"}, timeout=30)
    body = safe_json(r)
    print(f"  status={r.status_code}")
    print(f"  body={json.dumps(body, ensure_ascii=False)[:500]}")
    if r.status_code == 422:
        check("weather_today_no_data", False, "Got HTTP 422 - `data` is NOT optional")
    elif r.status_code != 200:
        check("weather_today_no_data", False, f"HTTP {r.status_code}")
    else:
        today_str = date.today().strftime("%Y-%m-%d")
        ok = (
            body.get("success") is True
            and "temperatura" in body
            and "descrizione" in body
            and "vento_kmh" in body
            and body.get("data") == today_str
        )
        check(
            "weather_today_no_data",
            ok,
            f"success={body.get('success')} temp={body.get('temperatura')} desc={body.get('descrizione')!r} vento={body.get('vento_kmh')} data={body.get('data')} (expected {today_str})"
        )
except Exception as e:
    check("weather_today_no_data", False, f"Exception: {e}")


# ---------------- 2) Weather FORECAST (today+3) -----------------
print("\n--- 2) Weather FORECAST (today+3) ---")
future_str = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
try:
    r = requests.post(f"{API}/weather", json={"citta": "Milano", "data": future_str}, timeout=30)
    body = safe_json(r)
    print(f"  status={r.status_code}")
    print(f"  body={json.dumps(body, ensure_ascii=False)[:500]}")
    if r.status_code != 200:
        check("weather_forecast_future", False, f"HTTP {r.status_code}")
    else:
        ok_data = body.get("data") == future_str
        ok_success = body.get("success") is True
        tmax = body.get("temperatura_max")
        tmin = body.get("temperatura_min")
        ok_tmax = isinstance(tmax, (int, float))
        ok_tmin = isinstance(tmin, (int, float))
        ok_desc = bool((body.get("descrizione") or "").strip())
        ok = ok_success and ok_data and ok_tmax and ok_tmin and ok_desc
        check(
            "weather_forecast_future",
            ok,
            f"success={body.get('success')} data={body.get('data')} (expected {future_str}) tmax={tmax} tmin={tmin} desc={body.get('descrizione')!r}"
        )
except Exception as e:
    check("weather_forecast_future", False, f"Exception: {e}")


# ---------------- 3) Weather ARCHIVE (today-30) -----------------
print("\n--- 3) Weather ARCHIVE (today-30) ---")
past_str = (date.today() - timedelta(days=30)).strftime("%Y-%m-%d")
try:
    r = requests.post(f"{API}/weather", json={"citta": "Torino", "data": past_str}, timeout=30)
    body = safe_json(r)
    print(f"  status={r.status_code}")
    print(f"  body={json.dumps(body, ensure_ascii=False)[:500]}")
    if r.status_code != 200:
        check("weather_archive_past", False, f"HTTP {r.status_code}")
    else:
        ok_data = body.get("data") == past_str
        ok_success = body.get("success") is True
        tmax = body.get("temperatura_max")
        tmin = body.get("temperatura_min")
        ok_tmax = isinstance(tmax, (int, float))
        ok_tmin = isinstance(tmin, (int, float))
        ok = ok_success and ok_data and ok_tmax and ok_tmin
        check(
            "weather_archive_past",
            ok,
            f"success={body.get('success')} data={body.get('data')} (expected {past_str}) tmax={tmax} tmin={tmin}"
        )
except Exception as e:
    check("weather_archive_past", False, f"Exception: {e}")


# ---------------- 4) Regressions -----------------
print("\n--- 4a) GET /api/ ---")
try:
    r = requests.get(f"{API}/", timeout=15)
    body = safe_json(r)
    print(f"  status={r.status_code} body={body}")
    ok = r.status_code == 200 and body.get("message") == "Hello World"
    check("hello_world", ok, f"status={r.status_code} body={body}")
except Exception as e:
    check("hello_world", False, f"Exception: {e}")

print("\n--- 4b) POST /api/distance/calculate Roma->Milano ---")
try:
    r = requests.post(f"{API}/distance/calculate",
                      json={"partenza": "Roma", "destinazione": "Milano"},
                      timeout=30)
    body = safe_json(r)
    print(f"  status={r.status_code} body={body}")
    ok = r.status_code == 200 and body.get("success") is True and (body.get("km") or 0) > 0
    check("distance_roma_milano", ok, f"km={body.get('km')} A/R={body.get('km_andata_ritorno')}")
except Exception as e:
    check("distance_roma_milano", False, f"Exception: {e}")

print("\n--- 4c) POST /api/ai/chat 'Buongiorno' with context Marco ---")
try:
    r = requests.post(f"{API}/ai/chat",
                      json={
                          "message": "Buongiorno",
                          "session_id": "test_round2",
                          "context": "nomeTitolare: Marco\nmercatoOggi: Roma"
                      },
                      timeout=60)
    body = safe_json(r)
    resp = (body.get("response") or "")
    print(f"  status={r.status_code} response[:300]={resp[:300]}")
    ok = r.status_code == 200 and "Marco" in resp
    check("ai_chat_marco", ok, f"contains Marco={('Marco' in resp)} response_len={len(resp)}")
except Exception as e:
    check("ai_chat_marco", False, f"Exception: {e}")

# ---------------- Summary -----------------
print("\n" + "=" * 60)
passed = sum(1 for _, p, _ in results if p)
total = len(results)
print(f"RESULT: {passed}/{total} passed")
for n, p, d in results:
    print(f"  {'OK ' if p else 'KO '} {n}: {d}")
sys.exit(0 if passed == total else 1)
