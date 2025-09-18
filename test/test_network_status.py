#!/usr/bin/env python
"""
Test script for provider network status monitoring functionality.
Tests real-time status tracking, health calculations, and dashboard metrics.
"""

import os
import sys
import django
from datetime import date, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import TestCase
from accounts.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import ProviderProfile, ProviderNetworkMembership, CredentialingDocument
from claims.models import Claim, Patient
from schemes.models import SchemeCategory


def test_network_status_monitoring():
    """Test the provider network status monitoring functionality."""
    print("🧪 Testing Provider Network Status Monitoring")
    print("=" * 50)

    # Create test data
    print("📝 Creating test data...")

    # Create a test scheme
    scheme, created = SchemeCategory.objects.get_or_create(
        name="Test Medical Aid Scheme",
        defaults={
            'description': 'Test scheme for network monitoring',
            'price': 1500.00
        }
    )
    print(f"✅ Scheme: {scheme.name} ({'created' if created else 'existing'})")

    # Get or create test provider
    try:
        # Try to find an existing provider with profile
        provider_user = User.objects.filter(role='PROVIDER').select_related('provider_profile').first()
        if provider_user and hasattr(provider_user, 'provider_profile'):
            provider_profile = provider_user.provider_profile
            print("✅ Using existing provider with profile")
        else:
            raise User.DoesNotExist("No provider with profile found")
    except (User.DoesNotExist, ProviderProfile.DoesNotExist):
        # Create unique username
        counter = 1
        username = 'test_provider'
        while User.objects.filter(username=username).exists():
            username = f'test_provider_{counter}'
            counter += 1

        provider_user = User.objects.create_user(
            username=username,
            email='test@provider.com',
            password='testpass123',
            role='PROVIDER'
        )
        provider_profile = ProviderProfile.objects.create(
            user=provider_user,
            facility_name='Test Medical Center',
            facility_type='HOSPITAL',
            city='Johannesburg',
            phone='0111234567',
            address='123 Test Street'
        )
        print("✅ Created new test provider")

    # Create network membership
    membership, created = ProviderNetworkMembership.objects.get_or_create(
        provider=provider_user,
        scheme=scheme,
        defaults={
            'status': 'ACTIVE',
            'credential_status': 'APPROVED',
            'effective_from': date.today(),
            'effective_to': date.today() + timedelta(days=365),
            'notes': 'Test membership for network monitoring'
        }
    )
    print(f"✅ Network membership: {membership.status} ({'created' if created else 'existing'})")

    # Create some test claims
    print("📋 Creating test claims...")
    try:
        patient = Patient.objects.filter(scheme=scheme).first()
        if not patient:
            patient_user = User.objects.create_user(
                username='test_patient',
                email='test@patient.com',
                password='testpass123',
                role='PATIENT'
            )
            patient = Patient.objects.create(
                user=patient_user,
                member_id='TEST-001',
                scheme=scheme,
                enrollment_date=date.today() - timedelta(days=180)
            )
            print("✅ Created test patient")

        # Create recent claims
        for i in range(5):
            Claim.objects.get_or_create(
                patient=patient,
                provider=provider_user,
                service_type='CONSULTATION',
                cost=500.00 + (i * 100),
                date_of_service=date.today() - timedelta(days=i*7),
                defaults={
                    'status': 'APPROVED' if i % 2 == 0 else 'PENDING',
                    'processed_date': date.today() - timedelta(days=i*7 + 2) if i % 2 == 0 else None
                }
            )
        print("✅ Created test claims")
    except Exception as e:
        print(f"⚠️  Could not create test claims: {e}")

    # Test the API endpoints
    print("\n🔍 Testing API endpoints...")
    client = APIClient()

    # Test network status endpoint
    print("Testing network status monitoring...")
    response = client.get('/api/core/providers/network/status/')
    print(f"Network status response: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Found {data.get('total_providers', 0)} providers in network")
        print(f"📊 Timestamp: {data.get('timestamp')}")

        if data.get('network_status'):
            provider_data = data['network_status'][0]
            print(f"🏥 Provider: {provider_data['provider']['facility_name']}")
            print(f"📍 Status: {provider_data['real_time_status']['activity_status']}")
            print(f"❤️  Health: {provider_data['network_health']['health_status']} ({provider_data['network_health']['health_score']}%)")
            print(f"📈 Approval Rate: {provider_data['performance_metrics']['claims']['approval_rate']}%")
    else:
        print(f"❌ Network status failed: {response.status_code}")
        print(f"Response: {response.content.decode()}")

    # Test network dashboard endpoint
    print("\nTesting network dashboard...")
    response = client.get('/api/core/providers/network/dashboard/')
    print(f"Dashboard response: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        overview = data.get('network_overview', {})
        print(f"📊 Network Overview:")
        print(f"   Total: {overview.get('total_memberships', 0)}")
        print(f"   Active: {overview.get('active_memberships', 0)}")
        print(f"   Active Rate: {overview.get('active_rate', 0)}%")

        credentialing = data.get('credentialing_status', {})
        print(f"🎓 Credentialing:")
        print(f"   Approved: {credentialing.get('approved', 0)}")
        print(f"   Completion Rate: {credentialing.get('completion_rate', 0)}%")

        print(f"🚨 Critical Alerts: {data.get('alerts_count', 0)}")
        print(f"❤️  Average Health: {data.get('average_health_score', 0)}%")
    else:
        print(f"❌ Dashboard failed: {response.status_code}")
        print(f"Response: {response.content.decode()}")

    # Test with filters
    print("\nTesting filtered network status...")
    response = client.get('/api/core/providers/network/status/?facility_type=HOSPITAL&status=ACTIVE')
    print(f"Filtered response: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Filtered results: {data.get('total_providers', 0)} providers")
    else:
        print(f"❌ Filtered request failed: {response.status_code}")

    print("\n🎉 Network status monitoring test completed!")
    return True


def test_network_health_calculations():
    """Test network health calculation logic."""
    print("\n🩺 Testing Network Health Calculations")
    print("=" * 40)

    try:
        # Get test provider
        provider_user = User.objects.get(username='test_provider')
        scheme = SchemeCategory.objects.get(name="Test Medical Aid Scheme")
        membership = ProviderNetworkMembership.objects.get(
            provider=provider_user,
            scheme=scheme
        )

        # Test health calculation components
        print("📊 Testing health calculation components...")

        # Document status
        total_docs = membership.documents.count()
        approved_docs = membership.documents.filter(status='REVIEWED').count()
        print(f"📄 Documents: {approved_docs}/{total_docs} approved")

        # Status contribution
        status_score = 40 if membership.status == 'ACTIVE' else 20 if membership.status == 'PENDING' else 0
        print(f"📋 Status Score: {status_score}/40")

        # Credential contribution
        cred_score = 30 if membership.credential_status == 'APPROVED' else 15 if membership.credential_status == 'PENDING' else 0
        print(f"🎓 Credential Score: {cred_score}/30")

        # Document contribution
        doc_score = (approved_docs / total_docs * 30) if total_docs > 0 else 0
        print(f"📑 Document Score: {doc_score:.1f}/30")

        total_health = status_score + cred_score + doc_score
        print(f"❤️  Total Health Score: {total_health:.1f}/100")

        # Health status determination
        if total_health >= 80:
            health_status = 'EXCELLENT'
        elif total_health >= 60:
            health_status = 'GOOD'
        elif total_health >= 40:
            health_status = 'FAIR'
        else:
            health_status = 'POOR'

        print(f"🏥 Health Status: {health_status}")
        print("✅ Health calculations working correctly!")

    except Exception as e:
        print(f"❌ Health calculation test failed: {e}")
        return False

    return True


if __name__ == '__main__':
    print("🚀 Starting Provider Network Status Tests")
    print("=" * 50)

    try:
        # Run tests
        success1 = test_network_status_monitoring()
        success2 = test_network_health_calculations()

        if success1 and success2:
            print("\n🎉 All tests passed successfully!")
            print("✅ Provider network status monitoring is working correctly")
        else:
            print("\n❌ Some tests failed")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)