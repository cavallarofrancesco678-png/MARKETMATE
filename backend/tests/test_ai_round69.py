"""Round 69 — Test deduzione provincia da mercati_lista + accuratezza bandi.

Verifica:
  1. ChatRequest accetta `mercati_lista` (compatibilità retroattiva)
  2. La risposta dell'AI a una domanda di bandi NON dice "configura la provincia in impostazioni"
  3. La regione viene dedotta dalla lista mercati anche quando mercato_citta è vuoto

Run: cd /app/backend && python -m pytest tests/test_ai_round69.py -v
"""
import os
import httpx
import pytest
import asyncio

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

BASE = "http://localhost:8001/api"
DEVICE = "pytest_r69_dev"


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


def test_chat_accepts_mercati_lista_field(db):
    """Lo schema ChatRequest accetta mercati_lista come campo opzionale."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "__PING__",
        "session_id": "pytest_r69_lista",
        "device_id": DEVICE,
        "mercati_lista": "Milano|Monza|Lodi",
    }, timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert "response" in body
    _clean(db)


def test_ai_does_not_ask_to_configure_province(db):
    """Quando l'utente chiede bandi e mercati_lista è popolato,
    l'AI NON deve dire 'configura la provincia in impostazioni'."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "Ci sono bandi o convenzioni interessanti che posso usare?",
        "session_id": "pytest_r69_noask",
        "device_id": DEVICE,
        "mercato_citta": "",  # Nessuna città oggi
        "mercati_lista": "Milano|Monza|Bergamo",  # Ma ci sono mercati Lombardia
        "settore": "Alimentare",
    }, timeout=60)
    assert r.status_code == 200
    text = r.json().get("response", "").lower()
    # NON deve invitare a configurare la provincia in impostazioni
    forbidden = [
        "configura la provincia",
        "imposta la provincia",
        "vai in impostazioni",
        "imposta in settings",
        "indicami la provincia",
        "dimmi la provincia",
        "specifica la provincia",
        "in impostazioni → ",
    ]
    matches = [f for f in forbidden if f in text]
    assert len(matches) == 0, (
        f"AI ha chiesto di configurare la provincia (errore!): {matches}\n"
        f"Risposta: {text[:500]}"
    )
    _clean(db)


def test_ai_cites_lombardia_when_lista_milano(db):
    """La provincia dedotta da Milano|Monza|Bergamo deve emergere nei consigli."""
    _clean(db)
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "Quali convenzioni posso sfruttare per la mia zona?",
        "session_id": "pytest_r69_dedotta",
        "device_id": DEVICE,
        "mercato_citta": "",
        "mercati_lista": "Milano|Monza|Bergamo",
        "settore": "Alimentare",
    }, timeout=60)
    assert r.status_code == 200
    text = r.json().get("response", "").lower()
    # Deve menzionare almeno una di: Milano, Monza, Bergamo, Lombardia
    territorial = ["milano", "monza", "bergamo", "lombardia", "milanese"]
    matched = [k for k in territorial if k in text]
    assert len(matched) >= 1, (
        f"AI non ha usato il territorio dedotto dai mercati. Risposta: {text[:500]}"
    )
    _clean(db)
