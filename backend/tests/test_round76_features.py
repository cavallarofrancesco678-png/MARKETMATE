"""
Round 76 — backend validation
FIX 1: POST /api/weather returns temperatura_mattina_min / temperatura_mattina_max
       and 'message' contains 'mattino X-Y°C' / 'mattino X–Y°C'.
FIX 3: POST /api/ai/chat with message "__INIT_GREETING__" must NOT contain
       forbidden keywords (Confcommercio, FIVA, bandi, vacanze estive, calendario
       scolastico, "Bilancio del giorno", "Più dati inserisci", "Suggerimento extra").
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─────────────────────────────  FIX 1 — WEATHER  ─────────────────────────────

class TestWeatherMorningRange:
    """POST /api/weather should expose temperatura_mattina_min/max and embed
    the morning range (06:00–13:00) in the 'message' string."""

    @pytest.mark.parametrize("citta", ["Parabiago", "Magenta"])
    def test_weather_includes_morning_range_today(self, api_client, citta):
        resp = api_client.post(f"{BASE_URL}/api/weather", json={"citta": citta}, timeout=20)
        assert resp.status_code == 200, f"weather endpoint returned {resp.status_code}"
        data = resp.json()
        assert data.get("success") is True, f"weather not success: {data}"

        # Both new fields present and numeric
        assert "temperatura_mattina_min" in data, "missing temperatura_mattina_min"
        assert "temperatura_mattina_max" in data, "missing temperatura_mattina_max"
        tmin = data["temperatura_mattina_min"]
        tmax = data["temperatura_mattina_max"]
        assert isinstance(tmin, (int, float)), f"min not numeric: {tmin!r}"
        assert isinstance(tmax, (int, float)), f"max not numeric: {tmax!r}"
        assert tmin <= tmax, f"morning min ({tmin}) > max ({tmax})"

        # Message must contain "mattino" + the two numbers (allow en-dash or hyphen)
        msg = data.get("message", "")
        assert "mattino" in msg.lower(), f"'mattino' not in message: {msg}"
        # values should appear in the message
        assert str(tmin) in msg, f"min {tmin} missing from message: {msg}"
        assert str(tmax) in msg, f"max {tmax} missing from message: {msg}"


# ─────────────────────────────  FIX 3 — AI BRIEFING  ─────────────────────────

FORBIDDEN_KEYWORDS = [
    "Confcommercio",
    "FIVA",
    "bandi",
    "vacanze estive",
    "calendario scolastico",
    "Bilancio del giorno",
    "Più dati inserisci",
    "Suggerimento extra",
]


class TestInitGreetingBriefing:
    """Briefing on __INIT_GREETING__ must be limited to 3 voci (meteo, distributore,
    ordini). NONE of the forbidden keywords may appear."""

    def _post_init_greeting(self, api_client, device_id="t1_round76_briefing"):
        payload = {
            "message": "__INIT_GREETING__",
            "device_id": device_id,
            "context": "",
        }
        r = api_client.post(f"{BASE_URL}/api/ai/chat", json=payload, timeout=60)
        return r

    def test_init_greeting_status_and_payload(self, api_client):
        r = self._post_init_greeting(api_client)
        assert r.status_code == 200, f"AI chat returned {r.status_code}: {r.text[:300]}"
        body = r.json()
        # Response can be either 'response' or 'message' depending on impl
        text = body.get("response") or body.get("message") or body.get("reply") or ""
        assert text, f"empty AI response body: {body}"

    def test_init_greeting_has_no_forbidden_keywords(self, api_client):
        r = self._post_init_greeting(api_client, device_id="t1_round76_forbidden")
        assert r.status_code == 200
        body = r.json()
        text = (body.get("response") or body.get("message") or body.get("reply") or "")
        text_low = text.lower()
        leaks = [kw for kw in FORBIDDEN_KEYWORDS if kw.lower() in text_low]
        assert not leaks, (
            f"FORBIDDEN keywords found in __INIT_GREETING__ response: {leaks}\n"
            f"---FULL RESPONSE---\n{text}\n-------------------"
        )

    def test_init_greeting_is_short(self, api_client):
        """Briefing should be max ~6-7 lines (we allow 9 lines safety margin)."""
        r = self._post_init_greeting(api_client, device_id="t1_round76_lenght")
        assert r.status_code == 200
        body = r.json()
        text = (body.get("response") or body.get("message") or body.get("reply") or "")
        non_empty_lines = [ln for ln in text.splitlines() if ln.strip()]
        assert len(non_empty_lines) <= 9, (
            f"Briefing too long ({len(non_empty_lines)} non-empty lines, expected <=9):\n{text}"
        )
