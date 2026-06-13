"""Round 68 — Test regressione: calendario contestuale + funzioni Unione Commercianti.

Verifica:
  1. ChatRequest accetta il nuovo campo `calendario_contestuale` senza errori
  2. La risposta dell'AI (saluto iniziale, con regione+settore) menziona bandi/normative
  3. Quando l'utente chiede esplicitamente "bandi", la risposta cita fonti istituzionali

Run: cd /app/backend && python -m pytest tests/test_ai_round68.py -v
"""
import os
import httpx
import pytest
import asyncio

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

BASE = "http://localhost:8001/api"
DEVICE = "pytest_r68_dev"


@pytest.fixture()
def db():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _clean(db):
    async def f():
        await db.ai_usage.delete_many({"device_id": DEVICE})
    _run(f())


def test_chat_accepts_calendar_context_field(db):
    """Lo schema ChatRequest accetta calendario_contestuale come campo opzionale."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "__PING__",
        "session_id": "pytest_r68_calendar",
        "device_id": DEVICE,
        "calendario_contestuale": "Festività nazionali nel range:\n  • 2026-08-15 → Ferragosto",
    }, timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert "response" in body
    assert "limit_reached" in body
    _clean(db)


def test_chat_with_unione_commercianti_query(db):
    """Domanda esplicita 'bandi' → la risposta dell'AI cita fonti istituzionali."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "Ci sono bandi attivi o convenzioni Unione Commercianti che posso usare?",
        "session_id": "pytest_r68_bandi",
        "device_id": DEVICE,
        "mercato_citta": "Milano",
        "settore": "Alimentare",
    }, timeout=60)
    assert r.status_code == 200
    body = r.json()
    text = body.get("response", "").lower()
    # L'AI deve menzionare almeno una fonte istituzionale tra queste:
    keywords = ["camera di commercio", "regione", "confcommercio", "asco",
                "unione commercianti", "confesercenti", "camcom", "fiva"]
    matched = [k for k in keywords if k in text]
    assert len(matched) >= 1, (
        f"AI non ha citato fonti istituzionali. Risposta: {text[:400]}"
    )
    _clean(db)


def test_calendar_block_is_propagated(db):
    """Quando si invia calendario_contestuale + domanda sulle feste, l'AI cita la data."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "Quando cade Ferragosto e cosa devo aspettarmi dalle vendite?",
        "session_id": "pytest_r68_feste",
        "device_id": DEVICE,
        "mercato_citta": "Milano",
        "settore": "Alimentare",
        "calendario_contestuale": (
            "Festività nazionali nel range:\n"
            "  • 2026-08-15 → Ferragosto\n"
            "Chiusure scolastiche (Lombardia):\n"
            "  • 2026-06-08 → 2026-09-11: Vacanze estive"
        ),
    }, timeout=60)
    assert r.status_code == 200
    text = r.json().get("response", "")
    # La data 15 agosto o "Ferragosto" deve comparire nella risposta
    assert ("15" in text and ("agost" in text.lower() or "ferragost" in text.lower())) \
        or "ferragost" in text.lower(), (
        f"AI non ha usato la data del calendario_contestuale. Risposta: {text[:400]}"
    )
    _clean(db)
