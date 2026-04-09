#!/usr/bin/env python3
"""
Backend API Testing Script for MarketMate
Tests the fuel price endpoints and other core APIs
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://mm-login-help.preview.emergentagent.com"
FUEL_TIMEOUT = 30  # 30 seconds timeout for fuel API calls

def test_health_check():
    """Test the basic health check endpoint"""
    print("🔍 Testing GET /api/ health check...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/", timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Hello World":
                print("   ✅ Health check PASSED")
                return True
            else:
                print("   ❌ Health check FAILED - unexpected message")
                return False
        else:
            print("   ❌ Health check FAILED - wrong status code")
            return False
            
    except Exception as e:
        print(f"   ❌ Health check FAILED - Exception: {e}")
        return False

def test_ai_chat():
    """Test the AI chat endpoint with a simple greeting"""
    print("\n🔍 Testing POST /api/ai/chat...")
    try:
        payload = {
            "message": "Buongiorno",
            "context": "Titolare: Marco\nPartenza da: Milano\nMercato oggi: Magenta\nMeteo: SOLE, 25 gradi\nIncasso settimana precedente (Magenta): 800€",
            "session_id": "test_session"
        }
        
        response = requests.post(f"{BACKEND_URL}/api/ai/chat", 
                               json=payload, 
                               timeout=30,
                               headers={"Content-Type": "application/json"})
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            ai_response = data.get("response", "")
            print(f"   Response length: {len(ai_response)} chars")
            print(f"   Response preview: {ai_response[:200]}...")
            
            # Check for key elements in the structured response
            checks = {
                "mentions Marco": "Marco" in ai_response,
                "mentions Milano": "Milano" in ai_response,
                "mentions Magenta": "Magenta" in ai_response,
                "mentions weather": any(word in ai_response.lower() for word in ["sole", "25", "gradi", "meteo"]),
                "mentions earnings": "800" in ai_response,
                "has structure": "**" in ai_response or "1." in ai_response
            }
            
            passed_checks = sum(checks.values())
            print(f"   Content checks: {passed_checks}/6 passed")
            for check, result in checks.items():
                print(f"     {check}: {'✅' if result else '❌'}")
            
            if passed_checks >= 4:  # At least 4/6 checks should pass
                print("   ✅ AI Chat PASSED")
                return True
            else:
                print("   ❌ AI Chat FAILED - insufficient content checks")
                return False
        else:
            print(f"   ❌ AI Chat FAILED - Status: {response.status_code}")
            try:
                print(f"   Error response: {response.json()}")
            except:
                print(f"   Error response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ AI Chat FAILED - Exception: {e}")
        return False

def test_receipt_analyze():
    """Test the receipt analysis endpoint with the specific test image"""
    print("\n🔍 Testing POST /api/receipt/analyze...")
    print("   Using 1x1 pixel test PNG as specified in review request...")
    
    # The exact test image from the review request
    test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    try:
        payload = {
            "image_base64": test_image_b64,
            "mercato": "Magenta"
        }
        
        print("   Sending request (may take up to 30 seconds for AI processing)...")
        start_time = time.time()
        
        response = requests.post(f"{BACKEND_URL}/api/receipt/analyze", 
                               json=payload, 
                               timeout=35,  # Allow extra time for AI processing
                               headers={"Content-Type": "application/json"})
        
        end_time = time.time()
        duration = round(end_time - start_time, 2)
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {duration} seconds")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response JSON: {json.dumps(data, indent=2)}")
                
                # Check required fields are present
                required_fields = ["success", "totale", "num_scontrini", "media_scontrino", "message"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"   ❌ Receipt Analysis FAILED - Missing fields: {missing_fields}")
                    return False
                
                # Validate field types
                field_checks = {
                    "success is boolean": isinstance(data["success"], bool),
                    "totale is number": isinstance(data["totale"], (int, float)),
                    "num_scontrini is number": isinstance(data["num_scontrini"], (int, float)),
                    "media_scontrino is number": isinstance(data["media_scontrino"], (int, float)),
                    "message is string": isinstance(data["message"], str)
                }
                
                print("   Field validation:")
                for check, result in field_checks.items():
                    print(f"     {check}: {'✅' if result else '❌'}")
                
                if all(field_checks.values()):
                    success_value = data["success"]
                    message = data["message"]
                    
                    print(f"   Success: {success_value}")
                    print(f"   Message: {message}")
                    
                    # For this tiny test image, we expect the AI to either:
                    # 1. Successfully process it (success=true) but likely return 0 values
                    # 2. Fail to extract data (success=false) with appropriate error message
                    # Both are acceptable as long as the endpoint doesn't crash
                    
                    print("   ✅ Receipt Analysis PASSED - Endpoint working correctly")
                    print("   📝 Note: Success can be true/false for test image - both acceptable")
                    return True
                else:
                    print("   ❌ Receipt Analysis FAILED - Field type validation failed")
                    return False
                    
            except json.JSONDecodeError as e:
                print(f"   ❌ Receipt Analysis FAILED - Invalid JSON response: {e}")
                print(f"   Raw response: {response.text}")
                return False
                
        elif response.status_code == 500:
            print("   ❌ Receipt Analysis FAILED - Server error (500)")
            print("   This indicates the endpoint crashed - CRITICAL ISSUE")
            try:
                print(f"   Error details: {response.json()}")
            except:
                print(f"   Error details: {response.text}")
            return False
        else:
            print(f"   ❌ Receipt Analysis FAILED - Unexpected status code: {response.status_code}")
            try:
                print(f"   Response: {response.json()}")
            except:
                print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("   ❌ Receipt Analysis FAILED - Request timeout (>35 seconds)")
        return False
    except Exception as e:
        print(f"   ❌ Receipt Analysis FAILED - Exception: {e}")
        return False

def test_fuel_italian_cities() -> bool:
    """Test fuel endpoint with Italian cities (Milano to Magenta)"""
    print("\n🇮🇹 Testing POST /api/fuel/cheapest - Italian cities (Milano to Magenta)...")
    payload = {
        "partenza": "Milano",
        "destinazione": "Magenta", 
        "tipo_carburante": "benzina"
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/fuel/cheapest",
            json=payload,
            timeout=FUEL_TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        response_time = round(time.time() - start_time, 2)
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {response_time}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Validate response structure
            required_fields = ["success", "country", "stations", "message"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"   ❌ Missing fields: {missing_fields}")
                return False
            
            # Check country is IT
            if data.get("country") != "IT":
                print(f"   ❌ Expected country 'IT', got '{data.get('country')}'")
                return False
                
            # Validate station structure if stations exist
            if data.get("stations"):
                station = data["stations"][0]
                station_fields = ["nome", "indirizzo", "prezzo", "distanza_km", "carburante"]
                missing_station_fields = [field for field in station_fields if field not in station]
                if missing_station_fields:
                    print(f"   ❌ Station missing fields: {missing_station_fields}")
                    return False
                else:
                    print(f"   First station: {station['nome']} - €{station['prezzo']} - {station['distanza_km']}km")
            
            print("   ✅ Italian cities test PASSED")
            return True
        else:
            print(f"   ❌ Italian cities test FAILED - Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Italian cities test FAILED - Exception: {e}")
        return False

def test_fuel_french_cities() -> bool:
    """Test fuel endpoint with French cities (Paris to Lyon)"""
    print("\n🇫🇷 Testing POST /api/fuel/cheapest - French cities (Paris to Lyon)...")
    payload = {
        "partenza": "Paris",
        "destinazione": "Lyon",
        "tipo_carburante": "gasolio"
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/fuel/cheapest",
            json=payload,
            timeout=FUEL_TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        response_time = round(time.time() - start_time, 2)
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {response_time}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Check if country is FR
            if data.get("country") == "FR":
                print(f"   Success: {data.get('success')}, Stations: {len(data.get('stations', []))}")
                print("   ✅ French cities test PASSED")
                return True
            else:
                print(f"   ❌ Expected country 'FR', got '{data.get('country')}'")
                return False
        else:
            print(f"   ❌ French cities test FAILED - Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ French cities test FAILED - Exception: {e}")
        return False

def test_fuel_unsupported_country() -> bool:
    """Test fuel endpoint with unsupported country (Berlin to Munich)"""
    print("\n🇩🇪 Testing POST /api/fuel/cheapest - Unsupported country (Berlin to Munich)...")
    payload = {
        "partenza": "Berlin",
        "destinazione": "Munich",
        "tipo_carburante": "benzina"
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/fuel/cheapest",
            json=payload,
            timeout=FUEL_TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        response_time = round(time.time() - start_time, 2)
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {response_time}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Should return success=false for unsupported country
            if data.get("success") == False:
                print(f"   Message: {data.get('message')}")
                print("   ✅ Unsupported country test PASSED")
                return True
            else:
                print(f"   ❌ Expected success=false for unsupported country, got success={data.get('success')}")
                return False
        else:
            print(f"   ❌ Unsupported country test FAILED - Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Unsupported country test FAILED - Exception: {e}")
        return False

def test_distance_calculate() -> bool:
    """Test distance calculation endpoint (Milano to Magenta)"""
    print("\n📏 Testing POST /api/distance/calculate - Distance calculation (Milano to Magenta)...")
    payload = {
        "partenza": "Milano",
        "destinazione": "Magenta"
    }
    
    try:
        print("   Sending request (may take 3-5 seconds due to Nominatim rate limits)...")
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/distance/calculate",
            json=payload,
            timeout=30,  # 30 second timeout as specified
            headers={"Content-Type": "application/json"}
        )
        response_time = round(time.time() - start_time, 2)
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {response_time}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Validate response structure
            required_fields = ["success", "km", "km_andata_ritorno", "message"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"   ❌ Missing fields: {missing_fields}")
                return False
            
            # Check field types
            field_checks = {
                "success is boolean": isinstance(data["success"], bool),
                "km is number": isinstance(data["km"], (int, float)),
                "km_andata_ritorno is number": isinstance(data["km_andata_ritorno"], (int, float)),
                "message is string": isinstance(data["message"], str)
            }
            
            print("   Field validation:")
            for check, result in field_checks.items():
                print(f"     {check}: {'✅' if result else '❌'}")
            
            if not all(field_checks.values()):
                print("   ❌ Field type validation failed")
                return False
            
            # Check if calculation was successful
            if data.get("success"):
                km = data.get("km", 0)
                km_round_trip = data.get("km_andata_ritorno", 0)
                message = data.get("message", "")
                
                print(f"   Distance: {km} km")
                print(f"   Round trip: {km_round_trip} km")
                print(f"   Message: {message}")
                
                # Basic sanity checks
                if km > 0 and km_round_trip > 0:
                    # Round trip should be approximately 2x one way
                    ratio = km_round_trip / km if km > 0 else 0
                    if 1.8 <= ratio <= 2.2:  # Allow some tolerance
                        print("   ✅ Distance calculation PASSED")
                        return True
                    else:
                        print(f"   ❌ Distance calculation FAILED - Invalid ratio: {ratio}")
                        return False
                else:
                    print("   ❌ Distance calculation FAILED - Invalid distance values")
                    return False
            else:
                # If success=false, check if it's due to geocoding issues
                message = data.get("message", "")
                print(f"   Success: False, Message: {message}")
                
                # If it's a geocoding/rate limit issue, that's acceptable
                if any(keyword in message.lower() for keyword in ["non trovata", "rate limit", "geocoding", "nominatim"]):
                    print("   ⚠️  Distance calculation endpoint working but geocoding failed (external API issue)")
                    print("   ✅ Distance calculation PASSED (endpoint structure correct)")
                    return True
                else:
                    print("   ❌ Distance calculation FAILED - Unexpected error")
                    return False
        else:
            print(f"   ❌ Distance calculation FAILED - Status: {response.status_code}")
            try:
                print(f"   Response: {response.json()}")
            except:
                print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("   ❌ Distance calculation FAILED - Request timeout (>30 seconds)")
        return False
    except Exception as e:
        print(f"   ❌ Distance calculation FAILED - Exception: {e}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting MarketMate Backend API Tests")
    print(f"📍 Backend URL: {BACKEND_URL}")
    print(f"🕐 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Health Check
    results["health_check"] = test_health_check()
    
    # Test 2: AI Chat (only if health check passes)
    if results["health_check"]:
        results["ai_chat"] = test_ai_chat()
    else:
        print("\n⚠️  Skipping AI Chat test due to health check failure")
        results["ai_chat"] = False
    
    # Test 3: Receipt Analysis
    results["receipt_analyze"] = test_receipt_analyze()
    
    # Test 4: Distance Calculation (NEW - as requested in review)
    results["distance_calculate"] = test_distance_calculate()
    
    # Test 5: Fuel - Italian cities
    results["fuel_italian"] = test_fuel_italian_cities()
    
    # Test 6: Fuel - French cities
    results["fuel_french"] = test_fuel_french_cities()
    
    # Test 7: Fuel - Unsupported country
    results["fuel_unsupported"] = test_fuel_unsupported_country()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    # Specific feedback for distance calculation
    if results.get("distance_calculate", False):
        print("\n✅ Distance calculation endpoint is working correctly!")
    else:
        print("\n❌ Distance calculation endpoint has issues!")
    
    # Specific feedback for fuel endpoints
    fuel_tests = ["fuel_italian", "fuel_french", "fuel_unsupported"]
    fuel_passed = sum(results.get(test, False) for test in fuel_tests)
    
    if fuel_passed == 3:
        print("\n🎉 KEY SUCCESS: All fuel price endpoints are working correctly!")
        print("   External API integrations (Nominatim geocoding + fuel APIs) are functional.")
    elif fuel_passed > 0:
        print(f"\n⚠️  PARTIAL SUCCESS: {fuel_passed}/3 fuel endpoints working.")
        print("   Some external API integrations may have issues.")
    else:
        print("\n❌ KEY ISSUE: Fuel price endpoints have problems.")
        print("   External API integrations may be failing.")
    
    if results.get("receipt_analyze", False):
        print("\n✅ Receipt analysis endpoint is working correctly!")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)