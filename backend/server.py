from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContent
import json
import re


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

class ChatResponse(BaseModel):
    response: str
    session_id: str

class ReceiptAnalyzeRequest(BaseModel):
    image_base64: str
    mercato: str = ""

class ReceiptAnalyzeResponse(BaseModel):
    success: bool
    totale: float = 0
    num_scontrini: int = 0
    media_scontrino: float = 0
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

@api_router.post("/ai/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest):
    llm_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not llm_key:
        return ChatResponse(response="Chiave AI non configurata.", session_id=req.session_id)

    try:
        sid = req.session_id or "default"
        if sid not in chat_sessions:
            system_msg = f"""Sei MarketMate AI, un assistente intelligente per ambulanti e venditori ai mercati.
Rispondi SEMPRE nella lingua usata dall'utente nel messaggio. Sei amichevole, professionale e conciso.

QUANDO L'UTENTE TI SALUTA O DICE "BUONGIORNO", rispondi OBBLIGATORIAMENTE seguendo questa struttura ESATTA (5 sezioni, niente di più):

1. **SALUTO PERSONALIZZATO**: Saluta il titolare per nome usando i dati del contesto. Sii caloroso e motivante.

2. **METEO OGGI**: Riporta semplicemente le condizioni meteo del giorno (temperatura, cielo, vento). Solo i dati, NON dare consigli.

3. **INCASSO SETTIMANA PRECEDENTE**: Mostra l'incasso del mercato di oggi nella settimana precedente (totale lordo, giorni lavorati, media giornaliera) e la media scontrino se disponibile. Se non ci sono dati specifici per questo mercato, usa i dati generali disponibili.

4. **BENZINA**: Calcola il miglior costo carburante lungo il tragitto da casa al mercato e indica in modo rapido e diretto dove fare benzina (zona/distributore più economico). NON consigliare app o siti web.

5. **PROMEMORIA SCONTRINO**: Ricorda brevemente che a fine giornata può fotografare la chiusura fiscale per calcolare automaticamente la media scontrino.

CHIUDI SEMPRE con una frase tipo: "Vuoi altre informazioni?" o "Posso aiutarti con altro?"

REGOLE IMPORTANTI:
- NON dare consigli di nessun tipo
- NON dare notizie del giorno
- NON aggiungere sezioni extra
- Sii conciso e diretto
- Usa emoji dove appropriato
- Formatta con titoletti in grassetto per ogni sezione

Per le domande successive, rispondi normalmente come assistente esperto di mercati ambulanti.

CONTESTO ATTIVITA:
{req.context}"""
            chat_sessions[sid] = LlmChat(
                api_key=llm_key,
                session_id=sid,
                system_message=system_msg
            ).with_model("openai", "gpt-4.1-mini")

        chat = chat_sessions[sid]
        user_msg = UserMessage(text=req.message)
        response = await chat.send_message(user_msg)
        return ChatResponse(response=response, session_id=sid)

    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        return ChatResponse(response=f"Errore: {str(e)}", session_id=req.session_id)

@api_router.post("/receipt/analyze", response_model=ReceiptAnalyzeResponse)
async def analyze_receipt(req: ReceiptAnalyzeRequest):
    llm_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not llm_key:
        return ReceiptAnalyzeResponse(success=False, message="Chiave AI non configurata.")

    try:
        # Clean base64 string (remove data URI prefix if present)
        image_b64 = req.image_base64
        if ',' in image_b64:
            image_b64 = image_b64.split(',', 1)[1]

        ocr_chat = LlmChat(
            api_key=llm_key,
            session_id=f"receipt_{uuid.uuid4()}",
            system_message="""Sei un esperto OCR specializzato nell'analisi di scontrini e chiusure fiscali italiane di registratori di cassa.
Analizza l'immagine dello scontrino/chiusura fiscale e estrai i seguenti dati:

1. TOTALE GIORNALIERO (il totale delle vendite della giornata, cercalo come "TOTALE", "TOT. GIORNALIERO", "GRAN TOTALE", "VENDITE", "CORRISPETTIVI" o simili)
2. NUMERO SCONTRINI (il numero di scontrini/transazioni emessi, cercalo come "N. SCONTRINI", "NR DOCUMENTI", "NUM DOC", "TRANSAZIONI" o simili)

RISPONDI ESCLUSIVAMENTE in formato JSON valido, senza altri testi prima o dopo:
{"totale": 1234.56, "num_scontrini": 45, "media_scontrino": 27.43}

Se non riesci a leggere uno dei valori, usa 0.
La media_scontrino deve essere calcolata come totale / num_scontrini (se num_scontrini > 0).
Se riesci a leggere solo il totale, metti num_scontrini a 0 e media_scontrino a 0.
Se non riesci a leggere nulla, rispondi: {"totale": 0, "num_scontrini": 0, "media_scontrino": 0}"""
        ).with_model("openai", "gpt-4.1-mini")

        file_content = FileContent(content_type="image", file_content_base64=image_b64)
        user_msg = UserMessage(
            text="Analizza questa chiusura fiscale / scontrino e estrai i dati richiesti. Rispondi SOLO con il JSON.",
            file_contents=[file_content]
        )

        response_text = await ocr_chat.send_message(user_msg)
        logger.info(f"OCR response: {response_text}")

        # Parse JSON from response
        # Try to extract JSON from the response even if there's extra text
        json_match = re.search(r'\{[^}]+\}', response_text)
        if json_match:
            data = json.loads(json_match.group())
            totale = float(data.get('totale', 0))
            num_sc = int(data.get('num_scontrini', 0))
            media = float(data.get('media_scontrino', 0))
            if totale > 0 and num_sc > 0 and media == 0:
                media = round(totale / num_sc, 2)
            return ReceiptAnalyzeResponse(
                success=True,
                totale=totale,
                num_scontrini=num_sc,
                media_scontrino=media,
                message=f"Analisi completata: Totale €{totale}, {num_sc} scontrini, Media €{media}"
            )
        else:
            return ReceiptAnalyzeResponse(
                success=False,
                message=f"Non sono riuscito ad estrarre i dati dallo scontrino. Risposta AI: {response_text[:200]}"
            )

    except Exception as e:
        logger.error(f"Receipt OCR error: {e}")
        return ReceiptAnalyzeResponse(success=False, message=f"Errore analisi: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

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
