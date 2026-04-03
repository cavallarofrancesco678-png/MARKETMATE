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
    
    # Exact payload as specified in the review request
    payload = {
        "message": "Buongiorno!",
        "context": "Attivita: MarketMate\nTitolare: Marco\nMercato oggi: Magenta\nPartenza da: Milano\nMeteo oggi: SOLE, 25 gradi\nKm oggi: 30\nCosto/km: 0.25\nCollaboratori: Luca, Anna\nFornitori: Rossi SRL\nSpese annuali: Assicurazione: 1200/anno\nSettimana precedente totale: Lordo: 3500, Netto: 2100, 5 giorni lavorati\nSettimana precedente mercato Magenta: Lordo: 800, 1 giornata\nCarburante: Ultimo rifornimento: 01/04/2026, 85 euro",
        "session_id": "test_v2_1"
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
                if data["session_id"] != "test_v2_1":
                    print(f"❌ Session ID mismatch. Expected: test_v2_1, Got: {data['session_id']}")
                    return False
                
                # Check if response contains the 8 structured sections
                response_text = data["response"]
                response_lower = response_text.lower()
                
                print(f"\n📝 AI Response ({len(response_text)} chars):")
                print("-" * 50)
                print(response_text)
                print("-" * 50)
                
                # Check for the 8 required sections
                sections_to_check = [
                    ("Saluto personalizzato", ["marco", "salut", "buongiorno", "ciao"]),
                    ("Meteo", ["meteo", "sole", "25 gradi", "temperatura", "tempo"]),
                    ("Mercato & Percorso", ["milano", "magenta", "mercato", "km", "percorso"]),
                    ("Carburante economico", ["carburante", "distributore", "benzina", "economico", "prezzo"]),
                    ("Incasso specifico mercato Magenta", ["incasso", "settimana", "magenta", "800", "lordo"]),
                    ("Notizie del giorno", ["notizie", "novità", "informazioni"]),
                    ("Promemoria scontrino", ["scontrino", "foto", "chiusura fiscale", "media"]),
                    ("Consiglio del giorno", ["consiglio", "suggerimento", "strategia"])
                ]
                
                found_sections = []
                missing_sections = []
                
                for section_name, keywords in sections_to_check:
                    found = any(keyword in response_lower for keyword in keywords)
                    if found:
                        found_sections.append(section_name)
                    else:
                        missing_sections.append(section_name)
                
                print(f"\n✅ Found sections ({len(found_sections)}/8): {', '.join(found_sections)}")
                if missing_sections:
                    print(f"❌ Missing sections ({len(missing_sections)}/8): {', '.join(missing_sections)}")
                
                # Additional specific checks
                specific_checks = {
                    "Mentions Marco": "marco" in response_lower,
                    "Mentions Milano": "milano" in response_lower,
                    "Mentions Magenta": "magenta" in response_lower,
                    "Mentions weather (SOLE)": any(word in response_lower for word in ["sole", "25", "gradi"]),
                    "Mentions previous earnings": "800" in response_text or "settimana precedente" in response_lower
                }
                
                print("\n🔍 Specific Content Checks:")
                for check_name, result in specific_checks.items():
                    status = "✅" if result else "❌"
                    print(f"{status} {check_name}: {result}")
                
                # Overall assessment
                if len(found_sections) >= 6:
                    print("\n✅ POST /api/ai/chat endpoint working correctly")
                    print("✅ Response contains required structured sections")
                    return True
                else:
                    print(f"\n❌ AI response missing too many sections. Found {len(found_sections)}/8")
                    return False
                
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