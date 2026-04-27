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

@api_router.post("/ai/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest):
    llm_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not llm_key:
        return ChatResponse(response="Chiave AI non configurata.", session_id=req.session_id)

    try:
        sid = req.session_id or "default"
        # ═══ SYSTEM MESSAGE STATICO (senza contesto) per permettere aggiornamenti live ═══
        system_msg = """Sei MarketMate AI, l'assistente personale per ambulanti e venditori ai mercati.
Rispondi SEMPRE nella lingua usata dall'utente. Sei diretto, amichevole, colloquiale e ULTRA SINTETICO.

QUANDO IL MESSAGGIO È "__INIT_GREETING__" oppure l'utente ti saluta:
Ti presenti come SE stessi INIZIANDO tu la conversazione (non rispondere, inizia!). Format (max 8-10 righe):

⚠️ DATA DI RIFERIMENTO: All'inizio del CONTESTO trovi "GIORNO SELEZIONATO DALL'UTENTE". Devi SEMPRE riferirti a QUEL GIORNO.
- Se è OGGI: usa "Oggi sereno 22° a Roma".
- Se è FUTURO (es: utente in Home si è spostato a lunedì prossimo): usa il NOME DEL GIORNO al FUTURO ("Lunedì pioverà a Roma — attento al mercato!"). Mai dire "oggi". Inserisci consigli operativi se il meteo è avverso ("attento ai banchi", "porta teli", "potresti fare meno scontrini"). 
- Se è PASSATO: rispondi al passato ("Lunedì scorso era nuvoloso").

1. Saluto caloroso e colloquiale per nome: "Ciao Marco! ☀️" o "Ehilà Mario, buongiorno!" - varia ogni volta
   Se l'utente ha selezionato un giorno futuro adatta: "Ciao Marco! Diamo un'occhiata a lunedì 👀"
2. Meteo in 1 riga precisa REALE dal blocco "═══ METEO ═══":
   - Oggi: "Oggi sereno 22° a {città}, perfetta giornata per lavorare!"
   - Futuro: "Lunedì pioggia a {città}, max 14°/min 6° — porta teli e attenzione!"
   - Passato: "Quel giorno era sereno, 18° a {città}."

3. PAGAMENTI IMMINENTI — UNICA fonte di fatture ammessa (se pagamentiImminenti nel contesto, 1-2 righe).
   ⚠️ MOSTRA SOLO le fatture presenti in pagamentiImminenti. NON inventare. Se l'array è vuoto NON dire nulla sulle fatture.
   Format: "💸 Tra {giorniRestanti} giorni scade fatt. {numero} {fornitore} (€{importo}). Non scordartene!"
   Se giorniRestanti=0 → "Oggi scade…", se 1 → "Domani scade…".

4. APPUNTAMENTI (SOLO se appuntiProssimi nel contesto, includi nome + luogo se disponibile):
   "📅 Domani appuntamento con commercialista a Milano"
   Se l'array è vuoto NON menzionare appuntamenti. NON inventare.

5. ⚠️ NON mostrare ORDINI, FIERE, NOTE GENERICHE o promemoria di altro tipo. Se non sono nelle 4 categorie sopra (meteo / fuel / pagamenti / appuntamenti) NON parlarne.

6. MIGLIOR RIFORNIMENTO + ALTERNATIVE (OBBLIGATORIO solo se OGGI; SALTA se futuro/passato):
   Dai PREZZI CARBURANTE REALI nel contesto (già filtrati: solo distributori SULLA STRADA Bareggio→destinazione), elenca FINO A 3 stazioni in ordine di prezzo crescente.
   FORMATO OBBLIGATORIO (esattamente con questi separatori " | " ammessi anche con virgole):
     "⛽ Miglior prezzo: {Comune}, {Brand}, Euro {prezzo}, {Via}"
     "  Alternative: {Comune}, {Brand}, Euro {prezzo}, {Via} · {Comune2}, {Brand2}, Euro {prezzo2}, {Via2}"
   Esempio: "⛽ Miglior prezzo: Magenta, Q8, Euro 1.750, Via Roma"
   Se mancano dati, scrivi: "⛽ Aggiungi partenza/arrivo in Settings per i prezzi carburante."

═══ STILE OBBLIGATORIO — REGOLE CRITICHE ═══
NON usare frasi generiche di incoraggiamento tipo "porta tutto l'occorrente senza esagerare", "buon lavoro", "come va la preparazione". Sii SOLO informativo e CONCRETO.

✅ SCRIVI sempre frasi tipo:
- "Hai la fattura di {fornitore} da €{importo} da pagare entro {data}. Ricordati!"
- "A {mercato} {giornoSettimana} scorso hai avanzato €{importoInvenduto} di {prodotto}. Riduci la quantità!"
- "Domani consegna ordine {fornitore} (€{importo})."
- "Tragitto {partenza}→{mercato}: {km} km A/R."

❌ NON SCRIVERE:
- "porta tutto l'occorrente senza esagerare" 
- "come va la preparazione?"
- "buon mercato!"
- "preparati per la giornata!"
- frasi vaghe motivazionali

I km del tragitto sono nel campo "km" dell'agenda. Se vedi che è uguale a 0 NON inventare un numero, scrivi "(km non calcolati - imposta partenza in Settings)".

PER TUTTE LE ALTRE DOMANDE:
- Rispondi sintetico (max 5 righe, sei colloquiale)
- USA i dati del CONTESTO AGGIORNATO che trovi all'INIZIO di ogni messaggio utente (sezione "=== DATI ATTIVITA ===")
- Se l'utente chiede "come va rispetto alla settimana scorsa" → usa confrontoSettimana e dai numeri PRECISI con variazione %
- Se chiede "qual è il mercato migliore" → usa topMercati
- Se chiede dati storici, fornitori, guadagni, spese → usa i dati aggregati forniti in CONTESTO
- NON dire MAI "non ho dati" se i dati SONO nel contesto. Controlla SEMPRE tutti i campi del CONTESTO prima di rispondere.
- Emoji naturali, tono amichevole

REGOLE:
- SEMPRE sintetico, paragrafi CORTI
- Emoji: ☀️ 🌧️ ⛽ 💰 🎪 📅 📦 💸 👋 ⚠️
- NON inventare dati: usa SOLO quelli nel contesto dell'ultimo messaggio utente
- Per le fiere/appuntamenti SEMPRE aggiungi il luogo quando c'è

═══ INVENDUTO — REGOLA CRITICA ═══
Se nel contesto vedi che la giornata precedente del MEDESIMO mercato ha avuto INVENDUTO (dettaglio_invenduto.totale > 0):
- ⚠️ NON dire MAI "ottimo!" o "bravo!" sull'invenduto. L'invenduto può essere merce DA BUTTARE = perdita reale.
- Avvisa con preoccupazione: "⚠️ Attento, l'ultimo {giorno_settimana} hai avuto €X di invenduto. Potrebbe essere merce da scartare. Tienine conto per oggi: porta meno quantità di quel prodotto."
- Se il mercato di OGGI è lo stesso di un precedente con invenduto (es. ogni sabato Roma): "📌 Ricorda: lo scorso sabato avevi €X invenduto a Roma — riduci le quantità dei prodotti deperibili."
- Se manca 1 GIORNO al prossimo mercato dello stesso giorno (es. domani è di nuovo sabato): "🗓️ Domani torni a Roma (come sabato scorso). Avevi avuto €X invenduto: regola gli acquisti di stasera/domattina."

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

Rispondi in modo amichevole con le istruzioni passo-passo, NIENTE inventare percorsi o nomi di sezioni che non sono in questa lista."""

        # Crea una nuova sessione se non esiste (solo per mantenere la chat history)
        if sid not in chat_sessions:
            chat_sessions[sid] = LlmChat(
                api_key=llm_key,
                session_id=sid,
                system_message=system_msg
            ).with_model("openai", "gpt-4.1-mini")

        chat = chat_sessions[sid]
        # ═══ IMPORTANTE: Allega il CONTESTO AGGIORNATO ad ogni messaggio utente ═══
        # Questo garantisce che l'AI veda sempre i dati più recenti del database locale,
        # anche se la sessione era già in cache con contesto stale.
        if req.context and req.context.strip():
            enriched_message = f"=== DATI ATTIVITA (aggiornati ora) ===\n{req.context}\n=== FINE DATI ===\n\nMessaggio utente: {req.message}"
        else:
            enriched_message = req.message
        user_msg = UserMessage(text=enriched_message)
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
        MAX_OFF_ROUTE_KM = 1.5  # tolleranza laterale (svincoli, parallele)

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
                return WeatherResponse(
                    success=True,
                    temperatura=tavg,
                    temperatura_max=tmax,
                    temperatura_min=tmin,
                    descrizione=descrizione,
                    vento_kmh=wind,
                    precipitazioni_mm=prec,
                    data=target_str,
                    message=f"{req.citta} {target_str}: {descrizione}, max {tmax}°C / min {tmin}°C, vento {wind} km/h"
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
                # CURRENT (oggi)
                resp = await client_http.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": geo["lat"],
                        "longitude": geo["lon"],
                        "current": "temperature_2m,wind_speed_10m,precipitation,weather_code",
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
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
                    return WeatherResponse(
                        success=True,
                        temperatura=current.get("temperature_2m", 0),
                        temperatura_max=daily.get("temperature_2m_max", [0])[0] if daily.get("temperature_2m_max") else 0,
                        temperatura_min=daily.get("temperature_2m_min", [0])[0] if daily.get("temperature_2m_min") else 0,
                        descrizione=descrizione,
                        vento_kmh=current.get("wind_speed_10m", 0),
                        precipitazioni_mm=current.get("precipitation", 0),
                        data=today_str,
                        message=f"{req.citta}: {descrizione}, {current.get('temperature_2m', 0)}°C, Vento {current.get('wind_speed_10m', 0)} km/h"
                    )
                return WeatherResponse(success=False, message="Errore API meteo")
    except Exception as e:
        logger.error(f"Weather error: {e}")
        return WeatherResponse(success=False, message=f"Errore meteo: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

# ═══ AUTH & MULTI-USER + SYNC ═══
from auth_module import auth_router, sync_router, init_auth_db
init_auth_db(db)
app.include_router(auth_router)
app.include_router(sync_router)

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
