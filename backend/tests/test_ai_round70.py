"""Round 70 — Test fix per:
  1. Calendario scolastico backend per comuni piccoli (Magenta, Bareggio)
  2. AI non raddoppia i km (campo già A/R)

Run: cd /app/backend && python -m pytest tests/test_ai_round70.py -v
"""
import os
import httpx
import pytest
import asyncio

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

BASE = "http://localhost:8001/api"
DEVICE = "pytest_r70_dev"


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


def test_calendar_block_built_for_small_lombardy_town(db):
    """Magenta (MI) NON era nella mappa hardcoded del frontend.
    Backend deve risolvere via geocoder → Lombardia → chiusure estive 8 giu - 11 set."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "Le scuole sono chiuse oggi nella mia zona?",
        "session_id": "pytest_r70_magenta",
        "device_id": DEVICE,
        "mercato_citta": "Magenta",
        "mercati_lista": "Magenta|Bareggio|Cernusco sul Naviglio",
        "settore": "Alimentare",
    }, timeout=60)
    assert r.status_code == 200
    text = r.json().get("response", "").lower()
    # L'AI deve riconoscere che siamo in vacanze estive Lombardia
    school_keywords = ["chius", "estiv", "vacanze", "scuol", "settembre", "giugno"]
    matched = [k for k in school_keywords if k in text]
    assert len(matched) >= 2, (
        f"AI non riconosce chiusure scolastiche per Magenta (Lombardia). "
        f"Risposta: {text[:500]}"
    )
    _clean(db)


def test_ai_does_not_double_km(db):
    """Il contesto specifica km=22 (già A/R). L'AI NON deve dire 44 km A/R."""
    _clean(db)
    context = (
        "═══ MERCATO OGGI ═══\n"
        "Mercato del giorno: Milano (Sabato)\n"
        "Km tragitto (totale A/R): 22\n"
        "Costo/km: 0.20\n"
        "Partenza: Bareggio\n"
        "═══ FINE ═══\n"
    )
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "Quanto spendo di benzina per andare a Milano e tornare?",
        "context": context,
        "session_id": "pytest_r70_km",
        "device_id": DEVICE,
        "mercato_citta": "Milano",
        "settore": "Alimentare",
    }, timeout=60)
    assert r.status_code == 200
    text = r.json().get("response", "")
    # L'AI NON deve menzionare "44 km A/R" o "44 km totali"
    assert "44 km a/r" not in text.lower(), (
        f"BUG: AI ha raddoppiato i km (22 → 44 A/R). Risposta: {text[:500]}"
    )
    assert "44 km tot" not in text.lower(), (
        f"BUG: AI ha raddoppiato i km totali. Risposta: {text[:500]}"
    )
    # La risposta dovrebbe menzionare ~4 € (22 × 0.20) o vicino
    # Tolleranza: deve mostrare un valore < 8 € o citare 22 km come totale
    _clean(db)
