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
    prezzo: float = 0
    distanza_km: float = 0
    carburante: str = ""

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
        if sid not in chat_sessions:
            system_msg = f"""Sei MarketMate AI, l'assistente personale per ambulanti e venditori ai mercati.
Rispondi SEMPRE nella lingua usata dall'utente. Sei diretto, amichevole, ULTRA SINTETICO.

QUANDO L'UTENTE TI SALUTA O DICE "BUONGIORNO", rispondi BREVE (max 8-10 righe totali) con questo formato:

1. Saluto rapido al titolare per nome (1 riga, tono colloquiale es: "Buongiorno Mario! ☀️")

2. Meteo in 1 riga: "Oggi sereno 22°" o "Nuvoloso 15°, porta la copertura"

3. PAGAMENTI (se nel contesto c'è pagamentiImminenti): 1-2 righe colloquiali es:
   "💸 Tra 2 giorni scade la fattura di Andrea Pane (€150). Non dimenticartene!"
   Se oggi: "🔔 Oggi paga Andrea Pane €150!"

4. APPUNTAMENTI/ORDINI (1 riga se presenti): "📅 Domani commercialista ore 10" oppure "📦 Giovedì scade ordine X"

5. FIERE (1 riga se ci sono nei prossimi 7 gg): "🎪 Sabato fiera San Magno a Roma"

6. BENZINA (solo 1 riga, la MIGLIORE stazione): "⛽ Miglior rifornim.: Eni Via Roma €1.729/L"

NON elencare MAI ogni distributore. Solo il più economico.
NON fare sezioni lunghe. Max 10 righe totali. Sii colloquiale, amichevole.

PER TUTTE LE ALTRE DOMANDE:
- Rispondi sintetico (max 5 righe se possibile)
- Aiuta sempre con consigli, info, opinioni
- NON dire MAI "non posso aiutarti"

REGOLE:
- SEMPRE sintetico, niente paragrafi lunghi
- Usa emoji dove naturale (☀️ 🌧️ ⛽ 💰 🎪 📅 📦 💸)
- NON inventare dati

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

# ── Fuel Price Helpers ──

async def geocode_city(city_name: str, country_code: str = "") -> dict:
    """Geocode a city name to lat/lon using Nominatim (OpenStreetMap)."""
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
                    stations.append(FuelStation(
                        nome=s.get("gestore", s.get("nome", "N/A")),
                        indirizzo=s.get("indirizzo", s.get("address", "N/A")),
                        prezzo=float(s.get("prezzo", s.get("price", 0))),
                        distanza_km=round(float(s.get("distanza", s.get("distance", 0))), 1),
                        carburante=fuel
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
                        stations.append(FuelStation(
                            nome=record.get("ville", "N/A"),
                            indirizzo=record.get("adresse", "N/A"),
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
        
        # For short routes (<20km), use small radius and few points
        # For longer routes, use more points along the way
        if route_km < 15:
            search_radius = 3
            fractions = [0.2, 0.5, 0.8]
        elif route_km < 40:
            search_radius = 5
            fractions = [0.15, 0.35, 0.5, 0.65, 0.85]
        else:
            search_radius = 8
            fractions = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]
        
        search_points = []
        for frac in fractions:
            lat = dep_geo["lat"] + (dest_geo["lat"] - dep_geo["lat"]) * frac
            lon = dep_geo["lon"] + (dest_geo["lon"] - dep_geo["lon"]) * frac
            search_points.append((lat, lon))

        # Detect country from departure
        country = detect_country(dep_geo.get("country", ""))

        all_stations = []
        seen_names = set()
        
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
    """Calculate distance between two cities using geocoding + Haversine formula."""
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

        # Haversine formula
        R = 6371  # Earth radius in km
        lat1, lon1 = math.radians(dep_geo["lat"]), math.radians(dep_geo["lon"])
        lat2, lon2 = math.radians(dest_geo["lat"]), math.radians(dest_geo["lon"])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))
        dist = R * c
        # Multiply by 1.3 to approximate road distance vs straight line
        road_dist = round(dist * 1.3, 1)
        round_trip = round(road_dist * 2, 1)

        return DistanceResponse(success=True, km=road_dist, km_andata_ritorno=round_trip, message=f"{req.partenza} → {req.destinazione}: {road_dist} km ({round_trip} km A/R)")

    except Exception as e:
        logger.error(f"Distance calc error: {e}")
        return DistanceResponse(success=False, message=f"Errore calcolo distanza: {str(e)}")

# ── Weather API using Open-Meteo (free, no API key) ──

class WeatherRequest(BaseModel):
    citta: str

class WeatherResponse(BaseModel):
    success: bool
    temperatura: float = 0
    temperatura_max: float = 0
    temperatura_min: float = 0
    descrizione: str = ""
    vento_kmh: float = 0
    precipitazioni_mm: float = 0
    message: str = ""

@api_router.post("/weather", response_model=WeatherResponse)
async def get_weather(req: WeatherRequest):
    """Get current weather for a city using Open-Meteo (free API)."""
    try:
        geo = await geocode_city(req.citta)
        if not geo:
            return WeatherResponse(success=False, message=f"Città non trovata: {req.citta}")

        async with httpx.AsyncClient(timeout=10) as client_http:
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

                # Map WMO weather codes to descriptions
                wmo_codes = {
                    0: "Sereno", 1: "Prevalentemente sereno", 2: "Parzialmente nuvoloso", 3: "Coperto",
                    45: "Nebbia", 48: "Nebbia con brina", 51: "Pioviggine leggera", 53: "Pioviggine",
                    55: "Pioviggine intensa", 61: "Pioggia leggera", 63: "Pioggia moderata", 65: "Pioggia forte",
                    71: "Neve leggera", 73: "Neve moderata", 75: "Neve forte", 77: "Granuli di neve",
                    80: "Rovesci leggeri", 81: "Rovesci moderati", 82: "Rovesci violenti",
                    85: "Rovesci di neve leggeri", 86: "Rovesci di neve forti",
                    95: "Temporale", 96: "Temporale con grandine leggera", 99: "Temporale con grandine forte",
                }
                weather_code = current.get("weather_code", 0)
                descrizione = wmo_codes.get(weather_code, f"Codice meteo {weather_code}")

                return WeatherResponse(
                    success=True,
                    temperatura=current.get("temperature_2m", 0),
                    temperatura_max=daily.get("temperature_2m_max", [0])[0] if daily.get("temperature_2m_max") else 0,
                    temperatura_min=daily.get("temperature_2m_min", [0])[0] if daily.get("temperature_2m_min") else 0,
                    descrizione=descrizione,
                    vento_kmh=current.get("wind_speed_10m", 0),
                    precipitazioni_mm=current.get("precipitation", 0),
                    message=f"{req.citta}: {descrizione}, {current.get('temperature_2m', 0)}°C, Vento {current.get('wind_speed_10m', 0)} km/h"
                )
            return WeatherResponse(success=False, message="Errore API meteo")
    except Exception as e:
        logger.error(f"Weather error: {e}")
        return WeatherResponse(success=False, message=f"Errore meteo: {str(e)}")

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
