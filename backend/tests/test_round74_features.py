"""Tests for Round 74 features:
- TASK 3: POST /api/weather/historical-markets (avg morning temperature 06-13)
- TASK 4: AI memory endpoints + auto-detect "ricorda che X" in /api/ai/chat
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           "https://marketmate-hub-1.preview.emergentagent.com"


# ─────── TASK 3 — Weather Historical Markets ───────

class TestWeatherHistoricalMarkets:
    def test_endpoint_returns_200_with_valid_input(self):
        payload = {
            "items": [
                {"mercato": "Magenta", "dates": ["2025-06-15", "2025-06-22"]}
            ]
        }
        r = requests.post(f"{BASE_URL}/api/weather/historical-markets",
                          json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert len(data["items"]) == 1

    def test_response_schema_avg_temp_morning_present(self):
        payload = {"items": [{"mercato": "Magenta", "dates": ["2025-06-15", "2025-06-22"]}]}
        r = requests.post(f"{BASE_URL}/api/weather/historical-markets",
                          json=payload, timeout=30)
        item = r.json()["items"][0]
        # Required fields
        for f in ("mercato", "avg_temp_morning", "sample_size", "days", "lat", "lon"):
            assert f in item, f"missing field: {f}"
        assert item["mercato"] == "Magenta"

    def test_magenta_june_temperature_realistic(self):
        """Magenta (MI) average morning temp Jun 15-22 2025 should be ~20-30°C."""
        payload = {"items": [{"mercato": "Magenta", "dates": ["2025-06-15", "2025-06-22"]}]}
        r = requests.post(f"{BASE_URL}/api/weather/historical-markets",
                          json=payload, timeout=30)
        item = r.json()["items"][0]
        assert item.get("error") in (None, ""), f"unexpected error: {item.get('error')}"
        assert item["sample_size"] >= 1
        avg = item["avg_temp_morning"]
        assert avg is not None
        assert 15.0 <= avg <= 32.0, f"temperature {avg} out of realistic range"
        assert len(item["days"]) >= 1
        for d in item["days"]:
            assert "date" in d and "temp" in d

    def test_unknown_market_returns_error_field(self):
        payload = {"items": [{"mercato": "Xyzzqxqq__nope", "dates": ["2025-06-15"]}]}
        r = requests.post(f"{BASE_URL}/api/weather/historical-markets",
                          json=payload, timeout=30)
        assert r.status_code == 200
        item = r.json()["items"][0]
        assert item["avg_temp_morning"] is None
        assert item["error"]  # non-empty error string

    def test_multiple_markets_in_one_call(self):
        payload = {
            "items": [
                {"mercato": "Magenta", "dates": ["2025-06-15"]},
                {"mercato": "Milano", "dates": ["2025-06-15"]},
            ]
        }
        r = requests.post(f"{BASE_URL}/api/weather/historical-markets",
                          json=payload, timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 2


# ─────── TASK 4 — AI Persistent Memory ───────

@pytest.fixture
def device_id():
    """Unique device per test, cleaned up after."""
    did = f"test_{uuid.uuid4().hex[:10]}"
    yield did
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/api/ai/memory", params={"device_id": did}, timeout=10)
    except Exception:
        pass


class TestAIMemoryEndpoints:
    def test_memory_add_persists_and_get_returns_item(self, device_id):
        # ADD
        r = requests.post(f"{BASE_URL}/api/ai/memory/add",
                          json={"device_id": device_id,
                                "text": "preferisco senza zucchero"},
                          timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("text") == "preferisco senza zucchero"

        # GET
        r2 = requests.get(f"{BASE_URL}/api/ai/memory",
                          params={"device_id": device_id}, timeout=15)
        assert r2.status_code == 200
        items = r2.json().get("items", [])
        assert len(items) == 1
        assert items[0].get("text") == "preferisco senza zucchero"
        assert "created_at" in items[0]

    def test_memory_add_multiple_appends(self, device_id):
        for t in ("memoria uno", "memoria due", "memoria tre"):
            r = requests.post(f"{BASE_URL}/api/ai/memory/add",
                              json={"device_id": device_id, "text": t}, timeout=15)
            assert r.status_code == 200
        items = requests.get(f"{BASE_URL}/api/ai/memory",
                             params={"device_id": device_id}, timeout=15).json()["items"]
        assert len(items) == 3
        assert [i["text"] for i in items] == ["memoria uno", "memoria due", "memoria tre"]

    def test_memory_delete_clears_all(self, device_id):
        requests.post(f"{BASE_URL}/api/ai/memory/add",
                      json={"device_id": device_id, "text": "tmp"}, timeout=15)
        r = requests.delete(f"{BASE_URL}/api/ai/memory",
                            params={"device_id": device_id}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        items = requests.get(f"{BASE_URL}/api/ai/memory",
                             params={"device_id": device_id}, timeout=15).json()["items"]
        assert items == []

    def test_memory_missing_device_id_returns_error(self):
        r = requests.post(f"{BASE_URL}/api/ai/memory/add",
                          json={"device_id": "", "text": "x"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is False

    def test_memory_unknown_device_returns_empty(self):
        did = f"never_used_{uuid.uuid4().hex[:6]}"
        r = requests.get(f"{BASE_URL}/api/ai/memory",
                         params={"device_id": did}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("items") == []


class TestAIChatAutoMemory:
    """Verify that /api/ai/chat auto-saves memory when user writes 'ricorda che X'."""

    def test_chat_ricorda_che_autosaves_memory(self, device_id):
        # Use a unique distinctive text so we can find it in stored memories.
        marker = f"mariofrutta{uuid.uuid4().hex[:6]}"
        payload = {
            "message": f"Ricorda che il mio fornitore frutta e' {marker}",
            "session_id": f"sess_{device_id}",
            "device_id": device_id,
        }
        r = requests.post(f"{BASE_URL}/api/ai/chat", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        # Even if AI errors, the memory save runs BEFORE the LLM call.

        # GET memories
        items = requests.get(f"{BASE_URL}/api/ai/memory",
                             params={"device_id": device_id}, timeout=15).json()["items"]
        assert len(items) >= 1
        joined = " | ".join(i.get("text", "") for i in items)
        assert marker in joined, f"marker '{marker}' not found in memories: {joined}"

    def test_chat_memorizza_trigger(self, device_id):
        marker = f"tagxyz{uuid.uuid4().hex[:6]}"
        payload = {
            "message": f"memorizza che il tag e' {marker}",
            "session_id": f"sess_{device_id}",
            "device_id": device_id,
        }
        r = requests.post(f"{BASE_URL}/api/ai/chat", json=payload, timeout=60)
        assert r.status_code == 200
        items = requests.get(f"{BASE_URL}/api/ai/memory",
                             params={"device_id": device_id}, timeout=15).json()["items"]
        joined = " | ".join(i.get("text", "") for i in items)
        assert marker in joined

    def test_chat_no_trigger_does_not_save(self, device_id):
        payload = {
            "message": "Ciao, come stai oggi?",
            "session_id": f"sess_{device_id}",
            "device_id": device_id,
        }
        r = requests.post(f"{BASE_URL}/api/ai/chat", json=payload, timeout=60)
        assert r.status_code == 200
        items = requests.get(f"{BASE_URL}/api/ai/memory",
                             params={"device_id": device_id}, timeout=15).json()["items"]
        assert items == [], f"expected no memory saved, got: {items}"
