#!/usr/bin/env python
import requests
import json

def test_subscription_api_endpoints():
    """Test subscription API endpoints with real data"""
    base_url = "http://localhost:8000"
    
    print("Testing subscription API endpoints...")
    
    try:
        # Test getting member subscriptions for patient 12 (MBR-00012)
        print(f"\n1. Testing /api/schemes/subscriptions/?patient=12")
        response = requests.get(f"{base_url}/api/schemes/subscriptions/?patient=12")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('results') and len(data['results']) > 0:
                subscription = data['results'][0]
                subscription_id = subscription['id']
                
                print(f"\n2. Testing /api/schemes/subscriptions/{subscription_id}/usage/")
                usage_response = requests.get(f"{base_url}/api/schemes/subscriptions/{subscription_id}/usage/")
                print(f"Status: {usage_response.status_code}")
                
                if usage_response.status_code == 200:
                    usage_data = usage_response.json()
                    print(f"Usage Response: {json.dumps(usage_data, indent=2)}")
                    
                    print(f"\n✅ Key metrics:")
                    print(f"  Coverage used this year: ${usage_data.get('coverage_used_this_year', 0)}")
                    print(f"  Claims this month: {usage_data.get('claims_this_month', 0)}")
                    print(f"  Max coverage per year: ${usage_data.get('max_coverage_per_year', 0)}")
                    print(f"  Remaining coverage: ${usage_data.get('remaining_coverage', 0)}")
                else:
                    print(f"❌ Usage endpoint failed: {usage_response.text}")
            else:
                print("❌ No subscription found for patient")
        else:
            print(f"❌ Subscription endpoint failed: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to Django server. Make sure it's running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    test_subscription_api_endpoints()