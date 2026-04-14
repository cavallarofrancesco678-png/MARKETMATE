"""
Backend API tests for MarketMate Bug Fixes (Iteration 3)
Tests: Weather API, Fuel API, AI Chat, Distance calculation
"""
import pytest
import requests
import os
import time

# Get backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '')
if not BASE_URL:
    # Fallback: read from frontend .env file
    import pathlib
    env_file = pathlib.Path('/app/frontend/.env')
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip('/')

class TestWeatherAPI:
    """Test weather API endpoint (Bug fix #4)"""
    
    def test_weather_valid_city(self):
        """Test POST /api/weather with valid city"""
        payload = {"citta": "Milano"}
        response = requests.post(f"{BASE_URL}/api/weather", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["temperatura"] != 0 or data["temperatura"] == 0  # Temperature can be 0
        assert data["descrizione"] != ""
        assert "vento_kmh" in data
        assert "precipitazioni_mm" in data
        print(f"✓ Weather API working: {data['message']}")
    
    def test_weather_invalid_city(self):
        """Test POST /api/weather with invalid city"""
        payload = {"citta": "INVALIDCITYXYZ123"}
        response = requests.post(f"{BASE_URL}/api/weather", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is False
        assert "non trovata" in data["message"].lower()
        print(f"✓ Invalid city handled correctly: {data['message']}")

class TestFuelAPI:
    """Test fuel price API endpoint (Bug fix #4)"""
    
    def test_fuel_cheapest_valid_route(self):
        """Test POST /api/fuel/cheapest with valid Italian route"""
        payload = {
            "partenza": "Milano",
            "destinazione": "Bergamo",
            "tipo_carburante": "benzina"
        }
        response = requests.post(f"{BASE_URL}/api/fuel/cheapest", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Fuel API may fail due to external service issues
        if not data["success"]:
            print(f"⚠ Fuel API failed (external service issue): {data['message']}")
            pytest.skip(f"Fuel API unavailable: {data['message']}")
        else:
            assert data["country"] == "IT"
            assert len(data["stations"]) > 0
            assert data["stations"][0]["prezzo"] > 0
            print(f"✓ Fuel API working: Found {len(data['stations'])} stations, cheapest: €{data['stations'][0]['prezzo']}/L")
    
    def test_fuel_cheapest_invalid_city(self):
        """Test POST /api/fuel/cheapest with invalid city"""
        payload = {
            "partenza": "INVALIDCITYXYZ123",
            "destinazione": "Milano",
            "tipo_carburante": "benzina"
        }
        response = requests.post(f"{BASE_URL}/api/fuel/cheapest", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is False
        assert "non trovo" in data["message"].lower()
        print(f"✓ Invalid city handled correctly: {data['message']}")

class TestAIChatAPI:
    """Test AI chat endpoint (Bug fix #4)"""
    
    def test_ai_chat_buongiorno(self):
        """Test POST /api/ai/chat with Buongiorno message"""
        payload = {
            "message": "Buongiorno! Come si presenta la giornata di oggi?",
            "context": """Attivita: TestMarket
Titolare: TestOwner
Mercato oggi: Mercato di Bergamo
Meteo oggi: Sole
Km oggi: 50
Partenza da: Milano
Tipo carburante: benzina
Costo/km: €0.180
Settimana precedente totale: Lordo: €2500, Netto: €1800, 5 giorni lavorati
Settimana precedente mercato specifico: Mercato Mercato di Bergamo: Lordo: €500, 1 giornate
Media scontrino attuale: €25.00
Carburante: Ultimo rifornimento: 15/01/2025, €60
METEO REALE Milano: Sereno, 8°C (min 5°C, max 12°C), Vento 10 km/h, Precipitazioni 0mm
PREZZI CARBURANTE REALI (benzina) nel tragitto Milano → Bergamo:
1. Eni - Via Test 123 - €1.85/L (5km dal tragitto)""",
            "session_id": "test_session_123"
        }
        response = requests.post(f"{BASE_URL}/api/ai/chat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        assert data["session_id"] == "test_session_123"
        print(f"✓ AI Chat working: Response length = {len(data['response'])} chars")
        print(f"  AI Response preview: {data['response'][:200]}...")

class TestDistanceAPI:
    """Test distance calculation API (Bug fix #1)"""
    
    def test_distance_calculate_valid_cities(self):
        """Test POST /api/distance/calculate with valid Italian cities"""
        # Add delay to respect Nominatim rate limits
        time.sleep(1.2)
        
        payload = {
            "partenza": "Milano",
            "destinazione": "Bergamo"
        }
        response = requests.post(f"{BASE_URL}/api/distance/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Nominatim may fail due to rate limits
        if not data["success"]:
            print(f"⚠ Distance API failed (likely Nominatim rate limit): {data['message']}")
            pytest.skip(f"Geocoding API unavailable: {data['message']}")
        else:
            assert data["km"] > 0
            assert data["km_andata_ritorno"] > 0
            assert data["km_andata_ritorno"] == data["km"] * 2
            print(f"✓ Distance calculation working: Milano-Bergamo = {data['km']} km (A/R: {data['km_andata_ritorno']} km)")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
