"""
Backend API test for MarketMate.
Tests the endpoints as per review request.
"""
import os
import json
import requests
from pathlib import Path


def load_backend_url():
    env_path = Path('/app/frontend/.env')
    for line in env_path.read_text().splitlines():
        if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
            return line.split('=', 1)[1].strip().strip('"')
    raise RuntimeError('EXPO_PUBLIC_BACKEND_URL not found')


BASE_URL = load_backend_url().rstrip('/') + '/api'
print(f"Testing backend at: {BASE_URL}\n")

results = []


def record(name, ok, detail):
    status = "SUCCESS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}\n")
    results.append((name, ok, detail))


# 1. POST /api/distance/calculate
def test_distance():
    try:
        r = requests.post(
            f"{BASE_URL}/distance/calculate",
            json={"partenza": "Roma", "destinazione": "Milano"},
            timeout=30,
        )
        if r.status_code != 200:
            return record("distance/calculate", False, f"HTTP {r.status_code} body={r.text[:200]}")
        data = r.json()
        ok = (
            isinstance(data, dict)
            and 'success' in data
            and 'km_andata_ritorno' in data
            and data.get('success') is True
            and data.get('km_andata_ritorno', 0) > 0
        )
        return record("distance/calculate", ok, f"status=200 success={data.get('success')} km={data.get('km')} km_ar={data.get('km_andata_ritorno')} msg={data.get('message')}")
    except Exception as e:
        return record("distance/calculate", False, f"Exception: {e}")


# 2. POST /api/weather
# NOTE: The backend endpoint expects {"citta": ...} per WeatherRequest model,
# not {"lat":..,"lon":..,"date":..}. Test both the requested payload and the
# actual backend contract.
def test_weather():
    # Requested payload (per review)
    try:
        r = requests.post(
            f"{BASE_URL}/weather",
            json={"lat": 41.9, "lon": 12.5, "date": "2025-06-15"},
            timeout=30,
        )
        detail1 = f"payload=lat/lon/date -> HTTP {r.status_code} body={r.text[:200]}"
    except Exception as e:
        detail1 = f"payload=lat/lon/date -> Exception: {e}"
        r = None

    # Backend-contract payload (citta)
    try:
        r2 = requests.post(
            f"{BASE_URL}/weather",
            json={"citta": "Roma"},
            timeout=30,
        )
        if r2.status_code == 200:
            data = r2.json()
            ok2 = data.get('success') is True
            detail2 = f"payload=citta -> HTTP 200 success={data.get('success')} temp={data.get('temperatura')} desc={data.get('descrizione')}"
        else:
            ok2 = False
            detail2 = f"payload=citta -> HTTP {r2.status_code} body={r2.text[:200]}"
    except Exception as e:
        ok2 = False
        detail2 = f"payload=citta -> Exception: {e}"

    ok = (r is not None and r.status_code == 200) or ok2
    return record("weather", ok, f"{detail1} | {detail2}")


# 3. POST /api/fuel/cheapest
def test_fuel():
    try:
        r = requests.post(
            f"{BASE_URL}/fuel/cheapest",
            json={"partenza": "Roma", "destinazione": "Milano", "tipo_carburante": "benzina"},
            timeout=90,
        )
        if r.status_code != 200:
            return record("fuel/cheapest", False, f"HTTP {r.status_code} body={r.text[:200]}")
        data = r.json()
        # HTTP 200 is sufficient per request, even if success=False (no stations)
        return record("fuel/cheapest", True, f"status=200 success={data.get('success')} country={data.get('country')} stations={len(data.get('stations', []))} msg={data.get('message')}")
    except Exception as e:
        return record("fuel/cheapest", False, f"Exception: {e}")


# 4. POST /api/ai/chat
def test_ai_chat():
    context = json.dumps({
        "nomeTitolare": "Mario",
        "fiereProssime": [
            {"nome": "Fiera di San Magno", "data": "2025-06-20", "luogo": "Roma", "tipologia": "Fiera"}
        ],
        "appuntiProssimi": [
            {"testo": "Commercialista", "data": "2025-06-17"}
        ],
        "ordiniProssimi": [
            {"testo": "Andrea Pane", "data": "2025-06-19"}
        ],
    }, ensure_ascii=False)

    try:
        r = requests.post(
            f"{BASE_URL}/ai/chat",
            json={
                "message": "Buongiorno!",
                "session_id": "test_mm_bell_001",
                "context": context,
            },
            timeout=90,
        )
        if r.status_code != 200:
            return record("ai/chat", False, f"HTTP {r.status_code} body={r.text[:300]}")
        data = r.json()
        response_text = data.get('response', '') or ''
        lower = response_text.lower()
        hits = []
        for kw in ["san magno", "commercialista", "andrea pane"]:
            if kw in lower:
                hits.append(kw)
        ok = len(hits) >= 1
        detail = f"status=200 session_id={data.get('session_id')} hits={hits} resp_excerpt={response_text[:400]!r}"
        return record("ai/chat", ok, detail)
    except Exception as e:
        return record("ai/chat", False, f"Exception: {e}")


if __name__ == "__main__":
    test_distance()
    test_weather()
    test_fuel()
    test_ai_chat()

    print("\n================ SUMMARY ================")
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} - {name}")
    failed = [n for n, ok, _ in results if not ok]
    print(f"\nTotal: {len(results)}, Failed: {len(failed)}")
    if failed:
        raise SystemExit(1)
