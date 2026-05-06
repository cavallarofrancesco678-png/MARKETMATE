"""
Auth + Multi-user module for MarketMate.

Features:
- Email/password registration + login (JWT)
- Multi-user: account owner + up to 2 collaborators (3 total)
- Invite codes with role (full | operativo)
- Data sync per account

NOTE: Subscription/paywall logic is in a separate module and is GATED by
SUBSCRIPTION_ENABLED feature flag. Auth itself is always active once the user
opts in (cloud-sync mode). Local-only mode remains available until the user
enables account sync.
"""
import os
import uuid
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr, Field, field_validator
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
from jose import jwt, JWTError

# ═══ CONFIG ═══
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "marketmate_super_secret_change_me_in_production_please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30  # long-lived for mobile convenience
MAX_COLLABORATORS_PER_OWNER = 2  # owner + 2 = 3 total

# Password hashing (use bcrypt but limit password length to 72 bytes — bcrypt constraint)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Router with /api/auth prefix
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


# ═══════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    nome_attivita: Optional[str] = ""
    nome_titolare: Optional[str] = ""

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RedeemInviteRequest(BaseModel):
    code: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

class CreateInviteRequest(BaseModel):
    role: Literal["full", "operativo"] = "operativo"

class InviteInfo(BaseModel):
    code: str
    role: str
    created_at: datetime
    used_by: Optional[str] = None
    used_at: Optional[datetime] = None

class UserInfo(BaseModel):
    id: str
    email: str
    role: str  # owner | full | operativo
    account_owner_id: str  # points to owner (self if owner)
    nome_attivita: Optional[str] = ""
    nome_titolare: Optional[str] = ""
    created_at: datetime

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo

class CollaboratorInfo(BaseModel):
    id: str
    email: str
    role: str
    joined_at: datetime


# ═══════════════════════════════════════════════════════════════
# JWT HELPERS
# ═══════════════════════════════════════════════════════════════
def _hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])

def _verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password[:72], hashed)
    except Exception:
        return False

def _create_access_token(user_id: str, account_owner_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "aoid": account_owner_id,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _generate_invite_code() -> str:
    """Generate a human-readable invite code: 8 chars, uppercase + digits, no ambiguous chars."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # removed I, O, 0, 1
    return "".join(secrets.choice(alphabet) for _ in range(8))


# ═══════════════════════════════════════════════════════════════
# DEPENDENCY: current user from JWT
# ═══════════════════════════════════════════════════════════════
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extract user from Bearer JWT. Raises 401 if missing/invalid."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token di autenticazione mancante")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        account_owner_id = payload.get("aoid")
        role = payload.get("role")
        if not user_id or not account_owner_id:
            raise HTTPException(status_code=401, detail="Token non valido")
        return {"user_id": user_id, "account_owner_id": account_owner_id, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token scaduto o non valido")


# ═══════════════════════════════════════════════════════════════
# SETUP DB reference (injected from server.py)
# ═══════════════════════════════════════════════════════════════
_db: Optional[AsyncIOMotorDatabase] = None

def init_auth_db(db: AsyncIOMotorDatabase):
    global _db
    _db = db

async def _ensure_indexes():
    if _db is None: return
    try:
        await _db.users.create_index("email", unique=True)
        await _db.invite_codes.create_index("code", unique=True)
        await _db.invite_codes.create_index("account_owner_id")
    except Exception as e:
        # Silently ignore — indexes may already exist
        pass


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════
@auth_router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    """Register a new OWNER account. Collaborators must use /redeem_invite instead."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    await _ensure_indexes()
    # Check if email already exists
    existing = await _db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email già registrata. Prova ad effettuare il login.")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": req.email.lower(),
        "password_hash": _hash_password(req.password),
        "role": "owner",
        "account_owner_id": user_id,  # self-owned
        "nome_attivita": (req.nome_attivita or "").strip(),
        "nome_titolare": (req.nome_titolare or "").strip(),
        "created_at": datetime.utcnow(),
    }
    await _db.users.insert_one(user_doc)
    token = _create_access_token(user_id, user_id, "owner")
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user_id, email=user_doc["email"], role="owner",
            account_owner_id=user_id,
            nome_attivita=user_doc["nome_attivita"],
            nome_titolare=user_doc["nome_titolare"],
            created_at=user_doc["created_at"],
        ),
    )


@auth_router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    user = await _db.users.find_one({"email": req.email.lower()})
    if not user or not _verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o password errati")
    token = _create_access_token(user["id"], user["account_owner_id"], user["role"])
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user["id"], email=user["email"], role=user["role"],
            account_owner_id=user["account_owner_id"],
            nome_attivita=user.get("nome_attivita", ""),
            nome_titolare=user.get("nome_titolare", ""),
            created_at=user["created_at"],
        ),
    )


@auth_router.post("/redeem_invite", response_model=AuthResponse)
async def redeem_invite(req: RedeemInviteRequest):
    """Redeem an invite code to register as a COLLABORATOR. Creates a user linked
    to the inviter's account_owner_id with the role set by the invite."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    await _ensure_indexes()
    code = req.code.strip().upper()
    invite = await _db.invite_codes.find_one({"code": code})
    if not invite:
        raise HTTPException(status_code=404, detail="Codice invito non valido")
    if invite.get("used_by"):
        raise HTTPException(status_code=410, detail="Questo codice è già stato utilizzato")
    # Check max collaborators not exceeded
    owner_id = invite["account_owner_id"]
    collab_count = await _db.users.count_documents({"account_owner_id": owner_id, "role": {"$in": ["full", "operativo"]}})
    if collab_count >= MAX_COLLABORATORS_PER_OWNER:
        raise HTTPException(status_code=400, detail=f"Limite di {MAX_COLLABORATORS_PER_OWNER} collaboratori raggiunto per questo account")
    # Check email uniqueness
    existing = await _db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email già registrata")

    user_id = str(uuid.uuid4())
    role = invite.get("role", "operativo")
    owner_doc = await _db.users.find_one({"id": owner_id}) or {}
    user_doc = {
        "id": user_id,
        "email": req.email.lower(),
        "password_hash": _hash_password(req.password),
        "role": role,
        "account_owner_id": owner_id,
        "nome_attivita": owner_doc.get("nome_attivita", ""),
        "nome_titolare": "",
        "created_at": datetime.utcnow(),
    }
    await _db.users.insert_one(user_doc)
    # Mark invite as used
    await _db.invite_codes.update_one({"code": code}, {"$set": {"used_by": user_id, "used_at": datetime.utcnow()}})

    token = _create_access_token(user_id, owner_id, role)
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user_id, email=user_doc["email"], role=role,
            account_owner_id=owner_id,
            nome_attivita=user_doc["nome_attivita"],
            nome_titolare=user_doc["nome_titolare"],
            created_at=user_doc["created_at"],
        ),
    )


@auth_router.get("/me", response_model=UserInfo)
async def me(current=Depends(get_current_user)):
    user = await _db.users.find_one({"id": current["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return UserInfo(
        id=user["id"], email=user["email"], role=user["role"],
        account_owner_id=user["account_owner_id"],
        nome_attivita=user.get("nome_attivita", ""),
        nome_titolare=user.get("nome_titolare", ""),
        created_at=user["created_at"],
    )


@auth_router.post("/invites/create", response_model=InviteInfo)
async def create_invite(req: CreateInviteRequest, current=Depends(get_current_user)):
    """Only the account OWNER can create invites."""
    if current["role"] != "owner":
        raise HTTPException(status_code=403, detail="Solo il titolare dell'account può creare codici invito")
    owner_id = current["account_owner_id"]
    # Check total users count (max 3 including owner)
    total_users = await _db.users.count_documents({"account_owner_id": owner_id})
    # Unused invites also count toward the limit
    unused_invites = await _db.invite_codes.count_documents({"account_owner_id": owner_id, "used_by": None})
    if total_users + unused_invites >= MAX_COLLABORATORS_PER_OWNER + 1:
        raise HTTPException(status_code=400, detail=f"Hai raggiunto il limite di {MAX_COLLABORATORS_PER_OWNER} collaboratori. Elimina un collaboratore o un codice inutilizzato prima di crearne uno nuovo.")

    # Generate unique code (retry if collision)
    for _ in range(5):
        code = _generate_invite_code()
        if not await _db.invite_codes.find_one({"code": code}):
            break
    else:
        raise HTTPException(status_code=500, detail="Impossibile generare codice univoco")

    now = datetime.utcnow()
    doc = {
        "code": code,
        "account_owner_id": owner_id,
        "role": req.role,
        "created_at": now,
        "used_by": None,
        "used_at": None,
    }
    await _db.invite_codes.insert_one(doc)
    return InviteInfo(code=code, role=req.role, created_at=now)


@auth_router.get("/invites/list", response_model=List[InviteInfo])
async def list_invites(current=Depends(get_current_user)):
    if current["role"] != "owner":
        raise HTTPException(status_code=403, detail="Solo il titolare può visualizzare i codici")
    cur = _db.invite_codes.find({"account_owner_id": current["account_owner_id"]})
    out: List[InviteInfo] = []
    async for d in cur:
        out.append(InviteInfo(
            code=d["code"], role=d.get("role", "operativo"),
            created_at=d.get("created_at"),
            used_by=d.get("used_by"), used_at=d.get("used_at"),
        ))
    return out


@auth_router.delete("/invites/{code}")
async def revoke_invite(code: str, current=Depends(get_current_user)):
    if current["role"] != "owner":
        raise HTTPException(status_code=403, detail="Solo il titolare può revocare i codici")
    code = code.strip().upper()
    res = await _db.invite_codes.delete_one({"code": code, "account_owner_id": current["account_owner_id"], "used_by": None})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Codice non trovato o già utilizzato")
    return {"ok": True}


@auth_router.get("/collaborators", response_model=List[CollaboratorInfo])
async def list_collaborators(current=Depends(get_current_user)):
    if current["role"] != "owner":
        raise HTTPException(status_code=403, detail="Solo il titolare può visualizzare i collaboratori")
    cur = _db.users.find({"account_owner_id": current["account_owner_id"], "id": {"$ne": current["user_id"]}})
    out: List[CollaboratorInfo] = []
    async for u in cur:
        out.append(CollaboratorInfo(
            id=u["id"], email=u["email"], role=u["role"], joined_at=u["created_at"],
        ))
    return out


@auth_router.delete("/collaborators/{user_id}")
async def remove_collaborator(user_id: str, current=Depends(get_current_user)):
    if current["role"] != "owner":
        raise HTTPException(status_code=403, detail="Solo il titolare può rimuovere collaboratori")
    # Safety: can't delete self, can't delete another owner
    target = await _db.users.find_one({"id": user_id, "account_owner_id": current["account_owner_id"]})
    if not target or target.get("role") == "owner":
        raise HTTPException(status_code=404, detail="Collaboratore non trovato")
    await _db.users.delete_one({"id": user_id})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# SYNC ENDPOINTS (multi-device data sync per account)
# ═══════════════════════════════════════════════════════════════
sync_router = APIRouter(prefix="/api/sync", tags=["sync"])

class SyncPushRequest(BaseModel):
    data: dict  # the full Zustand snapshot (will be stored per account_owner_id)

class SyncPullResponse(BaseModel):
    data: Optional[dict] = None
    updated_at: Optional[datetime] = None
    role: str  # so client can restrict UI

@sync_router.post("/push")
async def sync_push(req: SyncPushRequest, current=Depends(get_current_user)):
    """Push local data to the server. Writes under account_owner_id so all collaborators see same data.
    Operativo users have restricted write: can only push storicoGiornate, storicoCarburante, storicoScontrini,
    appuntiAgenda, storicoDiario additions — NOT configuration changes."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    owner_id = current["account_owner_id"]
    data = req.data or {}

    # Operativo restrictions: merge selectively with existing data
    if current["role"] == "operativo":
        existing = await _db.account_data.find_one({"owner_id": owner_id})
        if existing and "data" in existing:
            base = dict(existing["data"])
            # Only allow these fields to be updated by operativo
            allowed = {"storicoGiornate", "storicoCarburante", "storicoScontrini",
                       "appuntiAgenda", "ordiniAgenda", "storicoDiario", "speseExtraSession"}
            for k in allowed:
                if k in data:
                    base[k] = data[k]
            data = base

    await _db.account_data.update_one(
        {"owner_id": owner_id},
        {"$set": {"owner_id": owner_id, "data": data, "updated_at": datetime.utcnow(),
                   "updated_by": current["user_id"]}},
        upsert=True,
    )
    return {"ok": True, "updated_at": datetime.utcnow()}


@sync_router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(current=Depends(get_current_user)):
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    doc = await _db.account_data.find_one({"owner_id": current["account_owner_id"]})
    return SyncPullResponse(
        data=(doc or {}).get("data"),
        updated_at=(doc or {}).get("updated_at"),
        role=current["role"],
    )


# ═══════════════════════════════════════════════════════════════
# TEAM ROUTER — wrappers "codice + password" (no-email flow for
# mobile MVP). These endpoints adapt the existing auth infra to
# the user-friendly flow requested by the product:
#   - Admin device self-registers on first use (synthetic email)
#   - Collaborator joins with {code, password} only (no email)
#   - Subsequent logins are {code, password}
# The underlying auth_module.users collection is unchanged.
# ═══════════════════════════════════════════════════════════════
team_router = APIRouter(prefix="/api/team", tags=["team"])

class AdminAutoRegisterRequest(BaseModel):
    device_id: str = Field(min_length=6, max_length=128)
    password: str = Field(min_length=6, max_length=72)
    nome_attivita: Optional[str] = ""
    nome_titolare: Optional[str] = ""

class JoinByCodeRequest(BaseModel):
    code: str
    password: str = Field(min_length=6, max_length=72)

class LoginByCodeRequest(BaseModel):
    code: str
    password: str

class CollaboratorDetailed(BaseModel):
    id: str
    code: str  # the invite code they used
    role: str
    joined_at: datetime

@team_router.post("/admin_register", response_model=AuthResponse)
async def admin_auto_register(req: AdminAutoRegisterRequest):
    """Auto-register an admin (owner) using a device_id as synthetic email.
    This is transparent to the user — the app generates a device_id and
    stores the password in SecureStore. If the device_id already exists,
    returns 409 so the client can call /admin_login instead."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    await _ensure_indexes()
    synthetic_email = f"device_{req.device_id.lower()}@marketmate.local"
    existing = await _db.users.find_one({"email": synthetic_email})
    if existing:
        raise HTTPException(status_code=409, detail="Dispositivo già registrato")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": synthetic_email,
        "password_hash": _hash_password(req.password),
        "role": "owner",
        "account_owner_id": user_id,
        "nome_attivita": (req.nome_attivita or "").strip(),
        "nome_titolare": (req.nome_titolare or "").strip(),
        "device_id": req.device_id,
        "created_at": datetime.utcnow(),
    }
    await _db.users.insert_one(user_doc)
    token = _create_access_token(user_id, user_id, "owner")
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user_id, email=synthetic_email, role="owner",
            account_owner_id=user_id,
            nome_attivita=user_doc["nome_attivita"],
            nome_titolare=user_doc["nome_titolare"],
            created_at=user_doc["created_at"],
        ),
    )

@team_router.post("/admin_login", response_model=AuthResponse)
async def admin_login(req: AdminAutoRegisterRequest):
    """Login by device_id + password. Used when the admin clears SecureStore or
    re-installs the app on the same account."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    synthetic_email = f"device_{req.device_id.lower()}@marketmate.local"
    user = await _db.users.find_one({"email": synthetic_email})
    if not user or not _verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Dispositivo o password errati")
    token = _create_access_token(user["id"], user["account_owner_id"], user["role"])
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user["id"], email=user["email"], role=user["role"],
            account_owner_id=user["account_owner_id"],
            nome_attivita=user.get("nome_attivita", ""),
            nome_titolare=user.get("nome_titolare", ""),
            created_at=user["created_at"],
        ),
    )

@team_router.post("/join_by_code", response_model=AuthResponse)
async def join_by_code(req: JoinByCodeRequest):
    """First-time join for a COLLABORATOR using just {code, password}.
    Internally creates a synthetic email collab_<code>@marketmate.local."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    await _ensure_indexes()
    code = req.code.strip().upper()
    invite = await _db.invite_codes.find_one({"code": code})
    if not invite:
        raise HTTPException(status_code=404, detail="Codice invito non valido")
    if invite.get("used_by"):
        raise HTTPException(status_code=410, detail="Questo codice è già stato utilizzato")
    owner_id = invite["account_owner_id"]
    collab_count = await _db.users.count_documents({"account_owner_id": owner_id, "role": {"$in": ["full", "operativo"]}})
    if collab_count >= MAX_COLLABORATORS_PER_OWNER:
        raise HTTPException(status_code=400, detail=f"Limite di {MAX_COLLABORATORS_PER_OWNER} collaboratori raggiunto")
    synthetic_email = f"collab_{code.lower()}@marketmate.local"
    user_id = str(uuid.uuid4())
    role = invite.get("role", "operativo")
    owner_doc = await _db.users.find_one({"id": owner_id}) or {}
    user_doc = {
        "id": user_id,
        "email": synthetic_email,
        "password_hash": _hash_password(req.password),
        "role": role,
        "account_owner_id": owner_id,
        "nome_attivita": owner_doc.get("nome_attivita", ""),
        "nome_titolare": "",
        "invite_code": code,
        "created_at": datetime.utcnow(),
    }
    await _db.users.insert_one(user_doc)
    await _db.invite_codes.update_one(
        {"code": code},
        {"$set": {"used_by": user_id, "used_at": datetime.utcnow()}},
    )
    token = _create_access_token(user_id, owner_id, role)
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user_id, email=synthetic_email, role=role,
            account_owner_id=owner_id,
            nome_attivita=user_doc["nome_attivita"],
            nome_titolare=user_doc["nome_titolare"],
            created_at=user_doc["created_at"],
        ),
    )

@team_router.post("/login_by_code", response_model=AuthResponse)
async def login_by_code(req: LoginByCodeRequest):
    """Subsequent collaborator logins via {code, password}. Also checks if the
    user has been revoked (deleted) by the admin and returns 403 in that case."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    code = req.code.strip().upper()
    synthetic_email = f"collab_{code.lower()}@marketmate.local"
    user = await _db.users.find_one({"email": synthetic_email})
    if not user:
        # Either revoked (deleted by admin) or never registered
        raise HTTPException(status_code=403, detail="Accesso revocato dall'amministratore o codice non trovato")
    if not _verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Password errata")
    token = _create_access_token(user["id"], user["account_owner_id"], user["role"])
    return AuthResponse(
        access_token=token,
        user=UserInfo(
            id=user["id"], email=user["email"], role=user["role"],
            account_owner_id=user["account_owner_id"],
            nome_attivita=user.get("nome_attivita", ""),
            nome_titolare=user.get("nome_titolare", ""),
            created_at=user["created_at"],
        ),
    )

@team_router.get("/status")
async def status_check(current=Depends(get_current_user)):
    """Client polls this endpoint on app open to verify the token is still
    valid and the user has not been revoked. Returns 401 if JWT invalid (handled
    by get_current_user) or 403 if the user was deleted from DB."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB non inizializzato")
    user = await _db.users.find_one({"id": current["user_id"]})
    if not user:
        raise HTTPException(status_code=403, detail="Accesso revocato dall'amministratore")
    return {"ok": True, "role": user["role"], "account_owner_id": user["account_owner_id"]}

@team_router.get("/collaborators_detailed", response_model=List[CollaboratorDetailed])
async def list_collaborators_detailed(current=Depends(get_current_user)):
    """Admin-only: returns the list of collaborators WITH the invite code they
    used (so admin can identify them: 'Codice MGR-A3B7 → Luca Rossi')."""
    if current["role"] != "owner":
        raise HTTPException(status_code=403, detail="Solo il titolare può vedere i collaboratori")
    cur = _db.users.find({"account_owner_id": current["account_owner_id"], "id": {"$ne": current["user_id"]}})
    out: List[CollaboratorDetailed] = []
    async for u in cur:
        out.append(CollaboratorDetailed(
            id=u["id"],
            code=u.get("invite_code", "—"),
            role=u["role"],
            joined_at=u["created_at"],
        ))
    return out
