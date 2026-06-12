"""Round 67 — Test regressione: rate limiting AI + lookup regione.

Esegue contro il backend live (porta interna 8001) e MongoDB locale.
Run: cd /app/backend && python -m pytest tests/test_ai_limits.py -v
"""
import os
import asyncio

import httpx
import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

BASE = "http://localhost:8001/api"
DEVICE = "pytest_ai_limit_dev"


@pytest.fixture()
def db():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_daily_limit_blocks_without_llm_call(db):
    """Con 10 messaggi già usati oggi, la chat risponde limit_reached=True."""
    day = datetime.utcnow().strftime('%Y-%m-%d')
    month = datetime.utcnow().strftime('%Y-%m')

    async def seed():
        await db.ai_usage.update_one(
            {"device_id": DEVICE, "day": day},
            {"$set": {"count": 10, "month": month}}, upsert=True)
    _run(seed())

    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "test", "session_id": "pytest_s", "device_id": DEVICE,
    }, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["limit_reached"] is True
    assert "limite giornaliero" in body["response"].lower()

    async def clean():
        await db.ai_usage.delete_many({"device_id": DEVICE})
    _run(clean())


def test_monthly_limit_blocks(db):
    """Con 100 messaggi nel mese (su giorni diversi), blocco mensile."""
    month = datetime.utcnow().strftime('%Y-%m')

    async def seed():
        await db.ai_usage.delete_many({"device_id": DEVICE})
        # 100 messaggi distribuiti su 20 giorni fittizi del mese corrente
        for i in range(20):
            await db.ai_usage.insert_one({
                "device_id": DEVICE, "day": f"{month}-x{i}", "month": month, "count": 5,
            })
    _run(seed())

    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "test", "session_id": "pytest_s2", "device_id": DEVICE,
    }, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["limit_reached"] is True
    assert "limite mensile" in body["response"].lower()

    async def clean():
        await db.ai_usage.delete_many({"device_id": DEVICE})
    _run(clean())


def test_chat_response_has_limit_field():
    """La risposta include sempre il campo limit_reached (anche se key mancante)."""
    r = httpx.post(f"{BASE}/ai/chat", json={
        "message": "__PING__", "session_id": "pytest_s3", "device_id": "pytest_fresh_dev_schema",
    }, timeout=60)
    assert r.status_code == 200
    assert "limit_reached" in r.json()
