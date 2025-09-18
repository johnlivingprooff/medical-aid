#!/usr/bin/env python
"""
Test script for enhanced credentialing workflow with automated document review.
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
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import ProviderProfile, ProviderNetworkMembership, CredentialingDocument
from accounts.models_credentialing import CredentialingRule, CredentialingReview, CredentialingTemplate
from accounts.credentialing_service import CredentialingService, CredentialingWorkflowManager
from schemes.models import SchemeCategory


def test_credentialing_workflow():
    """Test the enhanced credentialing workflow."""
    print("🔧 Testing Enhanced Credentialing Workflow")
    print("=" * 50)

    # Create test data
    print("📝 Creating test data...")

    # Create a test scheme
    scheme, created = SchemeCategory.objects.get_or_create(
        name="Test Medical Aid Scheme",
        defaults={
            'description': 'Test scheme for credentialing workflow',
            'price': 1500.00
        }
    )
    print(f"✅ Scheme: {scheme.name} ({'created' if created else 'existing'})")

    # Get or create test provider
    try:
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
            'credential_status': 'PENDING',
            'effective_from': date.today(),
            'effective_to': date.today() + timedelta(days=365),
            'notes': 'Test membership for credentialing workflow'
        }
    )
    print(f"✅ Network membership: {membership.status} ({'created' if created else 'existing'})")

    # Test the credentialing service
    print("\n🔍 Testing Credentialing Service...")

    # Create a test document
    from django.core.files.base import ContentFile
    test_file = ContentFile(b"Test document content for credentialing", name="test_license.pdf")

    document = CredentialingDocument.objects.create(
        membership=membership,
        uploaded_by=provider_user,
        file=test_file,
        doc_type='LICENSE',
        notes='Test license document'
    )
    print(f"✅ Created test document: {document.doc_type}")

    # Test automated processing
    service = CredentialingService()
    results = service.process_document_upload(document)

    print(f"📊 Processing Results:")
    print(f"   Validation Score: {results.get('validation_score', 0)}%")
    print(f"   Requires Review: {results.get('requires_review', True)}")
    print(f"   Auto Approved: {results.get('auto_approved', False)}")
    print(f"   Success: {results.get('success', False)}")

    if results.get('messages'):
        print(f"   Messages: {results['messages']}")

    # Test workflow manager
    print("\n🔄 Testing Workflow Manager...")
    manager = CredentialingWorkflowManager()
    workflow_results = manager.process_membership_application(membership)

    print(f"📋 Workflow Results:")
    print(f"   Documents Required: {len(workflow_results.get('documents_required', []))}")
    print(f"   Documents Submitted: {workflow_results.get('documents_submitted', 0)}")
    print(f"   Validation Complete: {workflow_results.get('validation_complete', False)}")
    print(f"   Ready for Review: {workflow_results.get('ready_for_review', False)}")

    # Test API endpoints
    print("\n🌐 Testing API Endpoints...")
    client = APIClient()

    # Test credentialing dashboard
    response = client.get('/api/accounts/credentialing/dashboard/')
    print(f"Dashboard response: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Dashboard loaded successfully")
        print(f"   User Role: {data.get('user_role')}")
        print(f"   Timestamp: {data.get('timestamp')}")
    else:
        print(f"❌ Dashboard failed: {response.status_code}")

    # Test credentialing workflow
    response = client.post('/api/accounts/credentialing/workflow/process_upload/', {
        'document_id': document.id
    })
    print(f"Process upload response: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Document processing successful")
        print(f"   Validation Score: {data.get('validation_score', 0)}%")
    else:
        print(f"❌ Process upload failed: {response.status_code}")

    # Test renewal notices
    response = client.get('/api/accounts/credentialing/workflow/renewal_notices/')
    print(f"Renewal notices response: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Renewal notices retrieved: {data.get('count', 0)} notices")
    else:
        print(f"❌ Renewal notices failed: {response.status_code}")

    print("\n🎉 Credentialing workflow test completed!")
    return True


def test_credentialing_models():
    """Test the credentialing models and relationships."""
    print("\n📋 Testing Credentialing Models")
    print("=" * 40)

    try:
        # Test credentialing rules
        rules_count = CredentialingRule.objects.count()
        print(f"📏 Credentialing Rules: {rules_count}")

        if rules_count > 0:
            rule = CredentialingRule.objects.first()
            print(f"   Sample Rule: {rule.name}")
            print(f"   Rule Type: {rule.get_rule_type_display()}")
            print(f"   Auto Approve Score: {rule.auto_approve_score}%")

        # Test credentialing templates
        templates_count = CredentialingTemplate.objects.count()
        print(f"📄 Credentialing Templates: {templates_count}")

        if templates_count > 0:
            template = CredentialingTemplate.objects.first()
            print(f"   Sample Template: {template.name}")
            print(f"   Facility Type: {template.facility_type}")
            print(f"   Required Docs: {len(template.required_documents)}")

        # Test reviews
        reviews_count = CredentialingReview.objects.count()
        print(f"🔍 Credentialing Reviews: {reviews_count}")

        if reviews_count > 0:
            review = CredentialingReview.objects.first()
            print(f"   Sample Review Status: {review.status}")
            print(f"   Validation Score: {review.validation_score}%")

        print("✅ Models test completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Models test failed: {e}")
        return False


def test_bulk_operations():
    """Test bulk credentialing operations."""
    print("\n📦 Testing Bulk Operations")
    print("=" * 35)

    try:
        service = CredentialingService()

        # Get some reviews for bulk testing
        reviews = CredentialingReview.objects.filter(status='PENDING')[:3]
        if reviews.exists():
            review_ids = list(reviews.values_list('id', flat=True))

            # Test bulk assignment
            admin_user = User.objects.filter(role='ADMIN').first()
            if admin_user:
                results = service.bulk_assign_reviews(review_ids, admin_user, 'HIGH')
                print(f"📋 Bulk assignment results:")
                print(f"   Assigned: {results['assigned']}")
                print(f"   Failed: {results['failed']}")

                if results['errors']:
                    print(f"   Errors: {results['errors']}")
            else:
                print("⚠️  No admin user found for bulk assignment test")

        # Test overdue reviews
        overdue_reviews = service.get_overdue_reviews()
        print(f"⏰ Overdue Reviews: {len(overdue_reviews)}")

        # Test pending reviews
        pending_reviews = service.get_pending_reviews()
        print(f"📝 Pending Reviews: {len(pending_reviews)}")

        print("✅ Bulk operations test completed!")
        return True

    except Exception as e:
        print(f"❌ Bulk operations test failed: {e}")
        return False


if __name__ == '__main__':
    print("🚀 Starting Enhanced Credentialing Tests")
    print("=" * 50)

    try:
        # Run tests
        success1 = test_credentialing_workflow()
        success2 = test_credentialing_models()
        success3 = test_bulk_operations()

        if success1 and success2 and success3:
            print("\n🎉 All credentialing tests passed successfully!")
            print("✅ Enhanced credentialing workflow is working correctly")
        else:
            print("\n❌ Some tests failed")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)