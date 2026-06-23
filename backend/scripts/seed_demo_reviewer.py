"""
═══════════════════════════════════════════════════════════════════════
SEED — Account demo per Google Play reviewer.
═══════════════════════════════════════════════════════════════════════

Crea (o aggiorna) un utente OWNER con subscription Pro attiva valida fino
al 2030, per permettere al recensore Google di provare tutte le feature
senza limiti (AI illimitata, cloud sync, export PDF avanzato).

CREDENZIALI:
  Email:    demo.reviewer@marketmateapp.info
  Password: MarketMate2026!
  PIN app:  1234 (impostato dal reviewer al primo avvio)

USO:
  cd /app/backend
  python scripts/seed_demo_reviewer.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# bcrypt identico a quello usato in auth_module.py
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_EMAIL = "demo.reviewer@marketmateapp.info"
DEMO_PASSWORD = "MarketMate2026!"
DEMO_NOME_ATTIVITA = "MarketMate Demo Shop"
DEMO_NOME_TITOLARE = "Demo Reviewer"


def _hash_password(pwd: str) -> str:
    pwd_bytes = pwd.encode("utf-8")
    if len(pwd_bytes) > 72:
        pwd_bytes = pwd_bytes[:72]
        pwd = pwd_bytes.decode("utf-8", errors="ignore")
    return pwd_context.hash(pwd)


async def main() -> None:
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    existing = await db.users.find_one({"email": DEMO_EMAIL.lower()})

    # Subscription valida fino al 2030 — il reviewer non vedrà mai il blocco
    sub_end_ts = int(datetime(2030, 12, 31, 23, 59, 59, tzinfo=timezone.utc).timestamp())

    subscription_doc = {
        "status": "active",
        "plan": "annual",
        "current_period_end": sub_end_ts,
        "cancel_at_period_end": False,
        "stripe_customer_id": "cus_demo_reviewer_marketmate",
        "stripe_subscription_id": "sub_demo_reviewer_marketmate",
        "is_demo": True,
    }

    if existing:
        # Aggiorna password + subscription (mantieni l'id originale)
        update = {
            "$set": {
                "password_hash": _hash_password(DEMO_PASSWORD),
                "subscription": subscription_doc,
                "is_demo_account": True,
                "nome_attivita": DEMO_NOME_ATTIVITA,
                "nome_titolare": DEMO_NOME_TITOLARE,
            }
        }
        await db.users.update_one({"email": DEMO_EMAIL.lower()}, update)
        print(f"✅ Account demo aggiornato: {DEMO_EMAIL} (id={existing['id']})")
    else:
        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "email": DEMO_EMAIL.lower(),
            "password_hash": _hash_password(DEMO_PASSWORD),
            "role": "owner",
            "account_owner_id": user_id,
            "nome_attivita": DEMO_NOME_ATTIVITA,
            "nome_titolare": DEMO_NOME_TITOLARE,
            "created_at": datetime.utcnow(),
            "subscription": subscription_doc,
            "is_demo_account": True,
        }
        await db.users.insert_one(user_doc)
        print(f"✅ Account demo creato: {DEMO_EMAIL} (id={user_id})")

    print(f"   Password: {DEMO_PASSWORD}")
    print(f"   PIN app:  1234 (lo imposta il reviewer al primo avvio)")
    print(f"   Pro attivo fino: 2030-12-31")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
