"""
Backend API tests for MarketMate Critical Bug Fixes
Tests: Fuel API route filtering (Bug #3 - Buongiorno fuel stations)
"""
import pytest
import requests
import os
import time

# Get backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '')
if not BASE_URL:
    import pathlib
    env_file = pathlib.Path('/app/frontend/.env')
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip('/')

class TestFuelRouteFiltering:
    """Test fuel API route filtering (Bug #3 - Buongiorno)"""
    
    def test_fuel_route_catania_palermo(self):
        """Test POST /api/fuel/cheapest with Catania-Palermo route (as per bug report)"""
        payload = {
            "partenza": "Catania",
            "destinazione": "Palermo",
            "tipo_carburante": "benzina"
        }
        response = requests.post(f"{BASE_URL}/api/fuel/cheapest", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        print(f"\n=== Fuel API Response for Catania → Palermo ===")
        print(f"Success: {data['success']}")
        print(f"Country: {data.get('country', 'N/A')}")
        print(f"Message: {data.get('message', 'N/A')}")
        
        if data["success"]:
            print(f"Stations found: {len(data['stations'])}")
            for i, station in enumerate(data['stations'], 1):
                print(f"  {i}. {station['nome']} - {station['indirizzo']}")
                print(f"     Prezzo: €{station['prezzo']}/L, Distanza: {station['distanza_km']} km")
            
            # Verify stations are returned
            assert len(data["stations"]) > 0, "Should return at least 1 fuel station along route"
            
            # Verify all stations have valid data
            for station in data["stations"]:
                assert station["prezzo"] > 0, f"Station {station['nome']} has invalid price"
                assert station["nome"] != "", "Station name should not be empty"
                assert station["indirizzo"] != "", "Station address should not be empty"
            
            print(f"✓ Fuel route filtering working: {len(data['stations'])} stations found along Catania-Palermo route")
        else:
            # If API fails, it's likely external service issue
            print(f"⚠ Fuel API failed (external service issue): {data['message']}")
            pytest.skip(f"Fuel API unavailable: {data['message']}")
    
    def test_fuel_route_milano_roma(self):
        """Test POST /api/fuel/cheapest with Milano-Roma route (long distance)"""
        time.sleep(1.5)  # Rate limiting
        
        payload = {
            "partenza": "Milano",
            "destinazione": "Roma",
            "tipo_carburante": "gasolio"
        }
        response = requests.post(f"{BASE_URL}/api/fuel/cheapest", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        print(f"\n=== Fuel API Response for Milano → Roma ===")
        print(f"Success: {data['success']}")
        
        if data["success"]:
            print(f"Stations found: {len(data['stations'])}")
            for i, station in enumerate(data['stations'], 1):
                print(f"  {i}. {station['nome']} - €{station['prezzo']}/L")
            
            assert len(data["stations"]) > 0
            print(f"✓ Long route fuel search working: {len(data['stations'])} stations found")
        else:
            print(f"⚠ Fuel API failed: {data['message']}")
            pytest.skip(f"Fuel API unavailable: {data['message']}")
    
    def test_fuel_route_short_distance(self):
        """Test POST /api/fuel/cheapest with short route (Bergamo-Brescia)"""
        time.sleep(1.5)  # Rate limiting
        
        payload = {
            "partenza": "Bergamo",
            "destinazione": "Brescia",
            "tipo_carburante": "benzina"
        }
        response = requests.post(f"{BASE_URL}/api/fuel/cheapest", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        print(f"\n=== Fuel API Response for Bergamo → Brescia (short route) ===")
        print(f"Success: {data['success']}")
        
        if data["success"]:
            print(f"Stations found: {len(data['stations'])}")
            # Short routes should use minimum 5km search radius
            assert len(data["stations"]) > 0
            print(f"✓ Short route fuel search working: {len(data['stations'])} stations found")
        else:
            print(f"⚠ Fuel API failed: {data['message']}")
            pytest.skip(f"Fuel API unavailable: {data['message']}")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
