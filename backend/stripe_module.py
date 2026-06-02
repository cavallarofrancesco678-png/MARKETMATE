"""
Stripe Subscriptions Module — Round 68
═══════════════════════════════════════════════════════════════════════
Integrazione abbonamenti Stripe per MarketMate Premium.

Endpoint:
  • POST /api/stripe/create-checkout-session  → genera URL Stripe Checkout
  • POST /api/stripe/create-portal-session    → genera URL Customer Portal
  • GET  /api/stripe/subscription-status      → stato abbonamento corrente
  • POST /api/stripe/webhook                  → webhook events da Stripe
  • GET  /api/stripe/config                   → publishable key + price IDs (pubblico)

Flusso:
  1. Utente clicca "Sottoscrivi Premium" nell'app
  2. Frontend → POST /create-checkout-session {price_id, plan}
  3. Backend: trova/crea Stripe Customer per l'utente → crea Checkout Session
  4. Backend ritorna `{url: "https://checkout.stripe.com/..."}`
  5. Frontend apre URL (WebBrowser su mobile, redirect su web)
  6. Utente paga → Stripe redirige all'app via deep link
  7. Stripe invia webhook → backend aggiorna user.subscription
  8. Frontend ricarica stato e mostra "Premium attivo"
"""
import os
import logging
from datetime import datetime
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

import stripe

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_MENSILE = os.getenv("STRIPE_PRICE_MENSILE", "")
STRIPE_PRICE_ANNUALE = os.getenv("STRIPE_PRICE_ANNUALE", "")
APP_DOMAIN = os.getenv("APP_DOMAIN", "https://marketmate.info")

# Flag: indica se siamo in modalità live (basato sul prefisso della secret key)
STRIPE_IS_LIVE = STRIPE_SECRET_KEY.startswith("sk_live_")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    logger.warning("STRIPE_SECRET_KEY mancante — endpoint Stripe non funzioneranno")


stripe_router = APIRouter(prefix="/api/stripe", tags=["stripe"])

_db: Optional[AsyncIOMotorDatabase] = None


def init_stripe_db(db: AsyncIOMotorDatabase):
    global _db
    _db = db


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    return _db


# ═══════════════════════════════════════════════════════════════════
# AUTH HELPER — riusa la stessa logica di auth_module
# ═══════════════════════════════════════════════════════════════════
from auth_module import get_current_user


# ═══════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════
class CheckoutSessionRequest(BaseModel):
    plan: Literal["monthly", "annual"]
    # URL a cui Stripe redirige dopo pagamento (deep link nell'app)
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    url: str
    session_id: str


class PortalSessionResponse(BaseModel):
    url: str


class SubscriptionStatus(BaseModel):
    active: bool
    plan: Optional[Literal["monthly", "annual"]] = None
    status: Optional[str] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    is_live_mode: bool = STRIPE_IS_LIVE


class StripeConfigPublic(BaseModel):
    publishable_key: str
    price_mensile: str
    price_annuale: str
    is_live_mode: bool


# ═══════════════════════════════════════════════════════════════════
# UTILITY
# ═══════════════════════════════════════════════════════════════════
async def _get_or_create_stripe_customer(user: dict) -> str:
    """Trova o crea il Customer Stripe associato all'utente."""
    db = get_db()
    if user.get("stripe_customer_id"):
        # Verifica che esista ancora su Stripe (l'oggetto Customer di Stripe SDK
        # non è un dict — usa getattr per evitare AttributeError).
        try:
            cust = stripe.Customer.retrieve(user["stripe_customer_id"])
            if not getattr(cust, "deleted", False):
                return user["stripe_customer_id"]
        except stripe.error.InvalidRequestError:
            pass  # customer cancellato manualmente su Stripe → ricreiamolo

    # Crea nuovo customer
    customer = stripe.Customer.create(
        email=user["email"],
        name=user.get("nome_titolare") or user.get("nome_attivita") or user["email"],
        metadata={
            "user_id": user["id"],
            "account_owner_id": user.get("account_owner_id", user["id"]),
        },
    )
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"stripe_customer_id": customer.id}},
    )
    return customer.id


def _resolve_price_id(plan: str) -> str:
    if plan == "monthly":
        return STRIPE_PRICE_MENSILE
    elif plan == "annual":
        return STRIPE_PRICE_ANNUALE
    raise HTTPException(status_code=400, detail=f"Plan '{plan}' non valido")


def _plan_from_price_id(price_id: str) -> Optional[str]:
    if price_id == STRIPE_PRICE_MENSILE:
        return "monthly"
    if price_id == STRIPE_PRICE_ANNUALE:
        return "annual"
    return None


# ═══════════════════════════════════════════════════════════════════
# ENDPOINT: Config pubblica (publishable key, price IDs)
# ═══════════════════════════════════════════════════════════════════
@stripe_router.get("/config", response_model=StripeConfigPublic)
async def get_stripe_config():
    """Restituisce le info pubbliche di Stripe, necessarie al frontend.
    NB: publishable key e price IDs SONO PUBBLICI per design (no security leak)."""
    return StripeConfigPublic(
        publishable_key=STRIPE_PUBLISHABLE_KEY,
        price_mensile=STRIPE_PRICE_MENSILE,
        price_annuale=STRIPE_PRICE_ANNUALE,
        is_live_mode=STRIPE_IS_LIVE,
    )


# ═══════════════════════════════════════════════════════════════════
# ENDPOINT: Create Checkout Session
# ═══════════════════════════════════════════════════════════════════
@stripe_router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    req: CheckoutSessionRequest,
    current=Depends(get_current_user),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configurato")
    db = get_db()
    user = await db.users.find_one({"id": current["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # Solo l'OWNER può sottoscrivere (i collaboratori usano la subscription dell'owner)
    if user.get("role") != "owner":
        raise HTTPException(
            status_code=403,
            detail="Solo il titolare dell'account può gestire l'abbonamento. "
                   "Chiedi al tuo amministratore.",
        )

    customer_id = await _get_or_create_stripe_customer(user)
    price_id = _resolve_price_id(req.plan)

    # URL di redirect dopo Checkout. Su web puntano alla web preview;
    # su mobile devono essere deep link gestiti dall'app (vedi success/cancel
    # routes in /app/frontend/app/subscription/...).
    default_success = f"{APP_DOMAIN}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    default_cancel = f"{APP_DOMAIN}/subscription/cancel"

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=req.success_url or default_success,
            cancel_url=req.cancel_url or default_cancel,
            client_reference_id=user["id"],
            allow_promotion_codes=True,
            billing_address_collection="auto",
            subscription_data={
                "metadata": {
                    "user_id": user["id"],
                    "account_owner_id": user.get("account_owner_id", user["id"]),
                    "plan": req.plan,
                },
            },
            metadata={
                "user_id": user["id"],
                "plan": req.plan,
            },
        )
    except stripe.error.StripeError as e:
        logger.exception("Stripe create checkout error")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")

    return CheckoutSessionResponse(url=session.url, session_id=session.id)


# ═══════════════════════════════════════════════════════════════════
# ENDPOINT: Create Customer Portal Session
# (l'utente può gestire pagamento/cancellazione subscription)
# ═══════════════════════════════════════════════════════════════════
@stripe_router.post("/create-portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    return_url: Optional[str] = None,
    current=Depends(get_current_user),
):
    db = get_db()
    user = await db.users.find_one({"id": current["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if not user.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="Nessun abbonamento attivo")

    try:
        session = stripe.billing_portal.Session.create(
            customer=user["stripe_customer_id"],
            return_url=return_url or f"{APP_DOMAIN}/home/settings",
        )
    except stripe.error.StripeError as e:
        logger.exception("Stripe portal session error")
        raise HTTPException(status_code=400, detail=str(e))

    return PortalSessionResponse(url=session.url)


# ═══════════════════════════════════════════════════════════════════
# ENDPOINT: Subscription Status
# ═══════════════════════════════════════════════════════════════════
@stripe_router.get("/subscription-status", response_model=SubscriptionStatus)
async def get_subscription_status(current=Depends(get_current_user)):
    db = get_db()
    # Per i collaboratori, leggiamo lo stato dell'OWNER (account-wide subscription)
    owner_id = current.get("account_owner_id", current["user_id"])
    user = await db.users.find_one({"id": owner_id})
    if not user:
        raise HTTPException(status_code=404, detail="Owner non trovato")

    sub = user.get("subscription") or {}
    status = sub.get("status")
    active = status in ("active", "trialing")
    return SubscriptionStatus(
        active=active,
        plan=sub.get("plan"),
        status=status,
        current_period_end=sub.get("current_period_end"),
        cancel_at_period_end=sub.get("cancel_at_period_end", False),
        is_live_mode=STRIPE_IS_LIVE,
    )


# ═══════════════════════════════════════════════════════════════════
# WEBHOOK
# ═══════════════════════════════════════════════════════════════════
@stripe_router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(None)):
    """Endpoint ricevitore eventi Stripe.

    Eventi gestiti:
      • checkout.session.completed       → primo pagamento ok
      • customer.subscription.created    → subscription creata
      • customer.subscription.updated    → modifica (upgrade/cancel scheduled/ecc.)
      • customer.subscription.deleted    → cancellata definitivamente
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET mancante")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature or "", STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook signature non valida")
        raise HTTPException(status_code=400, detail="Firma webhook non valida")
    except Exception as e:
        logger.exception("Stripe webhook parsing error")
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event["type"]
    obj = event["data"]["object"]
    logger.info(f"[Stripe webhook] {event_type} id={event.get('id')}")

    # Persisti l'evento per audit/troubleshooting
    db = get_db()
    try:
        await db.stripe_events.insert_one({
            "_id": event["id"],
            "type": event_type,
            "created": datetime.utcfromtimestamp(event["created"]),
            "data": obj,
            "processed_at": datetime.utcnow(),
        })
    except Exception:
        # Evento duplicato (_id già presente) — Stripe può rinviare → idempotenza
        logger.info(f"Evento duplicato ignorato: {event['id']}")
        return {"received": True, "duplicate": True}

    # ─── Routing degli eventi ────────────────────────────────────────
    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(obj)
    elif event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        await _handle_subscription_change(obj)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(obj)
    else:
        logger.info(f"Evento ignorato (non gestito): {event_type}")

    return {"received": True}


async def _handle_checkout_completed(session: dict):
    """Al completamento del checkout, recupera la subscription Stripe e aggiorna l'utente."""
    db = get_db()
    user_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("user_id")
    sub_id = session.get("subscription")
    if not user_id or not sub_id:
        logger.warning(f"checkout.session.completed senza user_id/sub_id: {session.get('id')}")
        return
    try:
        sub = stripe.Subscription.retrieve(sub_id)
    except stripe.error.StripeError as e:
        logger.exception(f"Impossibile recuperare subscription {sub_id}: {e}")
        return
    await _persist_subscription(user_id, sub)


async def _handle_subscription_change(sub: dict):
    """Aggiornamento subscription (upgrade, downgrade, cancel scheduled, riattivazione)."""
    db = get_db()
    metadata = sub.get("metadata") or {}
    user_id = metadata.get("user_id")
    if not user_id:
        # Fallback: trova utente tramite customer_id
        customer_id = sub.get("customer")
        if customer_id:
            user = await db.users.find_one({"stripe_customer_id": customer_id})
            if user:
                user_id = user["id"]
    if not user_id:
        logger.warning(f"subscription.updated senza user_id: {sub.get('id')}")
        return
    await _persist_subscription(user_id, sub)


async def _handle_subscription_deleted(sub: dict):
    db = get_db()
    metadata = sub.get("metadata") or {}
    user_id = metadata.get("user_id")
    if not user_id:
        customer_id = sub.get("customer")
        if customer_id:
            user = await db.users.find_one({"stripe_customer_id": customer_id})
            if user:
                user_id = user["id"]
    if not user_id:
        return
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription": {
            "id": sub.get("id"),
            "status": "canceled",
            "plan": None,
            "current_period_end": None,
            "cancel_at_period_end": False,
            "canceled_at": datetime.utcnow(),
        }}},
    )


async def _persist_subscription(user_id: str, sub):
    """Estrae i campi rilevanti dalla subscription Stripe e li salva sull'utente."""
    db = get_db()
    items = (sub.get("items") or {}).get("data") or []
    price_id = items[0]["price"]["id"] if items else None
    plan = _plan_from_price_id(price_id) if price_id else None
    period_end_ts = sub.get("current_period_end")
    period_end = datetime.utcfromtimestamp(period_end_ts) if period_end_ts else None
    payload = {
        "id": sub.get("id"),
        "status": sub.get("status"),
        "plan": plan,
        "price_id": price_id,
        "current_period_end": period_end,
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "started_at": datetime.utcnow(),
    }
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription": payload}},
    )
    logger.info(f"Subscription {sub.get('id')} salvata su user {user_id}: {payload['status']}")
