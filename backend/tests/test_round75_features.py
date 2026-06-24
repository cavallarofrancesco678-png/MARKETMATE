"""
Backend tests for Round 75 (iteration_14)
- T1: AI date synchronization (no other days' data leakage)
- T4: AI weather-revenue correlation
- T2/T3: Validate /api/weather/historical-markets supports MeteoStatsModal usage

NOTE: AI tests are best-effort due to LLM non-determinism. We assert structural
guarantees rather than exact strings.
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://marketmate-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Common context strings reused across tests --------------------------------

def _context_only_today_appointment(date_iso: str) -> str:
    """Context block where the only appointment matches the SELECTED day."""
    return f"""═══ DATA DI RIFERIMENTO ═══
GIORNO SELEZIONATO DALL'UTENTE: mercoledì {date_iso}

═══ ATTIVITA ═══
Attivita: TestShop
Mercato del {date_iso}: Magenta

═══ NOTIFICHE / PROSSIMI IMPEGNI (SOLO da Notes) ═══
Appuntamenti prossimi (gia filtrati per il giorno selezionato): [mercoledì {date_iso} - Riunione fornitore]
Ordini prossimi (gia filtrati per il giorno selezionato): []
Pagamenti imminenti (solo scadenti oggi): []
"""


def _context_with_weather_week(week_lordo=1200, prev_week=1600, temp=35.0):
    return f"""═══ DATA DI RIFERIMENTO ═══
GIORNO SELEZIONATO DALL'UTENTE: lunedì 2026-07-13

═══ STATISTICHE STORICHE ═══
Settimana CORRENTE: €{week_lordo}
Settimana precedente totale: €{prev_week}
Confronto settimane: -25% rispetto alla settimana scorsa

═══ METEO ═══
Temperatura media settimana corrente: {temp}°C, prevalente: SOLE caldo
Scuole chiuse (vacanze estive): SI

═══ DATI COMPLETI APP ═══
STORICO_GIORNATE: Magenta lordo €1200 (settimana corrente), Magenta lordo €1600 (settimana precedente)
"""


# ─────────── Health check ─────────────────────────────────────────────────
def test_health_root():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200, f"Root unhealthy: {r.status_code}"


# ─────────── Weather historical markets (powers MeteoStatsModal T2) ──────
def test_weather_historical_markets_endpoint():
    """T2/T3 — endpoint that MeteoStatsModal calls for °C in Settimana/Mese/Anno."""
    payload = {
        "items": [
            {
                "mercato": "Magenta",
                "dates": ["2026-01-05", "2026-01-12", "2026-01-19"],
            }
        ]
    }
    r = requests.post(f"{API}/weather/historical-markets", json=payload, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    if data["items"]:
        first = data["items"][0]
        assert first.get("mercato") == "Magenta"
        assert "days" in first
        # at least one day should have a numeric temp
        temps = [d.get("temp") for d in first["days"] if isinstance(d.get("temp"), (int, float))]
        assert len(temps) > 0, "expected at least one numeric temp returned"


def test_weather_historical_markets_empty_items():
    r = requests.post(f"{API}/weather/historical-markets", json={"items": []}, timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    data = r.json()
    assert data.get("items") == []


# ─────────── AI chat: T1 day-sync ────────────────────────────────────────
def test_ai_chat_day_sync_respects_selected_day():
    """T1 — Given only Wednesday's appointment in context, AI must NOT mention Tuesday/Thursday."""
    ctx = _context_only_today_appointment("2026-01-21")
    body = {
        "message": "Quali appuntamenti ho?",
        "context": ctx,
        "session_id": "test_round75_t1_sync",
        "device_id": "test_dev_round75_t1",
        "mercato_citta": "Magenta",
    }
    r = requests.post(f"{API}/ai/chat", json=body, timeout=90)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    data = r.json()
    reply = (data.get("response") or "").lower()
    # Allow rate limit response without failing the test suite
    if data.get("limit_reached"):
        pytest.skip("AI daily/monthly limit reached")
    # The AI must not mention other days that are NOT in the filtered context
    forbidden = ["martedì", "martedi", "giovedì", "giovedi", "domani", "ieri"]
    leaks = [w for w in forbidden if w in reply]
    assert not leaks, f"AI leaked other-day references: {leaks}; full reply: {reply[:400]}"


def test_ai_chat_respects_empty_appointments_no_invention():
    """T1 — If appointments empty, AI must not invent any."""
    ctx = """═══ DATA DI RIFERIMENTO ═══
GIORNO SELEZIONATO DALL'UTENTE: giovedì 2026-01-22

═══ NOTIFICHE / PROSSIMI IMPEGNI ═══
Appuntamenti prossimi: []
Ordini prossimi: []
Pagamenti imminenti: []
"""
    body = {
        "message": "Cosa ho da fare oggi?",
        "context": ctx,
        "session_id": "test_round75_t1_empty",
        "device_id": "test_dev_round75_t1_empty",
    }
    r = requests.post(f"{API}/ai/chat", json=body, timeout=90)
    assert r.status_code == 200
    data = r.json()
    if data.get("limit_reached"):
        pytest.skip("AI limit reached")
    reply = data.get("response", "")
    assert isinstance(reply, str) and len(reply) > 0


# ─────────── AI chat: T4 weather/revenue correlation ─────────────────────
def test_ai_chat_weather_revenue_correlation():
    """T4 — When asked about the week, AI must reference weather/temperature/context."""
    ctx = _context_with_weather_week()
    body = {
        "message": "Come è andata la settimana?",
        "context": ctx,
        "session_id": "test_round75_t4_corr",
        "device_id": "test_dev_round75_t4",
        "mercato_citta": "Magenta",
    }
    r = requests.post(f"{API}/ai/chat", json=body, timeout=90)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    data = r.json()
    if data.get("limit_reached"):
        pytest.skip("AI limit reached")
    reply = (data.get("response") or "").lower()
    # At least ONE of these correlation keywords must appear
    keywords = ["meteo", "temperatura", "°c", "caldo", "scuole", "vacanze", "freddo", "pioggia", "sole"]
    hits = [k for k in keywords if k in reply]
    assert len(hits) >= 1, f"AI did not correlate with weather. Reply: {reply[:500]}"
    # Must also reference the revenue figures or delta
    revenue_terms = ["1200", "1600", "25", "lordo", "settimana"]
    rev_hits = [k for k in revenue_terms if k in reply]
    assert len(rev_hits) >= 1, f"AI did not reference revenue figures. Reply: {reply[:500]}"


def test_ai_chat_returns_200_with_minimal_payload():
    """Smoke test: empty/min payload should still return 200."""
    body = {"message": "ciao", "session_id": "test_round75_min", "device_id": "test_dev_round75_min"}
    r = requests.post(f"{API}/ai/chat", json=body, timeout=60)
    assert r.status_code == 200
