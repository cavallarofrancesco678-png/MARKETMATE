"""
Quick backend regression test after frontend-only changes.
Tests 3 endpoints per review request.
"""
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


# 1. POST /api/distance/calculate  Roma -> Napoli
def test_distance():
    try:
        r = requests.post(
            f"{BASE_URL}/distance/calculate",
            json={"partenza": "Roma", "destinazione": "Napoli"},
            timeout=30,
        )
        if r.status_code != 200:
            return record("distance/calculate (Roma->Napoli)", False, f"HTTP {r.status_code} body={r.text[:300]}")
        data = r.json()
        km_ar = data.get('km_andata_ritorno', 0)
        ok = data.get('success') is True and km_ar > 0
        return record(
            "distance/calculate (Roma->Napoli)", ok,
            f"status=200 success={data.get('success')} km={data.get('km')} km_ar={km_ar} msg={data.get('message')}"
        )
    except Exception as e:
        return record("distance/calculate (Roma->Napoli)", False, f"Exception: {e}")


# 2. POST /api/weather  Milano
def test_weather():
    try:
        r = requests.post(
            f"{BASE_URL}/weather",
            json={"citta": "Milano"},
            timeout=30,
        )
        if r.status_code != 200:
            return record("weather (Milano)", False, f"HTTP {r.status_code} body={r.text[:300]}")
        data = r.json()
        temp = data.get('temperatura')
        ok = data.get('success') is True and temp is not None
        return record(
            "weather (Milano)", ok,
            f"status=200 success={data.get('success')} temp={temp} desc={data.get('descrizione')}"
        )
    except Exception as e:
        return record("weather (Milano)", False, f"Exception: {e}")


# 3. POST /api/ai/chat  Buongiorno + Luca + Sagra del Tartufo
def test_ai_chat():
    context = json.dumps({
        "nomeTitolare": "Luca",
        "fiereProssime": [
            {"nome": "Sagra del Tartufo", "data": "2025-06-25", "luogo": "Alba", "tipologia": "Sagra"}
        ],
    }, ensure_ascii=False)

    try:
        r = requests.post(
            f"{BASE_URL}/ai/chat",
            json={
                "message": "Buongiorno",
                "session_id": "reg_test_001",
                "context": context,
            },
            timeout=90,
        )
        if r.status_code != 200:
            return record("ai/chat (Luca/Sagra)", False, f"HTTP {r.status_code} body={r.text[:400]}")
        data = r.json()
        response_text = (data.get('response') or '')
        lower = response_text.lower()
        has_luca = "luca" in lower
        has_sagra = ("sagra del tartufo" in lower) or ("tartufo" in lower) or ("alba" in lower)
        ok = has_luca  # main expectation is Luca; Sagra is "possibly"
        detail = (
            f"status=200 session_id={data.get('session_id')} "
            f"has_luca={has_luca} has_sagra_or_tartufo_or_alba={has_sagra} "
            f"resp_excerpt={response_text[:400]!r}"
        )
        return record("ai/chat (Luca/Sagra)", ok, detail)
    except Exception as e:
        return record("ai/chat (Luca/Sagra)", False, f"Exception: {e}")


if __name__ == "__main__":
    test_distance()
    test_weather()
    test_ai_chat()

    print("\n================ SUMMARY ================")
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} - {name}")
    failed = [n for n, ok, _ in results if not ok]
    print(f"\nTotal: {len(results)}, Failed: {len(failed)}")
    if failed:
        raise SystemExit(1)
