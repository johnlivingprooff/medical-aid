import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()

# Get admin user
admin = User.objects.filter(role='ADMIN').first()
if not admin:
    print("❌ No admin user found!")
    sys.exit(1)

print(f"✓ Testing with admin user: {admin.username}")
print("=" * 70)

# Create test client
client = Client()
client.force_login(admin)

# Test all three endpoints
endpoints = [
    '/api/core/reports/scheme-usage/?format=csv',
    '/api/core/reports/disease-stats/?format=csv',
    '/api/core/reports/detailed-claims/?format=csv'
]

for endpoint in endpoints:
    print(f"\nTesting: {endpoint}")
    print("-" * 70)
    response = client.get(endpoint)
    print(f"Status Code: {response.status_code}")
    print(f"Content-Type: {response.get('Content-Type', 'Not set')}")
    
    if response.status_code == 200:
        if 'text/csv' in response.get('Content-Type', ''):
            content = response.content.decode('utf-8')
            lines = content.split('\n')
            print(f"✓ CSV Response ({len(lines)} lines)")
            print(f"  Header: {lines[0] if lines else 'None'}")
            if len(lines) > 1:
                print(f"  Sample: {lines[1][:100] if lines[1] else 'Empty'}")
        else:
            print(f"⚠️ Response is not CSV: {response.content[:200]}")
    else:
        print(f"❌ Error: {response.content.decode('utf-8')[:200]}")

print("\n" + "=" * 70)
print("Test complete!")
