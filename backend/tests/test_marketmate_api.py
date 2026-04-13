"""
Backend API tests for MarketMate
Tests: Health check, distance calculation, status endpoints
"""
import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check and root endpoint"""
    
    def test_root_endpoint(self):
        """Test GET /api/ returns Hello World"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Hello World"
        print(f"✓ Root endpoint working: {data}")

class TestDistanceCalculation:
    """Test distance calculation between cities"""
    
    def test_distance_calculate_valid_cities(self):
        """Test POST /api/distance/calculate with valid Italian cities"""
        payload = {
            "partenza": "Milano",
            "destinazione": "Roma"
        }
        response = requests.post(f"{BASE_URL}/api/distance/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Note: Nominatim geocoding API may fail due to rate limits or connectivity
        if not data["success"]:
            print(f"⚠ Distance API failed (likely Nominatim rate limit): {data['message']}")
            pytest.skip(f"Geocoding API unavailable: {data['message']}")
        else:
            assert data["km"] > 0
            assert data["km_andata_ritorno"] > 0
            assert data["km_andata_ritorno"] == data["km"] * 2
            print(f"✓ Distance calculation working: Milano-Roma = {data['km']} km (A/R: {data['km_andata_ritorno']} km)")
    
    def test_distance_calculate_invalid_city(self):
        """Test POST /api/distance/calculate with invalid city"""
        payload = {
            "partenza": "INVALIDCITYXYZ123",
            "destinazione": "Roma"
        }
        response = requests.post(f"{BASE_URL}/api/distance/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is False
        assert "non trovata" in data["message"].lower()
        print(f"✓ Invalid city handled correctly: {data['message']}")

class TestStatusEndpoints:
    """Test status check CRUD operations"""
    
    def test_create_status_check(self):
        """Test POST /api/status creates a status check"""
        payload = {
            "client_name": "TEST_MarketMate_Mobile"
        }
        response = requests.post(f"{BASE_URL}/api/status", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["client_name"] == "TEST_MarketMate_Mobile"
        assert "timestamp" in data
        print(f"✓ Status check created: {data['id']}")
    
    def test_get_status_checks(self):
        """Test GET /api/status retrieves status checks"""
        response = requests.get(f"{BASE_URL}/api/status")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Status checks retrieved: {len(data)} records")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
