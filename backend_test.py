#!/usr/bin/env python3
"""
Backend API Testing for MarketMate
Tests the FastAPI backend endpoints
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend .env
BACKEND_URL = "https://fato-status-1.preview.emergentagent.com"

def test_basic_endpoint():
    """Test GET /api/ endpoint"""
    print("🔍 Testing GET /api/ endpoint...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Hello World":
                print("✅ GET /api/ endpoint working correctly")
                return True
            else:
                print(f"❌ Unexpected response content: {data}")
                return False
        else:
            print(f"❌ GET /api/ endpoint failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/ endpoint error: {str(e)}")
        return False

def test_ai_chat_endpoint():
    """Test POST /api/ai/chat endpoint with the exact request from review"""
    print("\n🔍 Testing POST /api/ai/chat endpoint...")
    
    # Exact request from the review
    payload = {
        "message": "Buongiorno! Come si presenta la giornata di oggi?",
        "context": "Attivita: MarketMate\nTitolare: Marco\nMercato oggi: Magenta\nMeteo oggi: SOLE\nKm oggi: 30\nCollaboratori: Luca, Anna\nFornitori: Rossi SRL\nSpese annuali: Assicurazione: 1200/anno\nSettimana precedente: Lordo: 3500, Netto: 2100, 5 giorni lavorati\nCarburante: Ultimo rifornimento: 01/04/2026, 85",
        "session_id": "test_session_1"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ai/chat", 
            json=payload, 
            headers=headers,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Check required fields
                if "response" not in data:
                    print("❌ Missing 'response' field in JSON response")
                    return False
                    
                if "session_id" not in data:
                    print("❌ Missing 'session_id' field in JSON response")
                    return False
                
                # Check if session_id matches
                if data["session_id"] != "test_session_1":
                    print(f"❌ Session ID mismatch. Expected: test_session_1, Got: {data['session_id']}")
                    return False
                
                # Check if response contains structured content
                response_text = data["response"].upper()
                required_sections = ["METEO", "INCASSO", "CARBURANTE", "CONSIGLIO"]
                missing_sections = []
                
                for section in required_sections:
                    if section not in response_text:
                        missing_sections.append(section)
                
                if missing_sections:
                    print(f"❌ Missing required sections in AI response: {missing_sections}")
                    print(f"Response content: {data['response']}")
                    return False
                
                print("✅ POST /api/ai/chat endpoint working correctly")
                print("✅ Response contains all required structured sections")
                return True
                
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                print(f"Raw response: {response.text}")
                return False
                
        else:
            print(f"❌ POST /api/ai/chat endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/ai/chat endpoint error: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting MarketMate Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    results = []
    
    # Test basic endpoint
    results.append(test_basic_endpoint())
    
    # Test AI chat endpoint
    results.append(test_ai_chat_endpoint())
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    print(f"✅ Passed: {sum(results)}")
    print(f"❌ Failed: {len(results) - sum(results)}")
    
    if all(results):
        print("🎉 All tests passed!")
        return 0
    else:
        print("💥 Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())