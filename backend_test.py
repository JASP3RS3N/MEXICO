#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class IAtipsMXAPITester:
    def __init__(self, base_url="https://parallax-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_health_endpoint(self):
        """Test health endpoint"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    self.log_test("Health Check", True, f"Service: {data.get('service')}, DB: {data.get('database')}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Status not ok: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_create_lead(self):
        """Test lead creation"""
        test_lead = {
            "nombre": "Test Usuario",
            "negocio": "Test Business",
            "sector": "consultorios",
            "ciudad": "Saltillo",
            "telefono": "8441234567",
            "email": "test@example.com",
            "mensaje": "Quiero automatizar mi consultorio médico para mejorar la gestión de citas",
            "origen": "landing-contact"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/leads",
                json=test_lead,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 201:
                data = response.json()
                if data.get("id") and data.get("nombre") == test_lead["nombre"]:
                    self.log_test("Create Lead", True, f"Lead ID: {data.get('id')}")
                    return data.get("id")
                else:
                    self.log_test("Create Lead", False, f"Invalid response data: {data}")
                    return None
            else:
                self.log_test("Create Lead", False, f"Status code: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("Create Lead", False, f"Exception: {str(e)}")
            return None

    def test_list_leads(self):
        """Test leads listing"""
        try:
            response = requests.get(f"{self.api_url}/leads?limit=5", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "items" in data and "count" in data:
                    self.log_test("List Leads", True, f"Found {data.get('count')} leads")
                    return True
                else:
                    self.log_test("List Leads", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("List Leads", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("List Leads", False, f"Exception: {str(e)}")
            return False

    def test_invalid_sector(self):
        """Test validation with invalid sector"""
        invalid_lead = {
            "nombre": "Test Usuario",
            "negocio": "Test Business",
            "sector": "invalid_sector",
            "ciudad": "Saltillo",
            "telefono": "8441234567",
            "mensaje": "Test message"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/leads",
                json=invalid_lead,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 400:
                self.log_test("Invalid Sector Validation", True, "Correctly rejected invalid sector")
                return True
            else:
                self.log_test("Invalid Sector Validation", False, f"Expected 400, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Invalid Sector Validation", False, f"Exception: {str(e)}")
            return False

    def test_missing_required_fields(self):
        """Test validation with missing required fields"""
        incomplete_lead = {
            "nombre": "Test Usuario",
            # Missing required fields
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/leads",
                json=incomplete_lead,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 422:  # Pydantic validation error
                self.log_test("Missing Fields Validation", True, "Correctly rejected incomplete data")
                return True
            else:
                self.log_test("Missing Fields Validation", False, f"Expected 422, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Missing Fields Validation", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting IAtipsMX Backend API Tests")
        print(f"Testing against: {self.api_url}")
        print("=" * 50)
        
        # Test health endpoint first
        if not self.test_health_endpoint():
            print("❌ Health check failed - stopping tests")
            return False
        
        # Test lead creation
        lead_id = self.test_create_lead()
        
        # Test lead listing
        self.test_list_leads()
        
        # Test validation
        self.test_invalid_sector()
        self.test_missing_required_fields()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            return False

    def get_test_results(self):
        """Return test results for reporting"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "results": self.test_results
        }

def main():
    tester = IAtipsMXAPITester()
    success = tester.run_all_tests()
    
    # Save results to file
    results = tester.get_test_results()
    with open("/app/test_reports/backend_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())