#!/usr/bin/env python
import os
import sys
import django
import json

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from core.models import SystemSettings

User = get_user_model()

def test_bulk_update_api():
    print("=== Testing Bulk Update API ===")
    
    # Get or create admin user
    admin_user, created = User.objects.get_or_create(
        username='test_admin',
        defaults={
            'email': 'admin@test.com',
            'role': 'ADMIN',
            'is_staff': True
        }
    )
    
    # Create client and login
    client = Client()
    client.force_login(admin_user)
    
    # Get current value
    current_setting = SystemSettings.objects.get(key='PREAUTH_THRESHOLD')
    print(f"Current value: {current_setting.value}")
    
    # Test bulk update
    new_value = "15000.00"
    payload = [
        {
            "key": "PREAUTH_THRESHOLD",
            "value": new_value
        }
    ]
    
    print(f"Sending payload: {json.dumps(payload, indent=2)}")
    
    response = client.post(
        '/api/core/settings/bulk_update/',
        data=json.dumps(payload),
        content_type='application/json'
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response content: {response.content.decode()}")
    
    # Check if it was updated
    current_setting.refresh_from_db()
    print(f"Value after API call: {current_setting.value}")
    
    # Restore original value
    current_setting.value = "1000.00"
    current_setting.save()
    print("Restored original value")

if __name__ == '__main__':
    test_bulk_update_api()