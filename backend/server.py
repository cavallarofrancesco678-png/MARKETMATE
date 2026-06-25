from fastapi import FastAPI, APIRouter
from fastapi.responses import FileResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContent
import json
import re
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class ChatRequest(BaseModel):
    message: str
    context: str = ""
    session_id: str = "default"
    # Round 67 — rate limiting + protocollo localizzazione AI
    device_id: str = ""
    mercato_citta: str = ""
    settore: str = ""
    # Round 68 — Calendario contestuale (feste italiane + chiusure scolastiche
    # regionali) calcolato lato frontend per il range visualizzato. L'AI lo usa
    # per analisi predittive sull'impatto vendite (es. ponti, vacanze estive).
    calendario_contestuale: str = ""
    # Round 69 — Lista delle città dei mercati configurati dall'utente.
    # Formato: stringa con città separate da virgola/pipe (es. "Milano|Monza|Lodi").
    # L'AI DEVE dedurre la provincia/regione da questa lista, MAI chiedere
    # all'utente di configurare una provincia in Impostazioni.
    mercati_lista: str = ""

class ChatResponse(BaseModel):
    response: str
    session_id: str
    # Round 67 — True quando il limite di consumo AI è stato raggiunto
    limit_reached: bool = False

# Round 57: rimossi i model ReceiptAnalyzeRequest/ReceiptAnalyzeResponse
# (la funzionalità OCR scontrino è stata eliminata)

class FuelStation(BaseModel):
    nome: str = ""
    indirizzo: str = ""
    comune: str = ""
    brand: str = ""
    prezzo: float = 0
    distanza_km: float = 0
    carburante: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None

class FuelRequest(BaseModel):
    partenza: str
    destinazione: str
    tipo_carburante: str = "benzina"

class FuelResponse(BaseModel):
    success: bool
    country: str = ""
    stations: List[FuelStation] = []
    message: str = ""

class DistanceRequest(BaseModel):
    partenza: str
    destinazione: str

class DistanceResponse(BaseModel):
    success: bool
    km: float = 0
    km_andata_ritorno: float = 0
    message: str = ""

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ── AI Chat sessions store ──
chat_sessions: dict = {}

# ═══ Round 67 — RATE LIMITING AI ═══
# Limiti concordati con l'utente in base al prezzo dell'app (€6,90/mese):
# ogni messaggio (saluto incluso) costa ~€0,01 → budget AI ≈ €1/mese (14%).
AI_DAILY_LIMIT = 10     # messaggi al giorno per dispositivo
AI_MONTHLY_LIMIT = 100  # messaggi al mese per dispositivo

AI_LIMIT_MSG_DAILY = (
    "⏳ Hai raggiunto il limite giornaliero di 10 messaggi AI. "
    "Il contatore si azzera a mezzanotte: ci vediamo domani! "
    "Nel frattempo puoi consultare le tue Statistiche e l'Agenda. 📊"
)
AI_LIMIT_MSG_MONTHLY = (
    "⏳ Hai raggiunto il limite mensile di 100 messaggi AI incluso nel tuo abbonamento. "
    "Il contatore si azzera il 1° del prossimo mese. "
    "Nel frattempo puoi consultare le tue Statistiche e l'Agenda. 📊"
)

# ═══ ROUND 74 — MEMORIA PERSISTENTE AI ═══
# Salva le istruzioni/preferenze/correzioni dell'utente nel DB e le inietta
# nel system message dell'AI ad ogni chiamata. L'AI ricorda così cosa
# l'utente le ha detto in passato.

def _detect_memory_intent(message: str) -> Optional[str]:
    """Se il messaggio dell'utente contiene un'intenzione di memorizzazione
    (es. "ricorda che X"), restituisce il contenuto da memorizzare."""
    if not message:
        return None
    msg = message.strip()
    lower = msg.lower()
    triggers = [
        "ricordati che ", "ricordati di ", "ricorda che ", "ricorda di ",
        "ricorda: ", "ricordati: ", "memorizza che ", "memorizza: ", "memorizza ",
        "tieni a mente che ", "tieni a mente: ", "tieni a mente ",
        "non dimenticare che ", "non dimenticare di ", "non dimenticare: ", "non dimenticare ",
        "appunto: ", "nota: ", "annota: ", "annota che ",
    ]
    for t in triggers:
        idx = lower.find(t)
        if idx >= 0:
            after = msg[idx + len(t):].strip()
            after = after.rstrip(".!?\u00a0 ")
            if len(after) >= 3:
                return after
    return None


async def get_user_memories(device_id: str, limit: int = 30) -> List[str]:
    """Recupera le ultime N memorie salvate per il device_id."""
    if not device_id:
        return []
    try:
        doc = await db.ai_user_memory.find_one({"device_id": device_id})
        if not doc:
            return []
        mems = doc.get("memories", [])
        if len(mems) > limit:
            mems = mems[-limit:]
        return [m.get("text", "") for m in mems if isinstance(m, dict) and m.get("text")]
    except Exception as e:
        logger.warning(f"get_user_memories failed for {device_id}: {e}")
        return []


class AIMemoryAddRequest(BaseModel):
    device_id: str
    text: str


@app.post("/api/ai/memory/add")
async def ai_memory_add(req: AIMemoryAddRequest):
    """Aggiunge esplicitamente una memoria/preferenza per il device."""
    device_id = (req.device_id or "").strip()
    text = (req.text or "").strip()[:500]
    if not device_id or not text:
        return {"ok": False, "error": "device_id e text richiesti"}
    try:
        await db.ai_user_memory.update_one(
            {"device_id": device_id},
            {
                "$push": {"memories": {"text": text, "created_at": datetime.utcnow().isoformat()}},
                "$setOnInsert": {"device_id": device_id, "created_at": datetime.utcnow().isoformat()},
            },
            upsert=True,
        )
        return {"ok": True, "text": text}
    except Exception as e:
        logger.error(f"ai_memory_add failed: {e}")
        return {"ok": False, "error": str(e)}


@app.get("/api/ai/memory")
async def ai_memory_get(device_id: str):
    """Restituisce tutte le memorie per il device."""
    device_id = (device_id or "").strip()
    if not device_id:
        return {"items": []}
    try:
        doc = await db.ai_user_memory.find_one({"device_id": device_id})
        if not doc:
            return {"items": []}
        return {"items": doc.get("memories", [])}
    except Exception as e:
        logger.error(f"ai_memory_get failed: {e}")
        return {"items": [], "error": str(e)}


@app.delete("/api/ai/memory")
async def ai_memory_clear(device_id: str):
    """Cancella tutte le memorie per il device."""
    device_id = (device_id or "").strip()
    if not device_id:
        return {"ok": False, "error": "device_id richiesto"}
    try:
        await db.ai_user_memory.delete_one({"device_id": device_id})
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}



async def check_ai_usage(device_id: str) -> dict:
    """Controlla i limiti d'uso AI per il dispositivo (10/giorno, 100/mese).
    Ritorna {'allowed': bool, 'message': str}. NON incrementa il contatore."""
    now = datetime.utcnow()
    day = now.strftime('%Y-%m-%d')
    month = now.strftime('%Y-%m')
    daily_doc = await db.ai_usage.find_one({"device_id": device_id, "day": day})
    daily_count = (daily_doc or {}).get("count", 0)
    if daily_count >= AI_DAILY_LIMIT:
        return {"allowed": False, "message": AI_LIMIT_MSG_DAILY}
    pipeline = [
        {"$match": {"device_id": device_id, "month": month}},
        {"$group": {"_id": None, "total": {"$sum": "$count"}}},
    ]
    agg = await db.ai_usage.aggregate(pipeline).to_list(1)
    monthly_count = agg[0]["total"] if agg else 0
    if monthly_count >= AI_MONTHLY_LIMIT:
        return {"allowed": False, "message": AI_LIMIT_MSG_MONTHLY}
    return {"allowed": True, "message": ""}

async def increment_ai_usage(device_id: str):
    """Incrementa il contatore d'uso AI (1 doc per dispositivo per giorno)."""
    now = datetime.utcnow()
    day = now.strftime('%Y-%m-%d')
    month = now.strftime('%Y-%m')
    await db.ai_usage.update_one(
        {"device_id": device_id, "day": day},
        {"$inc": {"count": 1}, "$setOnInsert": {"month": month}},
        upsert=True,
    )

# ═══ Round 67 — LOOKUP REGIONE/PROVINCIA per il protocollo di localizzazione AI ═══
# Cache in-memory: città → {regione, provincia}. Usa Open-Meteo geocoding
# (admin1 = regione, admin2 = provincia) senza chiavi API.
_region_cache: dict = {}

async def get_region_info(citta: str) -> dict:
    """Risolve la città del mercato in {regione, provincia} (best effort)."""
    key = (citta or "").strip().lower()
    if not key:
        return {}
    if key in _region_cache:
        return _region_cache[key]
    try:
        async with httpx.AsyncClient(timeout=6) as client_http:
            resp = await client_http.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": citta, "count": 3, "language": "it"},
            )
            if resp.status_code == 200:
                results = (resp.json() or {}).get("results") or []
                # Preferisci risultati italiani
                it = [r for r in results if r.get("country_code", "").lower() == "it"]
                r = (it or results)[0] if results else None
                if r:
                    info = {
                        "regione": r.get("admin1", ""),
                        "provincia": r.get("admin2", ""),
                        "paese": r.get("country", ""),
                    }
                    _region_cache[key] = info
                    return info
    except Exception as e:
        logger.warning(f"get_region_info failed for '{citta}': {e}")
    _region_cache[key] = {}
    return {}


async def resolve_markets_list(raw_list: str) -> dict:
    """Round 69 — Risolve una lista di città (separator pipe `|`, virgola o newline)
    aggregando le regioni/province trovate. Ritorna:
      {
        "primary_regione": "...",        # regione più frequente
        "primary_provincia": "...",      # provincia più frequente nella primary_regione
        "regioni": [...],                # tutte le regioni uniche trovate
        "province": [...],               # tutte le province uniche trovate
        "citta_count": N,
      }
    Usato per dedurre la provincia dal pool di mercati dell'utente senza chiedergli
    di configurare una provincia in Impostazioni.
    """
    if not raw_list or not raw_list.strip():
        return {}
    # Normalizza separatori
    raw = raw_list.replace("|", ",").replace("\n", ",").replace(";", ",")
    cities = [c.strip() for c in raw.split(",") if c.strip()]
    if not cities:
        return {}
    # Risolvi in parallelo (ma limita a 8 per non sovraccaricare il geocoder)
    cities = cities[:8]
    import asyncio as _asyncio
    results = await _asyncio.gather(*(get_region_info(c) for c in cities), return_exceptions=True)
    regioni_count: dict = {}
    province_count: dict = {}
    region_province_map: dict = {}
    for r in results:
        if not isinstance(r, dict):
            continue
        reg = (r.get("regione") or "").strip()
        prov = (r.get("provincia") or "").strip()
        if reg:
            regioni_count[reg] = regioni_count.get(reg, 0) + 1
            region_province_map.setdefault(reg, {})
            if prov:
                region_province_map[reg][prov] = region_province_map[reg].get(prov, 0) + 1
        if prov:
            province_count[prov] = province_count.get(prov, 0) + 1
    if not regioni_count and not province_count:
        return {}
    # Primary regione = la più frequente
    primary_reg = max(regioni_count.items(), key=lambda kv: kv[1])[0] if regioni_count else ""
    # Primary provincia = la più frequente NELLA primary_reg (sicilia ha più province)
    primary_prov = ""
    if primary_reg and region_province_map.get(primary_reg):
        primary_prov = max(region_province_map[primary_reg].items(), key=lambda kv: kv[1])[0]
    elif province_count:
        primary_prov = max(province_count.items(), key=lambda kv: kv[1])[0]
    return {
        "primary_regione": primary_reg,
        "primary_provincia": primary_prov,
        "regioni": sorted(regioni_count.keys()),
        "province": sorted(province_count.keys()),
        "citta_count": len(cities),
    }


# ═══ Round 70 — CALENDARIO ITALIANO (lato backend) ═══
# Replicato in Python perché il frontend con la sua mappa città→regione
# hardcoded copre solo i capoluoghi. Backend usa il geocoder per QUALSIASI città.
def _easter_sunday(year: int):
    """Algoritmo Gauss-Meeus per Pasqua (data Gregoriana)."""
    import datetime as _dt
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return _dt.date(year, month, day)


def _italian_holidays(year: int):
    """12 festività nazionali italiane per l'anno."""
    import datetime as _dt
    easter = _easter_sunday(year)
    easter_monday = easter + _dt.timedelta(days=1)
    return [
        (_dt.date(year, 1, 1), "Capodanno"),
        (_dt.date(year, 1, 6), "Epifania"),
        (easter, "Pasqua"),
        (easter_monday, "Pasquetta"),
        (_dt.date(year, 4, 25), "Festa della Liberazione"),
        (_dt.date(year, 5, 1), "Festa dei Lavoratori"),
        (_dt.date(year, 6, 2), "Festa della Repubblica"),
        (_dt.date(year, 8, 15), "Ferragosto"),
        (_dt.date(year, 11, 1), "Ognissanti"),
        (_dt.date(year, 12, 8), "Immacolata Concezione"),
        (_dt.date(year, 12, 25), "Natale"),
        (_dt.date(year, 12, 26), "Santo Stefano"),
    ]


def _school_closures_for_region(year: int, regione: str):
    """Finestre di chiusura scolastica per la regione (anno solare).
    Ritorna lista di tuple (from_date, to_date, name).
    """
    import datetime as _dt
    r = (regione or "").lower().strip()
    out = []
    # Natalizie (attraversano anno: 23 dic anno → 6 gen anno+1)
    out.append((_dt.date(year, 12, 23), _dt.date(year + 1, 1, 6), "Vacanze natalizie"))
    # Pasquali (Giovedì Santo → Martedì di Pasqua)
    easter = _easter_sunday(year)
    out.append((easter - _dt.timedelta(days=3), easter + _dt.timedelta(days=2), "Vacanze pasquali"))
    # Estive (variano per regione)
    south = {"sicilia", "puglia", "calabria", "basilicata", "campania", "sardegna"}
    north = {"lombardia", "piemonte", "liguria", "valle d'aosta", "veneto",
             "friuli-venezia giulia", "trentino-alto adige", "emilia-romagna"}
    if r in south:
        out.append((_dt.date(year, 6, 8), _dt.date(year, 9, 12), "Vacanze estive"))
    elif r in north:
        out.append((_dt.date(year, 6, 8), _dt.date(year, 9, 11), "Vacanze estive"))
    else:
        out.append((_dt.date(year, 6, 11), _dt.date(year, 9, 11), "Vacanze estive"))
    # Carnevale (Lunedì + Martedì grasso) — per regioni che lo osservano
    if r in {"veneto", "friuli-venezia giulia", "trentino-alto adige", "emilia-romagna", "lombardia"}:
        martedi_grasso = easter - _dt.timedelta(days=47)
        out.append((martedi_grasso - _dt.timedelta(days=1), martedi_grasso, "Vacanze carnevale"))
    return out


def build_calendar_context_block(regione: str, days_ahead: int = 90) -> str:
    """Genera il blocco CALENDARIO_CONTESTUALE per i prossimi N giorni.
    Festività nazionali (sempre) + chiusure scolastiche regionali se regione nota.
    """
    import datetime as _dt
    today = _dt.date.today()
    end = today + _dt.timedelta(days=days_ahead)
    lines = []

    # Festività
    years = {today.year}
    if end.year != today.year:
        years.add(end.year)
    holidays = []
    for y in sorted(years):
        for d, name in _italian_holidays(y):
            if today <= d <= end:
                holidays.append((d, name))
    holidays.sort()
    if holidays:
        lines.append("Festività nazionali nel range:")
        for d, name in holidays:
            lines.append(f"  • {d.isoformat()} → {name}")

    # Chiusure scolastiche per regione (se nota)
    if regione and regione.strip():
        closures_lines = []
        seen = set()
        for y in sorted(years | {today.year - 1}):  # include anno prec per natalizie a cavallo
            for f, t, name in _school_closures_for_region(y, regione):
                # Interseca con [today, end]
                if t < today or f > end:
                    continue
                key = (f.isoformat(), t.isoformat(), name)
                if key in seen:
                    continue
                seen.add(key)
                closures_lines.append((f, t, name))
        closures_lines.sort()
        if closures_lines:
            lines.append(f"Chiusure scolastiche ({regione}):")
            for f, t, name in closures_lines:
                lines.append(f"  • {f.isoformat()} → {t.isoformat()}: {name}")

    return "\n".join(lines) if lines else ""

@api_router.post("/ai/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest):
    llm_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not llm_key:
        return ChatResponse(response="Chiave AI non configurata.", session_id=req.session_id)

    # ═══ Round 67 — RATE LIMITING (10 msg/giorno, 100 msg/mese per dispositivo) ═══
    limiter_id = (req.device_id or "").strip() or f"sess_{req.session_id}"
    try:
        usage = await check_ai_usage(limiter_id)
        if not usage["allowed"]:
            return ChatResponse(response=usage["message"], session_id=req.session_id, limit_reached=True)
    except Exception as e:
        # Fail-open: se il DB non risponde non blocchiamo la chat
        logger.warning(f"AI usage check failed (fail-open): {e}")

    # ═══ Round 74 — MEMORIA PERSISTENTE (auto-detect "ricorda...") ═══
    # Se l'utente scrive "ricorda che X", "memorizza X", "tieni a mente X",
    # salviamo X nelle memorie del device_id PRIMA di mandare il messaggio
    # all'AI, così l'AI ne è consapevole anche al primo turno.
    memory_to_save = _detect_memory_intent(req.message)
    if memory_to_save and limiter_id:
        try:
            await db.ai_user_memory.update_one(
                {"device_id": limiter_id},
                {
                    "$push": {"memories": {"text": memory_to_save[:500], "created_at": datetime.utcnow().isoformat()}},
                    "$setOnInsert": {"device_id": limiter_id, "created_at": datetime.utcnow().isoformat()},
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"Memory save failed: {e}")

    try:
        sid = req.session_id or "default"
        # ═══ SYSTEM MESSAGE STATICO (senza contesto) per permettere aggiornamenti live ═══
        # Round 58 — UNIVERSALIZZAZIONE LOGICA DINAMICA:
        # Tutti i nomi propri di città/mercati/località nel prompt sono stati
        # sostituiti con placeholder generici ({mercato}, {luogo}, {Comune},
        # {Via}, {Brand}, {giornoSettimana}). L'IA deve leggere ESCLUSIVAMENTE
        # i valori dal CONTESTO (Calendario Settimanale dell'utente, Storico
        # Giornate, ecc.) e NON deve mai "inventare" città/mercati basandosi
        # sui suoi training data. Multi-tenant safe per la distribuzione
        # commerciale di MarketMate.
        system_msg = """Sei MarketMate AI, l'assistente STRATEGICO per un'attività di commercio ambulante (mercati e fiere).
Il tuo compito è fornire analisi operative basate sui dati geografici, normativi e storici dell'utente.
Rispondi SEMPRE nella lingua usata dall'utente. Linguaggio asciutto, professionale e ULTRA SINTETICO.

═══ 🚧 AMBITO ESCLUSIVO (REGOLA INVIOLABILE) ═══
Tratti ESCLUSIVAMENTE tematiche legate all'app MarketMate e all'attività di commercio ambulante dell'utente:
mercati, fiere, incassi, spese, fornitori, fatture, collaboratori, carburante, meteo operativo, agenda/ordini,
statistiche, normative e bandi DI SETTORE, calendario scolastico (solo come impatto sulle vendite), funzioni dell'app.
⚠️ Se l'utente fa domande GENERICHE fuori tema (politica, sport, ricette, codice, cultura generale, compiti, ecc.)
RIFIUTA gentilmente con UNA sola riga: "Sono l'assistente di MarketMate: posso aiutarti solo su temi legati alla tua attività e ai tuoi dati. 😊" — NON rispondere mai alla domanda fuori tema, nemmeno parzialmente.

═══ 📍 PROTOCOLLO DI LOCALIZZAZIONE DINAMICA ═══
Nel CONTESTO trovi il blocco "MERCATO_INFO" (JSON con citta, provincia, regione, settore).
- Prima di OGNI analisi identifica Regione e Provincia del mercato corrente da MERCATO_INFO.
- Routing dati: adatta OGNI risposta (bandi, normative, calendario scolastico, fiere) ESCLUSIVAMENTE al territorio di competenza del mercato in calendario.
- Coerenza territoriale: NON incrociare MAI dati normativi o scolastici di regioni differenti. L'informazione deve essere sempre strettamente locale.
- Se MERCATO_INFO è vuoto/assente, chiedi all'utente di configurare il mercato in Impostazioni → Agenda Mercati prima di dare analisi territoriali.

═══ 🏫 CALENDARIO SCOLASTICO E ANALISI PREDITTIVA ═══
- Quando rilevante, verifica le date di apertura/chiusura scuole della REGIONE di riferimento (usa la tua conoscenza dei calendari scolastici regionali italiani; se non sei certo delle date esatte, dillo e invita a verificare sul sito della Regione).
- AVVISO STORICO: se il mercato coincide con chiusure scolastiche o ponti, analizza lo storico delle performance di QUEL mercato nei DATI COMPLETI APP. Segnala l'impatto percentuale rilevato in passato e suggerisci azioni correttive (es. gestione merci deperibili, riduzione quantità).

═══ 🏛️ MONITORAGGIO ISTITUZIONALE (ASCO / UNIONE COMMERCIANTI / BANDI) — FUNZIONE PROATTIVA ═══
QUESTA È UNA FUNZIONE PRINCIPALE DELL'APP, NON UN EXTRA: devi parlarne proattivamente.

⚠️⚠️⚠️ REGOLA INVIOLABILE — DEDUCI LA PROVINCIA/REGIONE DAI MERCATI ⚠️⚠️⚠️
- NON chiedere MAI all'utente di "configurare la provincia in Impostazioni".
- NON dire MAI "per darti notizie precise mi serve la provincia, vai in settings".
- Hai TUTTO ciò che ti serve nel blocco MERCATO_INFO:
   • `regione` + `provincia` = ricavate dal mercato di oggi (citta_oggi)
   • `regioni_coperte` + `province_coperte` = aggregate da TUTTI i mercati settimanali
   • `mercati_attivi_count` = quante città copre l'utente
- Se MERCATO_INFO contiene anche solo UNA regione/provincia → usala SENZA scuse.
- Se MERCATO_INFO è completamente vuoto (utente nuovo, nessun mercato configurato) →
  dì: "Aggiungi un mercato in Agenda → Mercati settimanali e potrò darti notizie territoriali precise." (UNA volta, mai ripeterlo).

═══ FORMATO RISPOSTA "BANDI/NORMATIVE" — SELEZIONE ACCURATA ═══
Quando l'utente chiede "bandi", "normative", "ASCO", "Unione Commercianti", "Confcommercio", "convenzioni" o "finanziamenti":
Apri con: "Per il settore {settore} in {Provincia/Regione} ti segnalo le convenzioni più sfruttabili oggi:"

⚠️ Sii ACCURATO e SELETTIVO. Cita SOLO voci concretamente utili agli ambulanti del settore. Per ciascuna:
  • **Tipologia** [chiaro, una riga]
  • **Cosa offre** [vantaggio economico O operativo concreto: %, € risparmio, accesso gratuito, ecc.]
  • **A chi è rivolto** [solo se utile a chiarire]
  • **Dove richiederla** [portale ufficiale + sezione]

⚠️ NON inventare numeri/scadenze precise. NON dire "scade il 31 dicembre 2026" se non l'hai nel contesto.
⚠️ Se NON conosci una convenzione attiva con certezza, NON elencarla. Meglio 3 voci solide che 5 vaghe.

LISTA RIFERIMENTO (citane SOLO quelle che si applicano al settore/zona):
  (1) **Confcommercio + FIVA-Confcommercio (Federazione Italiana Venditori Ambulanti)** —
      Polizza RC ambulanti tariffa convenzionata, formazione SAB/HACCP gratuita per soci,
      CAF/Patronato (730/Unico/ISEE gratis), tutela legale su sanzioni, sconti su carburante (convenzioni Eni Plenitude/Q8/IP), telefonia.
  (2) **Confesercenti + ANVA (Associazione Nazionale Venditori Ambulanti)** —
      Convenzioni assicurazione veicoli/merci, formazione, sportello bandi attivi,
      sconti carburante (IP/Tamoil), assistenza fiscale per forfettari.
  (3) **Camera di Commercio della provincia** —
      Bandi ricorrenti tipici: digitalizzazione PMI (rimborso 40-50% per POS, cassa fiscale telematica, e-commerce),
      formazione (voucher fino a €2.500), Punto Impresa Digitale (consulenza GRATIS).
  (4) **Regione {regione}** —
      Bandi settore commercio ambulante/itinerante: tipicamente apertura primavera/autunno per nuove imprese, ricambio generazionale,
      acquisto attrezzature, mercati e fiere; importi €5.000-€30.000 a fondo perduto.
  (5) **ASCO / Unione Commercianti locale (provinciale)** —
      Accordi su tariffe plateatici/sole, calendario fiere e mercati con priorità soci, polizze furto banco/merce convenzionate.
  (6) **INPS / Agenzia Entrate (autonomi)** —
      Regime forfettario 5%/15%, super deduzione attrezzature (140%), credito imposta acquisto registratore telematico (€100).

⚠️ IMPORTANTE — proattività convenzioni:
Cita una convenzione PARTICOLARMENTE UTILE (con marker "💡 Suggerimento extra:") SOLO se:
  (a) l'utente ti sta chiedendo esplicitamente info su spese/bandi/convenzioni/normative,
  (b) E NON sei nel BRIEFING __INIT_GREETING__.
⛔ NEL BRIEFING __INIT_GREETING__ è VIETATO menzionare convenzioni, bandi, Confcommercio,
   FIVA, Camera di Commercio, calendari scolastici, vacanze estive, normative, suggerimenti
   extra. Il briefing è limitato STRETTAMENTE a 3 voci (meteo, distributore, ordini).
   Tutto il resto si attiva SOLO se l'utente chiede esplicitamente.

Chiudi sempre con: "⚠️ Le convenzioni e i bandi si rinnovano: verifica importi e scadenze attuali sui portali ufficiali."

═══ 📅 CALENDARIO CONTESTUALE (festività + chiusure scolastiche regionali) ═══
Nel CONTESTO trovi (quando disponibile) il blocco "CALENDARIO_CONTESTUALE" con:
  • Festività nazionali nel range visualizzato (date precise)
  • Chiusure scolastiche per la REGIONE del mercato dell'utente
Usa SEMPRE queste date — sono PRE-CALCOLATE e affidabili. NON dire "se non sbaglio" o "credo cada il…".
Quando l'utente chiede calendario, ponti, vacanze o chiusure scuole:
- Cita le date ESATTE dal blocco CALENDARIO_CONTESTUALE.
- Suggerisci impatto operativo: "il {data} è {nome festa/chiusura} a {Regione}: i mercati spesso vendono di più nelle 48h prima (acquisti famiglia), poi calo nei giorni festivi. Considera quantità in più per il {data-2}."
- Per le chiusure scolastiche regionali, ricorda: il periodo varia tra Nord, Centro e Sud Italia.
- ATTRIBUISCI sempre la fonte: "secondo il calendario scolastico {Regione} 2024-25 ufficiale".

═══ 💰 GESTIONE DATI E CALCOLI ═══
- Sottrai SEMPRE costi fissi e variabili (incluso il carburante calcolato sui km specifici del tragitto) dal lordo, salvo flag specifici su voci non detraibili (vedi blocco BILANCIO nel contesto).
- Ottimizzazione: suggerisci di valutare convenzioni locali SOLO se rilevi spese superiori alla media in categorie tipicamente coperte da accordi di zona (carburante, assicurazioni, forniture).

═══ ⚠️ MANDATO DI PRECISIONE (REGOLA INVIOLABILE) ═══
⚠️ NON DEVI MAI inventare nomi di mercati, città, località, fornitori, distributori, importi o condizioni meteo.
⚠️ USA ESCLUSIVAMENTE i valori presenti nel blocco "CONTESTO" ricevuto col messaggio utente. NON usare conoscenze esterne né esempi del passato.
⚠️ Tutti i nomi che vedi negli ESEMPI di questo system prompt sono placeholder generici tra graffe ({mercato}, {luogo}, {Comune}, {Brand}, {Via}, {giornoSettimana}, {fornitore}, ecc.) — DEVI sempre sostituirli con i valori reali letti dal CONTESTO.
⚠️ Se nel CONTESTO il campo "Mercato del OGGI" è VUOTO / "Non specificato" / "—" / null, oppure il blocco METEO REALE è vuoto/non disponibile, oppure i prezzi carburante non sono disponibili → NON inventare alternative. Rispondi al posto del saluto: "Non ho dati sufficienti sulla località inserita per oggi. Apri Impostazioni → Agenda Mercati per aggiungere il mercato di questo giorno."
⚠️ Lo stesso vale per le altre sezioni: se l'array è vuoto SALTA la sezione, NON inventare voci. Mai dire "non ho dati per X" — semplicemente non scrivere nulla su X.

QUANDO IL MESSAGGIO È "__INIT_GREETING__" oppure l'utente ti saluta:
Ti presenti come SE stessi INIZIANDO tu la conversazione (non rispondere, inizia!).

⚠️⚠️⚠️ FORMATO BRIEFING — ROUND 75 (TASSATIVO, MAX 5-6 RIGHE TOTALI) ⚠️⚠️⚠️
Il briefing del Buongiorno DEVE contenere ESCLUSIVAMENTE 3 voci nell'ordine:
   1. METEO + TEMPERATURE del giorno selezionato (oggi/futuro/passato — come da regole sotto)
   2. DISTRIBUTORE PIÙ ECONOMICO sul tragitto (solo se OGGI e se i dati sono nel contesto)
   3. ORDINI PENDENTI (solo se ordiniProssimi nel contesto)

⛔ ASSOLUTAMENTE VIETATO nel briefing iniziale (anche se i dati sono nel contesto):
   ❌ convenzioni, bandi, Confcommercio, FIVA, Camera di Commercio, ASCO
   ❌ vacanze estive, calendari scolastici, festività regionali
   ❌ "💡 Suggerimento extra:", "Per il settore X ti segnalo..."
   ❌ bilancio del giorno, percentuali utile, "Bilancio di oggi: incassati €X..."
   ❌ fatture in scadenza, appuntamenti, fornitori del giorno
   ❌ analisi predittiva settimana, correlazione meteo-incasso
   ❌ CTA finale "Più dati inserisci...", "Hai domande per me?"
   ❌ proposte di chat ("Ti aiuto io?", "Posso dirti...")
L'utente chiederà queste cose ESPLICITAMENTE se le vuole.

✅ ESEMPIO CONFORME (max 4-5 righe):
   "Ciao Francesco! ☀️
    Oggi a Parabiago dai 22° ai 32°, sereno.
    ⛽ Miglior prezzo: Parabiago, IP, Euro 1,749, Via Milano 50 (1.2 km dal percorso).
    📦 Oggi devi preparare ordine per Fornitore Rossi."

❌ ESEMPIO NON CONFORME (questo non lo fare MAI nel briefing):
   "Ciao Francesco! Oggi sereno 22° a Parabiago...
    ⚠️ Questa settimana lordo €300 (-90% vs €3075 precedente)...   ← VIETATO
    Ricorda: vacanze estive in Lombardia fino all'11 settembre... ← VIETATO
    Per alimentare in Provincia di Milano segnalo convenzioni:    ← VIETATO
    - Confcommercio + FIVA..."                                    ← VIETATO

⚠️ DATA DI RIFERIMENTO: All'inizio del CONTESTO trovi "GIORNO SELEZIONATO DALL'UTENTE". Usa SEMPRE quel giorno.
⛔ REGOLA INVIOLABILE (Round 75 — Task 1): l'AI DEVE riportare ESCLUSIVAMENTE dati
   relativi al GIORNO SELEZIONATO. È VIETATO menzionare ordini/appuntamenti/pagamenti
   di giorni precedenti o successivi (es. se l'utente seleziona MERCOLEDÌ, NON parlare
   di martedì o giovedì). Il frontend ha già filtrato i dati per quel giorno specifico.
   Se un campo (ordini/appunti/fatture) è vuoto NON dire nulla — NON andare a pescare
   altrove. NON dire mai "domani"/"ieri" riferito ad altri giorni.
- Se è OGGI: "Oggi {descrizioneMeteo} {temperatura}° a {mercato}".
- Se è FUTURO: "{giornoSettimana} {descrizioneMeteo} a {mercato}, max {tMax}°/min {tMin}° — {consiglioOperativo}".
- Se è PASSATO: "{giornoSettimana} scorso era {descrizioneMeteo}, {temperatura}° a {mercato}".

ESEMPIO DI BRIEFING CONFORME (3 righe + saluto):
   "Ciao Francesco! ☀️
    Oggi sereno 22° a Magenta, giornata ottima per il banco.
    ⛽ Miglior prezzo: Magenta, Q8, Euro 1,749, Via Roma 12.
    📦 Oggi devi preparare ordine per Fornitore Rossi."

REGOLE DETTAGLIATE PER LE 3 VOCI:

1. METEO (in 1 riga precisa REALE dal blocco "═══ METEO ═══"):
   ⚠️⚠️⚠️ REGOLA INVIOLABILE: leggi LETTERALMENTE i numeri dal blocco "═══ METEO ═══" del CONTESTO.
   Il blocco contiene una stringa esatta tipo:
     "METEO REALE Parabiago: Sereno, 18°C–28°C nella fascia mattutina (06:00–13:00); giornata 14–32°C, Vento 8 km/h"
   
   DEVI:
   • Copiare ESATTAMENTE descrizioneMeteo (es. "Sereno", "Coperto", "Pioggia") senza tradurre o variare.
   • Copiare ESATTAMENTE il range mattutino "18°C–28°C" (tMin e tMax dalla fascia 06:00–13:00).
   • NON usare il dato di temperatura istantanea o giornaliero — SOLO il range mattutino.
   • NON inventare/stimare numeri non presenti nel blocco. Se manca un numero, scrivi "—".
   • NON usare temperature da memoria di conversazioni passate.
   
   Format obbligatorio:
     OGGI:    "Oggi a {mercato} {descrizioneMeteo}, dai {tMin}° ai {tMax}° in mattinata."
     FUTURO:  "{giornoSettimana} a {mercato} {descrizioneMeteo}, dai {tMin}° ai {tMax}° in mattinata."
     PASSATO: "{giornoSettimana} scorso a {mercato} era {descrizioneMeteo}, dai {tMin}° ai {tMax}° in mattinata."
   
   ⛔ ERRORI DA NON FARE MAI:
     ❌ NON dire un singolo valore puntuale (es. "25.5°C"). USA SEMPRE IL RANGE.
     ❌ NON inventare condizioni meteo. Usa LETTERALMENTE descrizioneMeteo del contesto.
     ❌ Se il contesto dice "sereno" NON dire "parzialmente nuvoloso" né "soleggiato".
     ❌ NON dare temperature di città diverse da {mercato} ricevuto nel CONTESTO.
     ❌ NON pescare valori da conversazioni precedenti (anche se erano per la stessa città).
   
   ⚠️ Se {mercato} è vuoto nel contesto, NON dare alcuna riga meteo — vai direttamente al punto 2.

2. MIGLIOR RIFORNIMENTO sul tragitto (OBBLIGATORIO solo se OGGI; SALTA se futuro/passato):
   ⚠️⚠️⚠️ REGOLA INVIOLABILE: USA ESCLUSIVAMENTE i distributori PRESENTI nel CONTESTO ricevuto.
   Il backend ha GIÀ filtrato i distributori entro 0.8 km dalla polilinea OSRM {partenza}→{mercato}.
   NON aggiungere distributori che ricordi di altre giornate, NON inventare città.
   Se nel contesto NON ci sono distributori, scrivi: "⛽ Nessun distributore sul percorso oggi."
   FORMATO OBBLIGATORIO (1 riga):
     "⛽ Miglior prezzo: {Comune}, {Brand}, Euro {prezzo}, {Via}"
   Se mancano dati partenza/arrivo, scrivi: "⛽ Aggiungi partenza/arrivo in Settings per i prezzi carburante."

3. ORDINI PENDENTI (SOLO se ordiniProssimi nel contesto):
   "📦 {giornoRelativo} devi preparare ordine per {testo}"
   (giornoRelativo = "Oggi" / "Domani" / "{giornoSettimana}")
   Se l'array è vuoto NON menzionare ordini. NON inventare.

⛔ DOPO QUESTE 3 VOCI SI CHIUDE IL BRIEFING. Niente bilanci, niente CTA, niente offerte.
   L'utente può chiedere TUTTO il resto in chat libera.

⚠️ STILE DEL SALUTO: TONO COLLOQUIALE E MOLTO CONCISO.
- MAX 8-10 righe TOTALI per il saluto.
- Salta le sezioni VUOTE (no dati = no riga). NON dire "non ci sono fatture", "nessun appuntamento", ecc. Stai zitto su quei punti.
- Ordine OBBLIGATORIO delle sezioni quando presenti:
  1. Saluto + meteo oggi
  2. Meteo precisa per DOMANI (sempre — è un dato che si ha sempre, MA SOLO se {mercato} è specificato nel contesto)
  3. Carburante (solo se ci sono prezzi reali nel contesto)
  4. Agenda (fatture/appuntamenti/ordini/scadenze) — accorpa tutto in 1-2 righe brevi
  5. Bilancio realistico (se lordo>0)
  6. 🏛️ PROPOSTA BANDI/UNIONE COMMERCIANTI (se MERCATO_INFO ha la regione — OBBLIGATORIA, vedi sezione dedicata sopra)
  7. CTA finale data entry (sempre)

═══ STILE OBBLIGATORIO — REGOLE CRITICHE ═══
NON usare frasi generiche di incoraggiamento tipo "porta tutto l'occorrente senza esagerare", "buon lavoro", "come va la preparazione". Sii SOLO informativo e CONCRETO.

✅ SCRIVI sempre frasi tipo:
- "Hai la fattura di {fornitore} da €{importo} da pagare entro {data}. Ricordati!"
- "A {mercato} {giornoSettimana} scorso hai avanzato €{importoInvenduto} di {prodotto}. Riduci la quantità!"
- "Domani consegna ordine {fornitore} (€{importo})."
- "Tragitto {partenza}→{mercato}: {km} km A/R."

⚠️⚠️⚠️ KM — REGOLA CRITICA (NON SBAGLIARE) ⚠️⚠️⚠️
Il campo `km` nell'agenda e nel CONTESTO È GIÀ il TOTALE andata + ritorno.
- NON moltiplicarlo MAI per 2.
- NON dire mai "{km} km andata, quindi {km×2} km A/R".
- Se `km`=22 → "22 km A/R" (NON "44 km A/R").
- Per stimare il costo carburante: usa `km` × `costoKm` (costoKm è già €/km totale).
  Es.: km=22, costoKm=0,20 → costo = 22 × 0,20 = €4,40 (NON €8,80).
Se il valore ti sembra "troppo basso" non interpretarlo: il dato è corretto così.

❌ NON SCRIVERE:
- "porta tutto l'occorrente senza esagerare"
- "come va la preparazione?"
- "buon mercato!"
- "preparati per la giornata!"
- frasi vaghe motivazionali
- nomi di città/mercati che NON sono nel contesto

I km del tragitto sono nel campo "km" dell'agenda. Se vedi che è uguale a 0 NON inventare un numero, scrivi "(km non calcolati - imposta partenza in Settings)".

PER TUTTE LE ALTRE DOMANDE (chat libera, NON saluto iniziale):
⚠️ SOLO temi dell'app/attività (vedi AMBITO ESCLUSIVO). Fuori tema → rifiuta con la frase standard.
- Hai accesso COMPLETO a TUTTI i dati dell'utente nel blocco "═══ DATI COMPLETI APP ═══" del CONTESTO. Includono:
  • storico_giornate: TUTTE le giornate con lordo/netto/contanti/POS/fornitori (con tipo detrazione DAILY/WEEKLY/MONTHLY)/spese extra/invenduto
  • ordini_agenda: TUTTI gli ordini segnati dall'utente nell'agenda (data + testo)
  • appunti_agenda: TUTTI gli appunti nell'agenda (data + testo)
  • storico_diario: TUTTE le note del diario per giorno
  • spese_annue: spese fisse annue (assicurazione, INPS, etc.)
  • collaboratori: lista completa con eventuali percentuali
  • fiere: tutte le fiere salvate
  • storico_carburante: tutti i rifornimenti
  • fornitori: lista completa fornitori con prodotti
- USA SEMPRE questi dati per rispondere a qualsiasi domanda numerica/storica/operativa: "quanto ho incassato la settimana scorsa?", "a chi devo pagare?", "qual è il mio fornitore più caro?", "che ordine ho domani?", "qual è la nota di martedì?", "quanto ho speso per la benzina questo mese?", ecc.
- Se l'utente chiede "come va rispetto alla settimana scorsa" → usa confrontoSettimana e dai numeri PRECISI con variazione %.
- Se chiede "qual è il mercato migliore" → usa topMercati.
- Aggrega i dati in tempo reale (es. somma fornitori per nome, conta ordini in un mese, ecc.) — sii MATEMATICAMENTE preciso.
- Cita la data esatta quando rispondi (es. "{giornoSettimana} {gg/mm} hai incassato €{importo}").
- Risposta SINTETICA (max 5-7 righe), tono colloquiale ma informativo.
- Se l'utente chiede di un mercato/fornitore/dato che NON è nei DATI COMPLETI APP, rispondi: "Non trovo {entità} nei tuoi dati. Verifica nelle Impostazioni." NON inventare.
- Emoji naturali, tono amichevole.

REGOLE:
- SEMPRE sintetico, paragrafi CORTI
- Emoji: ☀️ 🌧️ ⛽ 💰 🎪 📅 📦 💸 👋 ⚠️
- NON inventare dati: usa SOLO quelli nel contesto dell'ultimo messaggio utente
- Per gli appuntamenti SEMPRE aggiungi il luogo SOLO quando è effettivamente presente nei dati

═══ INVENDUTO — REGOLA CRITICA ═══
Se nel contesto vedi che la giornata precedente del MEDESIMO mercato ha avuto INVENDUTO (dettaglio_invenduto.totale > 0):
- ⚠️ NON dire MAI "ottimo!" o "bravo!" sull'invenduto. L'invenduto può essere merce DA BUTTARE = perdita reale.
- Avvisa con preoccupazione: "⚠️ Attento, l'ultimo {giornoSettimana} hai avuto €{importo} di invenduto a {mercato}. Potrebbe essere merce da scartare. Tienine conto per oggi: porta meno quantità."
- Se il mercato di OGGI è lo stesso di un precedente con invenduto: "📌 Ricorda: lo scorso {giornoSettimana} avevi €{importo} invenduto a {mercato} — riduci le quantità dei prodotti deperibili."
- Se manca 1 GIORNO al prossimo mercato dello stesso giorno: "🗓️ Domani torni a {mercato} (come {giornoSettimana} scorso). Avevi avuto €{importo} invenduto: regola gli acquisti di stasera/domattina."

═══ DOMANDE SULLE FUNZIONI DELL'APP ═══
Se l'utente ti chiede COME si fa qualcosa nell'app (es: "come salvo?", "dove vedo le statistiche?", "come aggiungo un fornitore?"), rispondi con istruzioni concrete usando questa mappa:

• **Salvare la giornata**: in HOME inserisci LORDO + UN dato tra contanti/POS, le spese → premi SALVA in fondo
• **Modificare un giorno passato**: HOME → tocca la data o usa frecce ◀ ▶ → modifica e ri-salva
• **Aggiungere mercato**: Impostazioni → AGENDA MERCATI → tap sul giorno → inserisci nome/città/km/plateatico
• **Aggiungere fornitore**: Impostazioni → FORNITORI → "+" → nome
• **Aggiungere collaboratore**: Impostazioni → COLLABORATORI → "+" → nome
• **Spese fisse annue**: Impostazioni → SPESE ANNUE (es. INPS, assicurazione) — vengono ripartite automaticamente
• **Plateatico annuale**: NON in Spese annue! Va dentro la scheda del MERCATO corrispondente in Agenda
• **Statistiche dettagliate**: tab STATISTICHE in basso — grafici lordo/netto, top mercati, top fornitori, areogrammi
• **Riquadro statistiche home**: in fondo alla Home — mese/anno/anno precedente del MEDESIMO mercato
• **Carburante**: Impostazioni → CARBURANTE → ultimo rifornimento (litri+euro) → l'app calcola costo per mercato
• **Note/appuntamenti**: tab AGENDA in basso → nuovo appunto/ordine — appaiono nel calendario Home + 🔔 campanella
• **Backup**: Impostazioni → BACKUP DATI → ESPORTA (file inviabile via WhatsApp/email)
• **Cambiare lingua**: Impostazioni → in alto "Lingua" → seleziona
• **Ripartizione costo fornitore**: in spese fornitore → toggle "PERSONALIZZA" → scegli range giorni; l'importo viene diviso sui giorni di mercato
• **Riavviare la guida**: Impostazioni → RIAVVIA LA GUIDA

═══ ROUND 75 TASK 4 — ANALISI PREDITTIVA METEO ↔ INCASSI ═══
Quando l'utente CHIEDE info su incassi/bilancio settimanale/mensile, o ti chiede consigli
o correlazioni ("come va la settimana?", "come spiegare il calo?", "cosa influisce sull'incasso?"),
DEVI incrociare i dati di lordo/netto con le variabili METEO + EVENTI calendario presenti
nel contesto. Format insight tipico:

  "📊 Questa settimana: lordo €{lordoSett} ({delta_pct}% vs settimana scorsa €{lordoSettPrec}).
   Con T media {tempMedia}°C e {meteoDominante}{eventoCalendario ? ', ' + eventoCalendario : ''},
   {giudizioCausale}. {suggerimentoOperativo}."

Esempi concreti:
• "📊 Questa settimana: lordo €1200 (-25% vs €1600). Con T media 35°C e scuole chiuse, calo
   coerente con caldo eccessivo + assenza famiglie. 💡 Suggerisco di rimodulare l'offerta per
   la prossima settimana: meno fresco, più articoli leggeri/estivi da spiaggia."
• "📈 Questa settimana: lordo €1850 (+15% vs €1600). Con T media 22°C e tempo sereno, weekend
   ottimale. 💡 Mantieni stessa quantità per la prossima settimana, valuta promo sugli articoli
   meno venduti."

⛔ REGOLA INVIOLABILE: usa SOLO i numeri presenti nel contesto. Se mancano temperature o
dati settimana precedente, NON inventare. Dì invece "Non ho ancora dati sufficienti per
fare correlazioni — registra qualche giornata in più con mercato/meteo."

Le correlazioni più potenti da evidenziare:
  - T > 32°C → calo per caldo eccessivo / poca affluenza
  - T < 10°C → calo per freddo / specialmente nelle fasce orarie mattutine
  - Pioggia/temporale → calo significativo sui banchi all'aperto
  - Scuole chiuse → calo famiglie con bambini (settori giocattoli, abbigliamento bimbo)
  - Festività → variazione (positiva se mercato turistico, negativa se locale)
  - Mercato vicino a fiera/evento → potenziale spike

Rispondi in modo amichevole con le istruzioni passo-passo, NIENTE inventare percorsi o nomi di sezioni che non sono in questa lista."""

        # Crea una nuova sessione se non esiste (solo per mantenere la chat history)
        if sid not in chat_sessions:
            chat_sessions[sid] = LlmChat(
                api_key=llm_key,
                session_id=sid,
                system_message=system_msg
            ).with_model("openai", "gpt-4.1-mini")

        chat = chat_sessions[sid]
        
        # ═══ Round 74 — INIETTA MEMORIE PERSISTENTI dell'utente ═══
        # Le memorie sono istruzioni/preferenze/correzioni date dall'utente
        # in chat precedenti (es. "ricorda che il mio fornitore di frutta è
        # Mario" o "non mostrarmi il bilancio nel saluto"). L'AI le riceve
        # come blocco prioritario e DEVE rispettarle.
        user_memories = await get_user_memories(limiter_id, limit=30)
        memoria_block = ""
        if user_memories:
            memoria_block = "\n═══ 📝 MEMORIA UTENTE (preferenze/istruzioni date in precedenza — RISPETTALE SEMPRE) ═══\n"
            for i, m in enumerate(user_memories, 1):
                memoria_block += f"  {i}. {m}\n"
            memoria_block += "⚠️ Se l'utente ha dato istruzioni qui sopra, NON ripetere errori passati e segui le sue preferenze.\n"
        
        # ═══ Round 67/69 — MERCATO_INFO (protocollo localizzazione dinamica) ═══
        # Risolve la città del mercato in regione/provincia E aggrega TUTTI i
        # mercati configurati dall'utente per dedurre l'area territoriale primaria.
        # L'AI NON deve MAI chiedere all'utente di "configurare una provincia
        # in Impostazioni": la deduce da questa lista.
        mercato_info_block = ""
        primary_region_for_calendar = ""
        if (req.mercato_citta or "").strip() or (req.mercati_lista or "").strip():
            region_single = await get_region_info(req.mercato_citta) if (req.mercato_citta or "").strip() else {}
            markets_agg = await resolve_markets_list(req.mercati_lista or "") if (req.mercati_lista or "").strip() else {}
            # Determina regione/provincia "ufficiali" — priorità: mercato di oggi,
            # poi aggregato dai mercati configurati.
            regione = region_single.get("regione") or markets_agg.get("primary_regione", "")
            provincia = region_single.get("provincia") or markets_agg.get("primary_provincia", "")
            paese = region_single.get("paese") or "Italia"
            primary_region_for_calendar = regione
            mercato_info = {
                "citta_oggi": (req.mercato_citta or "").strip(),
                "provincia": provincia,
                "regione": regione,
                "paese": paese,
                "settore": (req.settore or "").strip() or "Alimentare",
            }
            if markets_agg:
                mercato_info["mercati_attivi_count"] = markets_agg.get("citta_count", 0)
                if markets_agg.get("regioni"):
                    mercato_info["regioni_coperte"] = markets_agg["regioni"]
                if markets_agg.get("province"):
                    mercato_info["province_coperte"] = markets_agg["province"]
            mercato_info_block = (
                "=== MERCATO_INFO ===\n"
                + json.dumps(mercato_info, ensure_ascii=False)
                + "\n=== FINE MERCATO_INFO ===\n\n"
            )
        # ═══ Round 68/70 — CALENDARIO_CONTESTUALE (feste + chiusure scolastiche) ═══
        # Round 70: ora il backend genera ESPLICITAMENTE il blocco usando la regione
        # risolta via geocoder (funziona per qualunque città italiana, anche
        # comuni piccoli come Magenta, Bareggio, Cernusco). Il blocco del frontend
        # è usato solo come fallback (la sua mappa hardcoded copre solo i capoluoghi).
        calendario_block = ""
        try:
            backend_calendar = build_calendar_context_block(primary_region_for_calendar, days_ahead=90)
            if backend_calendar:
                calendario_block = (
                    "=== CALENDARIO_CONTESTUALE ===\n"
                    + backend_calendar
                    + "\n=== FINE CALENDARIO_CONTESTUALE ===\n\n"
                )
        except Exception as e:
            logger.warning(f"build_calendar_context_block failed: {e}")
        # Fallback al blocco frontend se il backend non ha potuto generarlo
        if not calendario_block and (req.calendario_contestuale or "").strip():
            calendario_block = (
                "=== CALENDARIO_CONTESTUALE ===\n"
                + req.calendario_contestuale.strip()
                + "\n=== FINE CALENDARIO_CONTESTUALE ===\n\n"
            )
        # ═══ IMPORTANTE: Allega il CONTESTO AGGIORNATO ad ogni messaggio utente ═══
        # Questo garantisce che l'AI veda sempre i dati più recenti del database locale,
        # anche se la sessione era già in cache con contesto stale.
        # Round 74: inietta anche il blocco MEMORIA UTENTE (preferenze persistenti).
        prefix = memoria_block + mercato_info_block + calendario_block
        if req.context and req.context.strip():
            enriched_message = f"{prefix}=== DATI ATTIVITA (aggiornati ora) ===\n{req.context}\n=== FINE DATI ===\n\nMessaggio utente: {req.message}"
        else:
            enriched_message = f"{prefix}{req.message}" if prefix else req.message
        user_msg = UserMessage(text=enriched_message)
        response = await chat.send_message(user_msg)
        # ═══ Round 67 — incrementa il contatore SOLO a chiamata riuscita ═══
        try:
            await increment_ai_usage(limiter_id)
        except Exception as e:
            logger.warning(f"AI usage increment failed: {e}")
        return ChatResponse(response=response, session_id=sid)

    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        return ChatResponse(response=f"Errore: {str(e)}", session_id=req.session_id)

# Round 57: rimosso endpoint POST /api/receipt/analyze
# (la funzionalità OCR scontrino è stata eliminata su richiesta utente)

# ── Fuel Price Helpers ──

async def geocode_city(city_name: str, country_code: str = "") -> dict:
    """Geocode a city name to lat/lon.
    Tries Open-Meteo geocoding (fast, no rate-limit) first; falls back to Nominatim."""
    # ───── Primary: Open-Meteo geocoding ─────
    try:
        async with httpx.AsyncClient(timeout=8) as client_http:
            params = {"name": city_name, "count": 5, "language": "it"}
            resp = await client_http.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results") or []
                if results:
                    # Se è specificato country_code, filtra per quel paese
                    if country_code:
                        filtered = [r for r in results if r.get("country_code", "").lower() == country_code.lower()]
                        if filtered:
                            results = filtered
                    r = results[0]
                    country_name = r.get("country", "")
                    return {
                        "lat": float(r["latitude"]),
                        "lon": float(r["longitude"]),
                        "country": country_name,
                    }
    except Exception as e:
        logger.warning(f"Open-Meteo geocode failed for '{city_name}': {e}")

    # ───── Fallback: Nominatim (può essere rate-limited) ─────
    try:
        async with httpx.AsyncClient(timeout=10) as client_http:
            params = {"q": city_name, "format": "json", "limit": 1}
            if country_code:
                params["countrycodes"] = country_code
            resp = await client_http.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers={"User-Agent": "MarketMate/1.0"}
            )
            if resp.status_code == 200 and resp.json():
                data = resp.json()[0]
                return {"lat": float(data["lat"]), "lon": float(data["lon"]), "country": data.get("display_name", "")}
    except Exception as e:
        logger.warning(f"Nominatim geocode failed for '{city_name}': {e}")
    return {}

def detect_country(display_name: str) -> str:
    """Detect country from Nominatim display_name."""
    name_lower = display_name.lower()
    if "italia" in name_lower or "italy" in name_lower:
        return "IT"
    elif "france" in name_lower or "francia" in name_lower:
        return "FR"
    elif "deutschland" in name_lower or "germany" in name_lower or "germania" in name_lower:
        return "DE"
    elif "españa" in name_lower or "spain" in name_lower or "spagna" in name_lower:
        return "ES"
    elif "portugal" in name_lower or "portogallo" in name_lower:
        return "PT"
    return "OTHER"

async def search_fuel_italy(lat: float, lon: float, fuel_type: str, distance_km: int = 10) -> list:
    """Search cheapest fuel stations in Italy using MIMIT open data API."""
    fuel_map = {"benzina": "benzina", "gasolio": "gasolio", "diesel": "gasolio", "gpl": "gpl"}
    fuel = fuel_map.get(fuel_type.lower(), "benzina")
    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.get(
                "https://prezzi-carburante.onrender.com/api/distributori",
                params={"latitude": lat, "longitude": lon, "distance": distance_km, "fuel": fuel, "results": 3}
            )
            if resp.status_code == 200:
                data = resp.json()
                stations = []
                for s in data if isinstance(data, list) else data.get("results", data.get("distributori", [])):
                    indir_full = s.get("indirizzo", s.get("address", ""))
                    via_part = indir_full
                    comune_part = ""
                    # Caso 1: separatore con virgola "Via Roma 12, 20013 Magenta MI"
                    if "," in indir_full:
                        parts = [p.strip() for p in indir_full.split(",")]
                        via_part = parts[0]
                        if len(parts) >= 2:
                            tail = parts[-1].strip()
                            tokens = tail.split()
                            tokens = [tk for tk in tokens if not (tk.isdigit() and len(tk) == 5)]
                            tokens = [tk for tk in tokens if not (len(tk) == 2 and tk.isupper())]
                            comune_part = " ".join(tokens).strip()
                    else:
                        # Caso 2: nessuna virgola — pattern "VIA ROMA 12 20013 MAGENTA MI"
                        tokens = indir_full.split()
                        if tokens and len(tokens[-1]) == 2 and tokens[-1].isalpha() and tokens[-1].isupper():
                            # Ultimo token = sigla provincia. Cerca CAP (5 cifre) per dividere
                            cap_idx = -1
                            for i, tk in enumerate(tokens):
                                if tk.isdigit() and len(tk) == 5:
                                    cap_idx = i
                                    break
                            if cap_idx >= 0 and cap_idx < len(tokens) - 2:
                                # città = tokens dopo CAP fino a prima della sigla provincia
                                comune_part = " ".join(tokens[cap_idx+1:-1]).strip()
                                via_part = " ".join(tokens[:cap_idx]).strip()
                            else:
                                # senza CAP: prendi penultimo token come città
                                if len(tokens) >= 2:
                                    comune_part = tokens[-2]
                                    via_part = " ".join(tokens[:-2]).strip()
                    # Try alternate explicit fields
                    if not comune_part:
                        comune_part = s.get("comune", s.get("city", ""))
                    brand = s.get("bandiera") or s.get("brand") or s.get("gestore", s.get("nome", ""))
                    nome_op = s.get("gestore", s.get("nome", brand))
                    stations.append(FuelStation(
                        nome=nome_op,
                        indirizzo=indir_full or "N/A",
                        comune=str(comune_part).title() if comune_part else "",
                        brand=str(brand).strip(),
                        prezzo=float(s.get("prezzo", s.get("price", 0))),
                        distanza_km=round(float(s.get("distanza", s.get("distance", 0))), 1),
                        carburante=fuel,
                        lat=float(s["latitudine"]) if s.get("latitudine") else None,
                        lon=float(s["longitudine"]) if s.get("longitudine") else None,
                    ))
                return stations
    except Exception as e:
        logger.error(f"Italy fuel API error: {e}")
    return []

async def search_fuel_france(lat: float, lon: float, fuel_type: str) -> list:
    """Search cheapest fuel stations in France using government open data."""
    fuel_map = {"benzina": "SP95", "gasolio": "Gazole", "diesel": "Gazole", "gpl": "GPLc", "sp95": "SP95", "sp98": "SP98", "e10": "E10"}
    fuel = fuel_map.get(fuel_type.lower(), "SP95")
    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.get(
                "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records",
                params={
                    "where": f"distance(geom, geom'POINT({lon} {lat})', 10km)",
                    "order_by": f"{fuel.lower()}_prix",
                    "limit": 3,
                    "select": f"adresse,ville,{fuel.lower()}_prix,{fuel.lower()}_maj,latitude,longitude"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                stations = []
                for record in data.get("results", []):
                    prix = record.get(f"{fuel.lower()}_prix")
                    if prix:
                        ville = record.get("ville", "")
                        adresse = record.get("adresse", "N/A")
                        stations.append(FuelStation(
                            nome=ville or "N/A",
                            indirizzo=adresse,
                            comune=str(ville).title() if ville else "",
                            brand="",
                            prezzo=float(prix) / 1000 if float(prix) > 100 else float(prix),
                            distanza_km=0,
                            carburante=fuel
                        ))
                return stations
    except Exception as e:
        logger.error(f"France fuel API error: {e}")
    return []

@api_router.post("/fuel/cheapest", response_model=FuelResponse)
async def find_cheapest_fuel(req: FuelRequest):
    try:
        # Geocode departure
        dep_geo = await geocode_city(req.partenza)
        if not dep_geo:
            return FuelResponse(success=False, message=f"Non trovo la città: {req.partenza}")

        # Geocode destination
        dest_geo = await geocode_city(req.destinazione)
        if not dest_geo:
            return FuelResponse(success=False, message=f"Non trovo la città: {req.destinazione}")

        # Calculate distance between the two points
        import math
        dlat = math.radians(dest_geo["lat"] - dep_geo["lat"])
        dlon = math.radians(dest_geo["lon"] - dep_geo["lon"])
        a = math.sin(dlat/2)**2 + math.cos(math.radians(dep_geo["lat"])) * math.cos(math.radians(dest_geo["lat"])) * math.sin(dlon/2)**2
        route_km = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        # ═══ OSRM REAL ROUTE GEOMETRY ═══
        # Otteniamo la sequenza di coordinate REALI lungo la strada percorsa
        # da `partenza` a `destinazione` e usiamo quei punti come centri di
        # ricerca → niente più distributori "fuori percorso".
        route_coords = []
        try:
            osrm_url = (
                f"https://router.project-osrm.org/route/v1/driving/"
                f"{dep_geo['lon']},{dep_geo['lat']};{dest_geo['lon']},{dest_geo['lat']}"
                f"?overview=simplified&geometries=geojson"
            )
            async with httpx.AsyncClient(timeout=8) as client_http:
                osrm_resp = await client_http.get(osrm_url)
                if osrm_resp.status_code == 200:
                    osrm_data = osrm_resp.json()
                    if osrm_data.get("code") == "Ok" and osrm_data.get("routes"):
                        coords = osrm_data["routes"][0].get("geometry", {}).get("coordinates", [])
                        route_coords = [(c[1], c[0]) for c in coords]  # lon,lat → lat,lon
        except Exception as osrm_err:
            logger.warning(f"OSRM route geometry failed: {osrm_err}")

        # Strategia di campionamento adattiva
        if route_km < 15:
            search_radius = 4
            num_samples = 2  # inizio e metà del percorso
        elif route_km < 40:
            search_radius = 5
            num_samples = 4
        else:
            search_radius = 6
            num_samples = 6

        search_points: list[tuple[float, float]] = []
        if route_coords and len(route_coords) >= 2:
            # Campiona N punti UNIFORMEMENTE distribuiti lungo la GEOMETRIA REALE
            step = max(1, len(route_coords) // num_samples)
            for i in range(0, len(route_coords), step):
                search_points.append(route_coords[i])
            # garantisci sempre il punto finale
            if route_coords[-1] not in search_points:
                search_points.append(route_coords[-1])
        else:
            # Fallback: linea retta (vecchia logica)
            fractions = [i / (num_samples - 1) for i in range(num_samples)] if num_samples > 1 else [0.5]
            for frac in fractions:
                lat = dep_geo["lat"] + (dest_geo["lat"] - dep_geo["lat"]) * frac
                lon = dep_geo["lon"] + (dest_geo["lon"] - dep_geo["lon"]) * frac
                search_points.append((lat, lon))

        # Detect country from departure
        country = detect_country(dep_geo.get("country", ""))

        all_stations = []
        seen_names = set()
        # Filtro: rifiuta stazioni che escono dal raggio di ricerca con margine.
        max_distance_per_station = search_radius + 1
        # ═══ FILTRO PERPENDICOLARE alla strada reale ═══
        # Per ogni stazione calcoliamo la distanza minima (in km) dal segmento
        # più vicino della polilinea OSRM. Se è > MAX_OFF_ROUTE_KM rifiutiamo:
        # significa che il distributore è fuori dalla strada di percorrenza.
        # Round 53 (richiesta utente): tolleranza più stretta per precisione.
        # Era 1.5km (svincoli larghi), ora 0.8km → SOLO distributori realmente
        # sul percorso, non quelli su strade parallele o uscite secondarie.
        MAX_OFF_ROUTE_KM = 0.8  # tolleranza laterale stretta (no svincoli larghi)

        def _haversine(lat1, lon1, lat2, lon2):
            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
            return 2 * R * math.asin(math.sqrt(a))

        def _point_to_segment_km(p_lat, p_lon, a_lat, a_lon, b_lat, b_lon):
            """Distanza minima (km) tra il punto P e il segmento A-B (approx flat)."""
            # Conversione approssimata in km usando latitudine media
            mid_lat = (a_lat + b_lat) / 2
            cos_mid = math.cos(math.radians(mid_lat))
            ax, ay = a_lon * 111.32 * cos_mid, a_lat * 111.32
            bx, by = b_lon * 111.32 * cos_mid, b_lat * 111.32
            px, py = p_lon * 111.32 * cos_mid, p_lat * 111.32
            dx, dy = bx - ax, by - ay
            seg_len_sq = dx * dx + dy * dy
            if seg_len_sq <= 1e-9:
                return _haversine(p_lat, p_lon, a_lat, a_lon)
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len_sq))
            cx, cy = ax + t * dx, ay + t * dy
            return math.sqrt((px - cx) ** 2 + (py - cy) ** 2)

        def _distance_from_route(s_lat, s_lon, polyline):
            if not polyline or len(polyline) < 2:
                return 0
            best = float("inf")
            for i in range(len(polyline) - 1):
                a_lat, a_lon = polyline[i]
                b_lat, b_lon = polyline[i + 1]
                d = _point_to_segment_km(s_lat, s_lon, a_lat, a_lon, b_lat, b_lon)
                if d < best:
                    best = d
                    if best < 0.05:
                        break
            return best
        
        for lat, lon in search_points:
            if country == "IT":
                stations = await search_fuel_italy(lat, lon, req.tipo_carburante, search_radius)
            elif country == "FR":
                stations = await search_fuel_france(lat, lon, req.tipo_carburante)
            else:
                return FuelResponse(
                    success=False,
                    country=country,
                    message=f"Prezzi carburante in tempo reale non disponibili per questo paese."
                )
            for s in stations:
                # Filtro #1: rifiuta stazioni fuori dal raggio del punto di campionamento
                if s.distanza_km is not None and s.distanza_km > max_distance_per_station:
                    continue
                # Filtro #2: PERPENDICOLARE alla strada → la stazione deve essere
                # entro MAX_OFF_ROUTE_KM dalla polilinea reale
                if s.lat is not None and s.lon is not None and route_coords:
                    off_route = _distance_from_route(s.lat, s.lon, route_coords)
                    if off_route > MAX_OFF_ROUTE_KM:
                        continue
                key = f"{s.nome}_{s.indirizzo}"
                if key not in seen_names:
                    seen_names.add(key)
                    all_stations.append(s)
        
        # Sort by price and take top 3
        all_stations.sort(key=lambda x: x.prezzo if x.prezzo > 0 else 999)
        top_stations = all_stations[:3]

        if top_stations:
            return FuelResponse(success=True, country=country, stations=top_stations)
        else:
            return FuelResponse(
                success=False,
                country=country,
                message="Nessun distributore trovato lungo il tragitto."
            )

    except Exception as e:
        logger.error(f"Fuel search error: {e}")
        return FuelResponse(success=False, message=f"Errore ricerca carburante: {str(e)}")

@api_router.post("/distance/calculate", response_model=DistanceResponse)
async def calculate_distance(req: DistanceRequest):
    """Calculate REAL road distance via OSRM (OpenStreetMap routing).
    Falls back to haversine × 1.3 if OSRM is unreachable."""
    import math
    try:
        # First geocode departure without country to detect country
        dep_geo = await geocode_city(req.partenza)
        if not dep_geo:
            return DistanceResponse(success=False, message=f"Città non trovata: {req.partenza}")

        # Detect country from departure
        country = detect_country(dep_geo.get("country", ""))
        country_map = {"IT": "it", "FR": "fr", "DE": "de", "ES": "es", "PT": "pt"}
        cc = country_map.get(country, "")

        # Small delay to respect Nominatim rate limits
        import asyncio
        await asyncio.sleep(1.1)

        # Geocode destination with same country for accuracy
        dest_geo = await geocode_city(req.destinazione, cc)
        if not dest_geo:
            return DistanceResponse(success=False, message=f"Città non trovata: {req.destinazione}")

        # ───── PRIMARY: OSRM real road routing ─────
        road_dist = None
        try:
            osrm_url = (
                f"https://router.project-osrm.org/route/v1/driving/"
                f"{dep_geo['lon']},{dep_geo['lat']};{dest_geo['lon']},{dest_geo['lat']}"
                f"?overview=false"
            )
            async with httpx.AsyncClient(timeout=8) as client_http:
                osrm_resp = await client_http.get(osrm_url)
                if osrm_resp.status_code == 200:
                    osrm_data = osrm_resp.json()
                    if osrm_data.get("code") == "Ok" and osrm_data.get("routes"):
                        meters = osrm_data["routes"][0]["distance"]
                        road_dist = round(meters / 1000.0, 1)
        except Exception as osrm_err:
            logger.warning(f"OSRM failed, falling back to haversine: {osrm_err}")

        # ───── FALLBACK: Haversine × 1.3 ─────
        if road_dist is None or road_dist <= 0:
            R = 6371
            lat1, lon1 = math.radians(dep_geo["lat"]), math.radians(dep_geo["lon"])
            lat2, lon2 = math.radians(dest_geo["lat"]), math.radians(dest_geo["lon"])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
            c = 2 * math.asin(math.sqrt(a))
            dist = R * c
            road_dist = round(dist * 1.3, 1)

        round_trip = round(road_dist * 2, 1)

        return DistanceResponse(success=True, km=road_dist, km_andata_ritorno=round_trip, message=f"{req.partenza} → {req.destinazione}: {road_dist} km ({round_trip} km A/R)")

    except Exception as e:
        logger.error(f"Distance calc error: {e}")
        return DistanceResponse(success=False, message=f"Errore calcolo distanza: {str(e)}")

# ── Weather API using Open-Meteo (free, no API key) ──

class WeatherRequest(BaseModel):
    citta: str
    data: Optional[str] = None  # YYYY-MM-DD per previsioni; default = oggi

class WeatherResponse(BaseModel):
    success: bool
    temperatura: float = 0
    temperatura_max: float = 0
    temperatura_min: float = 0
    # Round 76 — range mattutino (06:00-13:00 ora locale Europe/Rome)
    # L'utente ha segnalato che "25.5°C" istantaneo era impreciso:
    # voleva il range della FASCIA DI LAVORO (mattina). Aggiungiamo
    # qui i due valori derivati direttamente da Open-Meteo `hourly`.
    temperatura_mattina_min: float = 0
    temperatura_mattina_max: float = 0
    descrizione: str = ""
    vento_kmh: float = 0
    precipitazioni_mm: float = 0
    message: str = ""
    data: str = ""  # Data effettiva del meteo restituito

@api_router.post("/weather", response_model=WeatherResponse)
async def get_weather(req: WeatherRequest):
    """Get current or forecast weather for a city using Open-Meteo (free API)."""
    try:
        geo = await geocode_city(req.citta)
        if not geo:
            return WeatherResponse(success=False, message=f"Città non trovata: {req.citta}")

        # Determina se è previsione futura o passato/oggi
        from datetime import datetime as _dt, timedelta as _td
        today_d = _dt.now().date()
        target_d = today_d
        is_future = False
        is_past = False
        if req.data:
            try:
                target_d = _dt.strptime(req.data, "%Y-%m-%d").date()
                delta_days = (target_d - today_d).days
                if delta_days > 0:
                    is_future = True
                elif delta_days < 0:
                    is_past = True
            except Exception:
                target_d = today_d

        # WMO codes mapping (riusato)
        wmo_codes = {
            0: "Sereno", 1: "Prevalentemente sereno", 2: "Parzialmente nuvoloso", 3: "Coperto",
            45: "Nebbia", 48: "Nebbia con brina", 51: "Pioviggine leggera", 53: "Pioviggine",
            55: "Pioviggine intensa", 61: "Pioggia leggera", 63: "Pioggia moderata", 65: "Pioggia forte",
            71: "Neve leggera", 73: "Neve moderata", 75: "Neve forte", 77: "Granuli di neve",
            80: "Rovesci leggeri", 81: "Rovesci moderati", 82: "Rovesci violenti",
            85: "Rovesci di neve leggeri", 86: "Rovesci di neve forti",
            95: "Temporale", 96: "Temporale con grandine leggera", 99: "Temporale con grandine forte",
        }

        async with httpx.AsyncClient(timeout=10) as client_http:
            if is_future:
                # FORECAST API - up to 16 days ahead
                # Modello ECMWF IFS HRES (uno dei più accurati per l'Europa,
                # usato anche da 3BMeteo / IlMeteo). Fallback automatico al
                # best_match se il modello specifico non ha copertura.
                days_needed = min(16, max(1, (target_d - today_d).days + 1))
                resp = await client_http.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": geo["lat"],
                        "longitude": geo["lon"],
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
                        "hourly": "temperature_2m",
                        "timezone": "auto",
                        "forecast_days": days_needed,
                        "models": "best_match",
                    }
                )
                if resp.status_code != 200:
                    return WeatherResponse(success=False, message="Errore API meteo")
                data = resp.json()
                daily = data.get("daily", {})
                dates = daily.get("time", [])
                target_str = target_d.strftime("%Y-%m-%d")
                if target_str not in dates:
                    return WeatherResponse(success=False, message=f"Previsione non disponibile per {target_str}")
                idx = dates.index(target_str)
                weather_code = (daily.get("weather_code") or [0])[idx] if idx < len(daily.get("weather_code", [])) else 0
                descrizione = wmo_codes.get(weather_code, f"Codice meteo {weather_code}")
                tmax = (daily.get("temperature_2m_max") or [0])[idx] if idx < len(daily.get("temperature_2m_max", [])) else 0
                tmin = (daily.get("temperature_2m_min") or [0])[idx] if idx < len(daily.get("temperature_2m_min", [])) else 0
                wind = (daily.get("wind_speed_10m_max") or [0])[idx] if idx < len(daily.get("wind_speed_10m_max", [])) else 0
                prec = (daily.get("precipitation_sum") or [0])[idx] if idx < len(daily.get("precipitation_sum", [])) else 0
                tavg = round((tmax + tmin) / 2, 1)
                # Round 76 — range mattutino 06:00-13:00 dal blocco hourly
                hourly = data.get("hourly", {})
                hourly_times = hourly.get("time", []) or []
                hourly_temps = hourly.get("temperature_2m", []) or []
                morning_temps = []
                for t_iso, temp in zip(hourly_times, hourly_temps):
                    if not isinstance(t_iso, str) or temp is None:
                        continue
                    if t_iso[:10] != target_str:
                        continue
                    try:
                        hour = int(t_iso[11:13])
                        if 6 <= hour <= 13:
                            morning_temps.append(float(temp))
                    except Exception:
                        continue
                temp_morn_min = round(min(morning_temps), 1) if morning_temps else tmin
                temp_morn_max = round(max(morning_temps), 1) if morning_temps else tmax
                return WeatherResponse(
                    success=True,
                    temperatura=tavg,
                    temperatura_max=tmax,
                    temperatura_min=tmin,
                    temperatura_mattina_min=temp_morn_min,
                    temperatura_mattina_max=temp_morn_max,
                    descrizione=descrizione,
                    vento_kmh=wind,
                    precipitazioni_mm=prec,
                    data=target_str,
                    message=f"{req.citta} {target_str}: {descrizione}, mattino {temp_morn_min}–{temp_morn_max}°C (max {tmax}°C / min {tmin}°C), vento {wind} km/h"
                )
            elif is_past:
                # ARCHIVE API
                target_str = target_d.strftime("%Y-%m-%d")
                resp = await client_http.get(
                    "https://archive-api.open-meteo.com/v1/archive",
                    params={
                        "latitude": geo["lat"],
                        "longitude": geo["lon"],
                        "start_date": target_str,
                        "end_date": target_str,
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
                        "timezone": "auto",
                    }
                )
                if resp.status_code != 200:
                    return WeatherResponse(success=False, message="Errore API meteo (archivio)")
                data = resp.json()
                daily = data.get("daily", {})
                weather_code = (daily.get("weather_code") or [0])[0] if daily.get("weather_code") else 0
                descrizione = wmo_codes.get(weather_code, f"Codice meteo {weather_code}")
                tmax = (daily.get("temperature_2m_max") or [0])[0] if daily.get("temperature_2m_max") else 0
                tmin = (daily.get("temperature_2m_min") or [0])[0] if daily.get("temperature_2m_min") else 0
                wind = (daily.get("wind_speed_10m_max") or [0])[0] if daily.get("wind_speed_10m_max") else 0
                prec = (daily.get("precipitation_sum") or [0])[0] if daily.get("precipitation_sum") else 0
                tavg = round((tmax + tmin) / 2, 1) if (tmax or tmin) else 0
                return WeatherResponse(
                    success=True,
                    temperatura=tavg, temperatura_max=tmax, temperatura_min=tmin,
                    descrizione=descrizione, vento_kmh=wind, precipitazioni_mm=prec,
                    data=target_str,
                    message=f"{req.citta} {target_str}: {descrizione}, max {tmax}°C / min {tmin}°C"
                )
            else:
                # CURRENT (oggi) — Round 76: include hourly per range mattutino 06:00-13:00
                resp = await client_http.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": geo["lat"],
                        "longitude": geo["lon"],
                        "current": "temperature_2m,wind_speed_10m,precipitation,weather_code",
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
                        "hourly": "temperature_2m",
                        "timezone": "auto",
                        "forecast_days": 1,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    current = data.get("current", {})
                    daily = data.get("daily", {})
                    weather_code = current.get("weather_code", 0)
                    descrizione = wmo_codes.get(weather_code, f"Codice meteo {weather_code}")
                    today_str = today_d.strftime("%Y-%m-%d")
                    tmax_d = daily.get("temperature_2m_max", [0])[0] if daily.get("temperature_2m_max") else 0
                    tmin_d = daily.get("temperature_2m_min", [0])[0] if daily.get("temperature_2m_min") else 0
                    # Range mattutino dal blocco hourly
                    hourly = data.get("hourly", {})
                    hourly_times = hourly.get("time", []) or []
                    hourly_temps = hourly.get("temperature_2m", []) or []
                    morning_temps = []
                    for t_iso, temp in zip(hourly_times, hourly_temps):
                        if not isinstance(t_iso, str) or temp is None:
                            continue
                        if t_iso[:10] != today_str:
                            continue
                        try:
                            hour = int(t_iso[11:13])
                            if 6 <= hour <= 13:
                                morning_temps.append(float(temp))
                        except Exception:
                            continue
                    temp_morn_min = round(min(morning_temps), 1) if morning_temps else tmin_d
                    temp_morn_max = round(max(morning_temps), 1) if morning_temps else tmax_d
                    return WeatherResponse(
                        success=True,
                        temperatura=current.get("temperature_2m", 0),
                        temperatura_max=tmax_d,
                        temperatura_min=tmin_d,
                        temperatura_mattina_min=temp_morn_min,
                        temperatura_mattina_max=temp_morn_max,
                        descrizione=descrizione,
                        vento_kmh=current.get("wind_speed_10m", 0),
                        precipitazioni_mm=current.get("precipitation", 0),
                        data=today_str,
                        message=f"{req.citta} oggi: {descrizione}, mattino {temp_morn_min}–{temp_morn_max}°C (giornata {tmin_d}–{tmax_d}°C), Vento {current.get('wind_speed_10m', 0)} km/h"
                    )
                return WeatherResponse(success=False, message="Errore API meteo")
    except Exception as e:
        logger.error(f"Weather error: {e}")
        return WeatherResponse(success=False, message=f"Errore meteo: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

# ═══ ROUND 74 — STATISTICHE METEO STORICHE PER MERCATO ═══
# Endpoint: POST /api/weather/historical-markets
# Per ogni mercato + lista di date, recupera temperature storiche
# nella fascia 06:00-13:00 da Open-Meteo Archive API e restituisce la
# media giornaliera e quella complessiva del mercato.
#
# Open-Meteo Archive API: gratuita, no rate-limit per usi modesti,
# dati storici dal 1940 ad oggi, risoluzione oraria.
# Doc: https://open-meteo.com/en/docs/historical-weather-api

class _WeatherMarketRequest(BaseModel):
    mercato: str
    dates: List[str]  # ISO YYYY-MM-DD

class WeatherHistoricalMarketsRequest(BaseModel):
    items: List[_WeatherMarketRequest]

# Cache in-memory per evitare di colpire l'API ripetutamente su stessi mercati/date
_weather_cache: Dict[str, Dict[str, float]] = {}  # {mercato: {date_iso: temp_avg}}

@app.post("/api/weather/historical-markets")
async def weather_historical_markets(req: WeatherHistoricalMarketsRequest):
    """
    Recupera temperatura media mattutina (06:00-13:00) per mercato/data
    storica. Risolve il nome del mercato in lat/lon via geocoder
    (Open-Meteo geocoding → fallback Nominatim), poi chiama Archive API.
    
    Risposta:
      {
        items: [
          {
            mercato: "Magenta",
            avg_temp_morning: 18.5,        // media globale sul periodo
            sample_size: 12,                // n. giorni con dati validi
            days: [
              {date: "2026-06-15", temp: 17.2},
              {date: "2026-06-22", temp: 19.8},
              ...
            ],
            lat: 45.5701, lon: 8.8551,
            error: null                     // o messaggio se geocode fallisce
          },
          ...
        ]
      }
    """
    results: List[Dict[str, Any]] = []
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        for item in req.items:
            mercato_nome = (item.mercato or "").strip()
            if not mercato_nome:
                results.append({
                    "mercato": item.mercato,
                    "avg_temp_morning": None,
                    "sample_size": 0,
                    "days": [],
                    "lat": None, "lon": None,
                    "error": "Nome mercato vuoto",
                })
                continue
            
            # Geocode (usa la funzione esistente, con cache interna)
            # Forziamo country_code="IT" perché i mercati MarketMate sono italiani.
            try:
                geo = await geocode_city(mercato_nome, country_code="IT")
            except Exception as e:
                logger.warning(f"Geocode fallito per '{mercato_nome}': {e}")
                geo = None
            
            if not geo or not geo.get("lat") or not geo.get("lon"):
                results.append({
                    "mercato": mercato_nome,
                    "avg_temp_morning": None,
                    "sample_size": 0,
                    "days": [],
                    "lat": None, "lon": None,
                    "error": "Località non trovata",
                })
                continue
            
            lat = geo["lat"]
            lon = geo["lon"]
            
            # Per ogni data richiesta, recupera temperatura (con cache)
            valid_dates = []
            for d_str in item.dates:
                try:
                    # Valida formato
                    datetime.strptime(d_str, "%Y-%m-%d")
                    valid_dates.append(d_str)
                except Exception:
                    continue
            
            if not valid_dates:
                results.append({
                    "mercato": mercato_nome,
                    "avg_temp_morning": None,
                    "sample_size": 0,
                    "days": [],
                    "lat": lat, "lon": lon,
                    "error": "Nessuna data valida",
                })
                continue
            
            # Determina range dates per la query (min/max)
            valid_dates_sorted = sorted(valid_dates)
            start_date = valid_dates_sorted[0]
            end_date = valid_dates_sorted[-1]
            
            # Check cache
            cache_key = f"{lat:.3f},{lon:.3f}"
            cached = _weather_cache.get(cache_key, {})
            
            missing_dates = [d for d in valid_dates if d not in cached]
            
            if missing_dates:
                # Chiamata API Archive
                try:
                    r = await client.get(
                        "https://archive-api.open-meteo.com/v1/archive",
                        params={
                            "latitude": lat,
                            "longitude": lon,
                            "start_date": start_date,
                            "end_date": end_date,
                            "hourly": "temperature_2m",
                            "timezone": "Europe/Rome",
                        }
                    )
                    if r.status_code == 200:
                        data = r.json()
                        times = data.get("hourly", {}).get("time", [])
                        temps = data.get("hourly", {}).get("temperature_2m", [])
                        
                        # Aggrega temperature per giorno, fascia 06:00-13:00
                        day_temps: Dict[str, List[float]] = {}
                        for t_iso, temp in zip(times, temps):
                            if temp is None:
                                continue
                            # t_iso es. "2026-06-15T07:00"
                            try:
                                dt_part = t_iso[:10]
                                hour = int(t_iso[11:13])
                                if 6 <= hour <= 13:
                                    day_temps.setdefault(dt_part, []).append(float(temp))
                            except Exception:
                                continue
                        
                        # Media per ogni giorno → cache
                        for d_iso, temp_list in day_temps.items():
                            if temp_list:
                                cached[d_iso] = round(sum(temp_list) / len(temp_list), 1)
                        
                        _weather_cache[cache_key] = cached
                except Exception as e:
                    logger.warning(f"Open-Meteo Archive failed for {mercato_nome}: {e}")
            
            # Costruisci risposta usando cache aggiornata
            days_out = []
            temps_for_avg = []
            for d_iso in valid_dates:
                t = cached.get(d_iso)
                if t is not None:
                    days_out.append({"date": d_iso, "temp": t})
                    temps_for_avg.append(t)
            
            avg_global = (
                round(sum(temps_for_avg) / len(temps_for_avg), 1)
                if temps_for_avg else None
            )
            
            results.append({
                "mercato": mercato_nome,
                "avg_temp_morning": avg_global,
                "sample_size": len(temps_for_avg),
                "days": days_out,
                "lat": lat, "lon": lon,
                "error": None if temps_for_avg else "Dati meteo non disponibili",
            })
    
    return {"items": results}

# ═══ DOCUMENTI LEGALI — Pubblicamente accessibili (Round 69) ═══
# Privacy Policy, Termini di Servizio, Cookie Policy.
# URL pubblici utilizzabili sia per l'app sia per il sito www.marketmateapp.info.
@app.get("/api/legal/privacy", response_class=HTMLResponse)
async def legal_privacy():
    return _serve_legal_html("privacy.html")

@app.get("/api/legal/terms", response_class=HTMLResponse)
async def legal_terms():
    return _serve_legal_html("terms.html")

@app.get("/api/legal/cookies", response_class=HTMLResponse)
async def legal_cookies():
    return _serve_legal_html("cookies.html")

@app.get("/api/legal/{doc}/md")
async def legal_md(doc: str):
    """Scarica la versione Markdown del documento. doc = privacy|terms|cookies"""
    mapping = {
        "privacy": "PRIVACY_POLICY.md",
        "terms": "TERMS_OF_SERVICE.md",
        "cookies": "COOKIE_POLICY.md",
    }
    name = mapping.get(doc.lower())
    if not name:
        return {"error": "Documento non trovato"}
    path = ROOT_DIR / "static" / "legal" / name
    if not path.exists():
        return {"error": "File non trovato"}
    return FileResponse(
        path=str(path),
        media_type="text/markdown",
        filename=f"MarketMate-{name}",
        headers={"Cache-Control": "no-cache"},
    )

def _serve_legal_html(filename: str) -> HTMLResponse:
    path = ROOT_DIR / "static" / "legal" / filename
    if not path.exists():
        return HTMLResponse(f"<h1>Documento non trovato: {filename}</h1>", status_code=404)
    try:
        return HTMLResponse(content=path.read_text(encoding="utf-8"), status_code=200)
    except Exception as e:
        return HTMLResponse(f"<h1>Errore: {e}</h1>", status_code=500)


# ═══ PRESENTAZIONE MARKETMATE — Pubblicamente accessibile ═══
# URL: GET /api/presentazione         → HTML stilizzato (visualizzabile + stampabile)
#      GET /api/presentazione/pdf     → download diretto del file HTML
#      GET /api/presentazione/md      → download della versione Markdown
@app.get("/api/presentazione", response_class=HTMLResponse)
async def view_presentazione():
    file_path = ROOT_DIR / "static" / "PRESENTAZIONE_MARKETMATE.html"
    if not file_path.exists():
        return HTMLResponse("<h1>Presentazione non trovata</h1>", status_code=404)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            html = f.read()
        return HTMLResponse(content=html, status_code=200)
    except Exception as e:
        return HTMLResponse(f"<h1>Errore: {e}</h1>", status_code=500)

@app.get("/api/presentazione/html")
async def download_presentazione_html():
    file_path = ROOT_DIR / "static" / "PRESENTAZIONE_MARKETMATE.html"
    if not file_path.exists():
        return {"error": "File non trovato"}
    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename="MarketMate-Presentazione.html",
        headers={
            "Content-Disposition": 'attachment; filename="MarketMate-Presentazione.html"',
            "Cache-Control": "no-cache",
        },
    )

@app.get("/api/presentazione/md")
async def download_presentazione_md():
    file_path = ROOT_DIR / "static" / "PRESENTAZIONE_MARKETMATE.md"
    if not file_path.exists():
        return {"error": "File non trovato"}
    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename="MarketMate-Presentazione.md",
        headers={
            "Content-Disposition": 'attachment; filename="MarketMate-Presentazione.md"',
            "Cache-Control": "no-cache",
        },
    )

# ═══ STORE SCREENSHOTS — Galleria mockup per App Store / Google Play ═══
# URL:
#   GET /api/store-screenshots                  → Galleria HTML con anteprima e link download
#   GET /api/store-screenshots/{platform}/{f}   → Singolo PNG (platform = ios | android)
#   GET /api/store-screenshots/zip/{platform}   → Tutti gli screenshot di una piattaforma in ZIP
@app.get("/api/store-screenshots", response_class=HTMLResponse)
async def store_screenshots_gallery():
    """Galleria visuale di tutti gli screenshot pronti per App Store e Play Store."""
    base = ROOT_DIR / "static" / "store-screenshots"
    ios = sorted((base / "ios").glob("*.png")) if (base / "ios").exists() else []
    android = sorted((base / "android").glob("*.png")) if (base / "android").exists() else []

    def render_grid(items, platform_label, platform_key, size_label):
        cards = []
        for p in items:
            name = p.name
            label = name.replace(".png", "").split("_", 1)[1].replace("_", " ").title()
            cards.append(f'''
            <div class="card">
              <img src="/api/store-screenshots/{platform_key}/{name}" alt="{label}" loading="lazy"/>
              <div class="meta">
                <span class="lbl">{label}</span>
                <a class="dl" href="/api/store-screenshots/{platform_key}/{name}?download=1" download>Scarica</a>
              </div>
            </div>''')
        return f'''
        <section>
          <h2>{platform_label} <small>· {size_label} · {len(items)} screenshot</small></h2>
          <div class="grid">{"".join(cards)}</div>
        </section>'''

    html = f"""<!doctype html>
<html lang="it"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MarketMate — Store Screenshots</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F4F6F4;color:#0E2F26;padding:24px;line-height:1.4}}
  header{{max-width:1200px;margin:0 auto 32px;text-align:center}}
  header h1{{font-size:34px;color:#0E5A4A}}
  header p{{color:#5A6E68;margin-top:8px;font-size:16px}}
  main{{max-width:1200px;margin:0 auto}}
  section{{margin-bottom:48px;background:#fff;border-radius:18px;padding:24px;box-shadow:0 2px 10px rgba(14,90,74,.06)}}
  section h2{{color:#0E5A4A;font-size:22px;margin-bottom:18px}}
  section h2 small{{color:#7C8A86;font-weight:400;font-size:14px;margin-left:8px}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}}
  .card{{background:#F8FAF9;border:1px solid #E0E8E5;border-radius:14px;overflow:hidden;transition:transform .15s}}
  .card:hover{{transform:translateY(-3px);box-shadow:0 6px 18px rgba(14,90,74,.12)}}
  .card img{{width:100%;display:block;background:#D8EDE5}}
  .meta{{padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font-size:13px}}
  .lbl{{font-weight:600;color:#0E2F26}}
  .dl{{color:#0E5A4A;text-decoration:none;font-weight:700;background:#D8EDE5;padding:6px 12px;border-radius:8px;font-size:12px}}
  .dl:hover{{background:#0E5A4A;color:#fff}}
  .tools{{text-align:center;margin-top:18px;padding:18px;background:#0E5A4A;color:#fff;border-radius:14px}}
  .tools a{{display:inline-block;color:#fff;background:#F2B45A;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700;margin:6px}}
  .tools a:hover{{opacity:.88}}
  footer{{text-align:center;color:#7C8A86;font-size:13px;margin-top:32px;padding-top:18px;border-top:1px solid #E0E8E5}}
</style>
</head><body>
<header>
  <h1>📱 MarketMate · Store Screenshots</h1>
  <p>Mockup pronti per Apple App Store e Google Play Console. Clicca "Scarica" per ogni singolo PNG.</p>
</header>
<main>
  {render_grid(ios, "🍏 Apple App Store", "ios", "1290 × 2796 — iPhone 6.7″")}
  {render_grid(android, "🤖 Google Play Store", "android", "1080 × 2400 — 9:20")}
  <div class="tools">
    <strong>Servono in PSD/Sketch?</strong><br/>
    <a href="/api/store-screenshots/zip/ios" download>⬇️ ZIP iOS (5 file)</a>
    <a href="/api/store-screenshots/zip/android" download>⬇️ ZIP Android (8 file)</a>
  </div>
  <footer>MarketMate · Mobile Vendor's Agenda · www.marketmateapp.info</footer>
</main>
</body></html>"""
    return HTMLResponse(content=html, status_code=200)


@app.get("/api/store-screenshots/zip/{platform}")
async def store_screenshots_zip(platform: str):
    """ZIP contenente tutti gli screenshot di una piattaforma."""
    import io
    import zipfile
    if platform not in ("ios", "android"):
        return {"error": "Platform non valida"}
    base = ROOT_DIR / "static" / "store-screenshots" / platform
    if not base.exists():
        return {"error": "Cartella non trovata"}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(base.glob("*.png")):
            zf.write(p, arcname=f"MarketMate-{platform}/{p.name}")
    buf.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="MarketMate-{platform}-screenshots.zip"'},
    )


@app.get("/api/store-screenshots/{platform}/{filename}")
async def store_screenshot_file(platform: str, filename: str, download: int = 0):
    """Serve un singolo screenshot PNG. download=1 → forza download (Content-Disposition)."""
    if platform not in ("ios", "android"):
        return {"error": "Platform non valida (ios|android)"}
    if not filename.endswith(".png") or "/" in filename or ".." in filename:
        return {"error": "Nome file non valido"}
    path = ROOT_DIR / "static" / "store-screenshots" / platform / filename
    if not path.exists():
        return {"error": "File non trovato"}
    headers = {"Cache-Control": "public, max-age=3600"}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="MarketMate-{platform}-{filename}"'
    return FileResponse(path=str(path), media_type="image/png", headers=headers)


# ═══ ENDPOINT BACKUP PERSONALE FRANCESCO ═══
# File pre-confezionato con i dati di "Il Panivendolo" da scaricare e
# importare nell'app pulita tramite "APRI BACKUP" → seleziona il file.
# Endpoint pubblico (senza auth) perché il file è già nel repo controllato.
@app.get("/api/backup/francesco")
async def download_francesco_backup():
    file_path = ROOT_DIR / "static" / "MarketMate-Backup-Francesco.txt"
    if not file_path.exists():
        return {"error": "File non trovato"}
    # application/octet-stream → FORZA il download su qualunque browser
    # (Chrome mobile, Samsung Internet, Firefox mobile, Safari iOS).
    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename="MarketMate-Backup-Francesco.txt",
        headers={
            "Content-Disposition": 'attachment; filename="MarketMate-Backup-Francesco.txt"',
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )

# ═══ PRIVACY POLICY PAGE ═══
# URL pubblico da inserire nel Google Play Store quando richiede la privacy policy
# per le app che dichiarano permessi sensibili (CAMERA).
@app.get("/api/privacy-policy", response_class=HTMLResponse)
async def privacy_policy():
    html = """<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Privacy Policy · MarketMate</title>
<style>
body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; margin: 0; padding: 0; background: #F5F0E6; color: #1A3A3A; }
.wrap { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
h1 { font-size: 32px; margin: 0 0 8px; color: #1E7F85; }
h2 { font-size: 20px; margin: 32px 0 8px; color: #1A3A3A; border-bottom: 2px solid #D8EDE5; padding-bottom: 6px; }
h3 { font-size: 16px; margin: 18px 0 6px; color: #2C5A5C; }
p, li { font-size: 15px; line-height: 1.6; color: #3F5E5C; }
ul { padding-left: 22px; }
.meta { color: #8A9090; font-size: 13px; margin: 4px 0 28px; }
.highlight { background: #FFF; border-left: 4px solid #1E7F85; padding: 14px 18px; border-radius: 6px; margin: 14px 0; }
.contact { background: #FFF; padding: 20px; border-radius: 10px; margin-top: 30px; }
a { color: #1E7F85; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Privacy Policy</h1>
  <p class="meta">MarketMate · Ultimo aggiornamento: maggio 2026 · Versione 1.0</p>

  <div class="highlight">
    <strong>In sintesi:</strong> MarketMate è un'applicazione <strong>offline-first</strong>. Tutti i tuoi dati contabili (giornate, fornitori, carburante, note) sono salvati <strong>solo sul tuo dispositivo</strong>. Non raccogliamo né trasmettiamo i tuoi dati personali ai nostri server senza il tuo consenso esplicito.
  </div>

  <h2>1. Titolare del trattamento</h2>
  <p>Il titolare del trattamento dei dati è <strong>T.V.S di Cavallaro Francesco</strong>, sviluppatore dell'app MarketMate disponibile sul Google Play Store con package <code>it.tvscavallaro.marketmate</code>.</p>

  <h2>2. Dati raccolti e scopo</h2>
  <h3>2.1 Dati salvati localmente sul dispositivo</h3>
  <p>I seguenti dati vengono conservati <strong>esclusivamente nella memoria del tuo telefono</strong> (AsyncStorage / SecureStore) e non vengono trasmessi all'esterno:</p>
  <ul>
    <li>Nome attività e nome titolare (se inseriti)</li>
    <li>Agenda settimanale dei mercati, fornitori, collaboratori</li>
    <li>Storico giornate di vendita, rifornimenti carburante, scontrini</li>
    <li>Note, appunti e ordini dell'agenda</li>
    <li>PIN di sblocco dell'app (archiviato cifrato tramite Android Keystore)</li>
  </ul>

  <h3>2.2 Dati trasmessi a server remoti</h3>
  <p>Alcune funzionalità richiedono il collegamento a servizi esterni, attivate solo su tua richiesta:</p>
  <ul>
    <li><strong>Previsioni meteo:</strong> invio di latitudine e longitudine del mercato alla API open-meteo.com (gratuita, non richiede account).</li>
    <li><strong>Assistente AI "Buongiorno":</strong> invio di un riassunto anonimo dei tuoi dati (importi, giornate) al servizio OpenAI GPT-4 solo quando premi il tasto Buongiorno. Nessun dato personale identificativo viene trasmesso.</li>
    <li><strong>Backup cloud opzionale:</strong> se usi l'account registrato, i tuoi dati possono essere sincronizzati con il nostro server per facilitare il recupero. Questa funzione è <strong>opzionale</strong> e richiede registrazione esplicita.</li>
  </ul>

  <h2>3. Autorizzazioni richieste</h2>
  <ul>
    <li><strong>Fotocamera (<code>android.permission.CAMERA</code>)</strong>: usata esclusivamente per scattare foto della chiusura fiscale del giorno e calcolare la media scontrino. Le foto restano sul tuo dispositivo, non vengono caricate.</li>
    <li><strong>Lettura archivio (<code>READ_EXTERNAL_STORAGE</code>)</strong>: usata per selezionare file di backup o foto dalla galleria. Nessun file viene trasmesso a server esterni.</li>
    <li><strong>Internet</strong>: utilizzata per meteo, assistente AI e backup cloud opzionale.</li>
  </ul>

  <h2>4. Condivisione dei dati</h2>
  <p>MarketMate <strong>non vende, non affitta e non condivide</strong> i tuoi dati personali con terze parti per scopi pubblicitari o di profilazione. Non usiamo SDK di tracking, analytics comportamentali o pubblicità targettizzata.</p>

  <h2>5. Conservazione e cancellazione</h2>
  <p>I dati restano sul tuo dispositivo finché non disinstalli l'app o usi la funzione "Reset App" dalle impostazioni. Se hai attivato il backup cloud, puoi richiedere la cancellazione scrivendo all'indirizzo email in fondo a questa pagina: elimineremo il tuo account entro 7 giorni.</p>

  <h2>6. Sicurezza</h2>
  <ul>
    <li>Il PIN di accesso è salvato cifrato tramite Android Keystore (mai in chiaro).</li>
    <li>Se usi l'account cloud, la connessione è protetta da HTTPS/TLS.</li>
    <li>Le password degli account sono memorizzate nel server tramite hash bcrypt (non reversibili).</li>
  </ul>

  <h2>7. Diritti dell'utente (GDPR)</h2>
  <p>In conformità al Regolamento UE 2016/679 (GDPR), hai diritto di:</p>
  <ul>
    <li>Accedere ai tuoi dati (tutti consultabili nell'app)</li>
    <li>Richiedere la rettifica o la cancellazione</li>
    <li>Esportare i tuoi dati in formato JSON/TXT tramite la funzione "Esporta" dell'app</li>
    <li>Opporti al trattamento disattivando le funzioni opzionali (meteo, AI, cloud)</li>
  </ul>

  <h2>8. Minori</h2>
  <p>MarketMate è un'app per uso professionale destinata a commercianti e operatori di mercato. Non è progettata per bambini sotto i 13 anni e non raccoglie consapevolmente dati di minori.</p>

  <h2>9. Modifiche alla privacy policy</h2>
  <p>Eventuali aggiornamenti saranno pubblicati su questa stessa pagina con l'indicazione della data di revisione in alto.</p>

  <div class="contact">
    <h2 style="margin-top:0;border:0;">Contatti</h2>
    <p><strong>T.V.S di Cavallaro Francesco</strong><br/>
    Email: <a href="mailto:tvscavallaro@gmail.com">tvscavallaro@gmail.com</a><br/>
    App: MarketMate (<code>it.tvscavallaro.marketmate</code>)</p>
  </div>
</div>
</body>
</html>
"""
    return HTMLResponse(content=html)

# Pagina HTML con bottone download evidente — soluzione universale per i telefoni
# che aprono direttamente il text/plain invece di scaricarlo.
@app.get("/api/backup/francesco/page", response_class=HTMLResponse)
async def francesco_backup_page():
    file_path = ROOT_DIR / "static" / "MarketMate-Backup-Francesco.txt"
    if not file_path.exists():
        return HTMLResponse("<h1>File non trovato</h1>", status_code=404)
    # Leggo il contenuto e lo incorporo come Blob nel Javascript della pagina:
    # in questo modo il pulsante crea il file lato browser e lo "scarica" senza
    # alcuna richiesta di rete aggiuntiva. Funziona ovunque.
    import json as _json
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    safe = _json.dumps(content)  # JSON-encoded string per JS
    html = """<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Backup MarketMate · Francesco</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;
  background: #F5F0E6; color: #1A3A3A;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100vh;
}
.card {
  background: #fff; border-radius: 20px; padding: 32px 24px; max-width: 420px; width: 100%;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  text-align: center;
}
h1 { font-size: 24px; margin: 0 0 8px; color: #1A3A3A; }
p { font-size: 14px; line-height: 1.5; color: #5A6A6A; margin: 8px 0 18px; }
ul { text-align: left; font-size: 13px; color: #5A6A6A; line-height: 1.6; padding-left: 20px; }
.btn {
  display: block; width: 100%; padding: 18px 24px; margin-top: 14px;
  background: #1E7F85; color: #fff; border: 0; border-radius: 14px;
  font-size: 16px; font-weight: 800; letter-spacing: 0.4px; text-decoration: none;
  cursor: pointer; box-shadow: 0 4px 12px rgba(30,127,133,0.3);
}
.btn.alt { background: #D4AF37; box-shadow: 0 4px 12px rgba(212,175,55,0.3); }
.btn:active { transform: scale(0.98); }
.note { font-size: 11px; color: #8A9090; margin-top: 16px; }
.success { color: #1E7F85; font-weight: 700; margin-top: 14px; display: none; }
.logo { font-size: 28px; margin-bottom: 6px; }
.divider { font-size: 11px; color: #B0B0A0; margin: 14px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">📦</div>
  <h1>Backup di Francesco</h1>
  <p><strong>Il Panivendolo</strong> — pronto da reimportare</p>
  <ul>
    <li>15 giornate dello storico</li>
    <li>3 collaboratori, 3 fornitori</li>
    <li>Agenda settimanale completa</li>
    <li>5 rifornimenti carburante</li>
    <li>Tutte le impostazioni</li>
  </ul>
  <button class="btn" id="dl-json">⬇️ SCARICA BACKUP (.json)</button>
  <div class="divider">ALTERNATIVA</div>
  <button class="btn alt" id="dl-txt">⬇️ Scarica come .txt</button>
  <div class="success" id="ok">✅ File scaricato! Aprilo in MarketMate → Impostazioni → APRI BACKUP</div>
  <p class="note">Prova prima il <strong>.json</strong>. Se l'app dice "impossibile da leggere", ritorna qui e prova il <strong>.txt</strong>.</p>
</div>
<script>
const FILE_CONTENT = __CONTENT__;
function downloadAs(name, mime) {
  try {
    const blob = new Blob([FILE_CONTENT], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    document.getElementById('ok').style.display = 'block';
  } catch (e) {
    alert('Errore: ' + e.message);
  }
}
document.getElementById('dl-json').addEventListener('click', function() {
  downloadAs('MarketMate-Backup-Francesco.json', 'application/json');
});
document.getElementById('dl-txt').addEventListener('click', function() {
  downloadAs('MarketMate-Backup-Francesco.txt', 'text/plain');
});
</script>
</body>
</html>
"""
    html = html.replace("__CONTENT__", safe)
    return HTMLResponse(content=html)

# ═══ AUTH & MULTI-USER + SYNC ═══
from auth_module import auth_router, sync_router, team_router, init_auth_db
init_auth_db(db)
app.include_router(auth_router)
app.include_router(sync_router)
app.include_router(team_router)

# ═══ STRIPE SUBSCRIPTIONS (Round 68) ═══
from stripe_module import stripe_router, init_stripe_db
init_stripe_db(db)
app.include_router(stripe_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
