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

def test_receipt_analyze_endpoint():
    """Test POST /api/receipt/analyze endpoint with the exact request from review"""
    print("\n🔍 Testing POST /api/receipt/analyze endpoint...")
    
    # Exact payload as specified in the review request
    payload = {
        "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "mercato": "Magenta"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/receipt/analyze", 
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
                
                # Check required fields according to review request
                required_fields = ["success", "totale", "num_scontrini", "media_scontrino", "message"]
                missing_fields = []
                
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"❌ Missing required fields: {missing_fields}")
                    return False
                
                # Validate field types
                type_checks = {
                    "success": bool,
                    "totale": (int, float),
                    "num_scontrini": int,
                    "media_scontrino": (int, float),
                    "message": str
                }
                
                type_errors = []
                for field, expected_type in type_checks.items():
                    if not isinstance(data[field], expected_type):
                        type_errors.append(f"{field} should be {expected_type}, got {type(data[field])}")
                
                if type_errors:
                    print(f"❌ Type validation errors: {type_errors}")
                    return False
                
                print(f"\n📝 Receipt Analysis Response:")
                print(f"   Success: {data['success']}")
                print(f"   Totale: {data['totale']}")
                print(f"   Num Scontrini: {data['num_scontrini']}")
                print(f"   Media Scontrino: {data['media_scontrino']}")
                print(f"   Message: {data['message']}")
                
                # The endpoint should NOT crash even with a tiny test image
                print("✅ POST /api/receipt/analyze endpoint working correctly")
                print("✅ Response structure is correct (endpoint did not crash)")
                return True
                
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                print(f"Raw response: {response.text}")
                return False
                
        else:
            print(f"❌ POST /api/receipt/analyze endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/receipt/analyze endpoint error: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting MarketMate Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Health check endpoint
    results.append(("GET /api/", test_basic_endpoint()))
    
    # Test 2: Receipt OCR endpoint (NEW - PRIORITY)
    results.append(("POST /api/receipt/analyze", test_receipt_analyze_endpoint()))
    
    # Test 3: AI chat endpoint (verify existing still works)
    results.append(("POST /api/ai/chat", test_ai_chat_endpoint()))
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:30} {status}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("💥 Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())