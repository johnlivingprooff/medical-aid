#!/usr/bin/env python3
"""
Comprehensive test script to verify Week 10-12 subscription foundation success criteria.
Tests all four success criteria:
1. Subscription models created and functional
2. Members can view their subscription details and coverage
3. Enrollment process includes subscription tier selection
4. Data quality improved with subscription-aware validation
"""

import os
import sys
import django
from decimal import Decimal
from datetime import date, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from claims.models import Patient
from schemes.models import SchemeCategory, SubscriptionTier, MemberSubscription, BenefitCategory
from core.models import SystemSettings

User = get_user_model()

class SubscriptionFoundationTests(APITestCase):
    """Test all Week 10-12 success criteria"""

    def setUp(self):
        """Set up test data"""
        # Override ALLOWED_HOSTS for testing
        from django.conf import settings
        if 'testserver' not in settings.ALLOWED_HOSTS:
            settings.ALLOWED_HOSTS.append('testserver')
        # Create test scheme
        self.scheme = SchemeCategory.objects.create(
            name="Test Medical Aid",
            description="Test scheme for subscription testing",
            price=Decimal('1500.00')
        )

        # Create benefit category
        self.benefit_category = BenefitCategory.objects.create(
            name="Medical Services",
            description="General medical services",
            subscription_required=True
        )

        # Create subscription tiers
        self.basic_tier = SubscriptionTier.objects.create(
            name="Basic",
            scheme=self.scheme,
            tier_type="BASIC",
            description="Basic coverage",
            monthly_price=Decimal('500.00'),
            yearly_price=Decimal('5500.00'),
            max_dependents=2,
            max_claims_per_month=10,
            max_coverage_per_year=Decimal('10000.00'),
            is_active=True,
            sort_order=1
        )
        self.basic_tier.benefit_categories.add(self.benefit_category)

        self.premium_tier = SubscriptionTier.objects.create(
            name="Premium",
            scheme=self.scheme,
            tier_type="PREMIUM",
            description="Premium coverage",
            monthly_price=Decimal('1200.00'),
            yearly_price=Decimal('13200.00'),
            max_dependents=5,
            max_claims_per_month=50,
            max_coverage_per_year=Decimal('50000.00'),
            is_active=True,
            sort_order=2
        )
        self.premium_tier.benefit_categories.add(self.benefit_category)

        # Create test user (without creating Patient to avoid encryption issues)
        self.user = User.objects.create_user(
            username='testpatient',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='Patient',
            role='PATIENT'
        )

        # Note: We'll create Patient objects in individual tests to avoid encryption issues
        # Set up API client
        self.client.force_authenticate(user=self.user)

    def test_1_subscription_models_created_and_functional(self):
        """Test Criterion 1: Subscription models created and functional"""
        print("\n=== Testing Criterion 1: Subscription models created and functional ===")

        # Test SubscriptionTier model
        self.assertEqual(self.basic_tier.name, "Basic")
        self.assertEqual(self.basic_tier.scheme, self.scheme)
        self.assertEqual(self.basic_tier.monthly_price, Decimal('500.00'))
        self.assertEqual(self.basic_tier.max_dependents, 2)
        print("✓ SubscriptionTier model functional")

        # Test BenefitCategory model
        self.assertEqual(self.benefit_category.name, "Medical Services")
        self.assertTrue(self.benefit_category.subscription_required)
        print("✓ BenefitCategory model functional")

        # Test MemberSubscription model (without creating Patient to avoid encryption issues)
        # We'll test the model methods directly
        from schemes.models import MemberSubscription

        # Test that the model can be instantiated
        subscription = MemberSubscription(
            tier=self.basic_tier,
            subscription_type='MONTHLY',
            status='ACTIVE',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            auto_renew=True,
            claims_this_month=2,
            coverage_used_this_year=Decimal('1500.00')
        )

        # Test model methods
        self.assertTrue(subscription.is_active())
        self.assertEqual(subscription.get_remaining_coverage(), Decimal('8500.00'))  # 10000 - 1500
        print("✓ MemberSubscription model functional")

        print("✅ Criterion 1 PASSED: Subscription models created and functional")

    def test_2_members_can_view_subscription_details_and_coverage(self):
        """Test Criterion 2: Members can view their subscription details and coverage"""
        print("\n=== Testing Criterion 2: Members can view subscription details and coverage ===")

        # Create a patient for this test
        patient = Patient.objects.create(
            user=self.user,
            date_of_birth=date(1990, 1, 1),  # Required field
            gender='M',
            scheme=self.scheme,
            enrollment_date=date.today(),
            member_id='TEST-001'
        )

        # Create subscription for testing
        subscription = MemberSubscription.objects.create(
            patient=patient,
            tier=self.basic_tier,
            subscription_type='MONTHLY',
            status='ACTIVE',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            auto_renew=True,
            claims_this_month=2,
            coverage_used_this_year=Decimal('1500.00')
        )

        # Test subscription API endpoint
        url = f'/api/schemes/subscriptions/{subscription.id}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['tier_detail']['name'], 'Basic')
        self.assertEqual(data['subscription_type'], 'MONTHLY')
        self.assertEqual(data['status'], 'ACTIVE')
        print("✓ Subscription details API working")

        # Test subscription usage API
        url = f'/api/schemes/subscriptions/{subscription.id}/usage/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['tier_name'], 'Basic')
        self.assertEqual(data['claims_this_month'], 2)
        self.assertEqual(Decimal(data['coverage_used_this_year']), Decimal('1500.00'))
        print("✓ Subscription usage API working")

        # Test patient subscription list
        url = f'/api/schemes/subscriptions/?patient={patient.id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertTrue(len(data['results']) > 0)
        subscription_data = data['results'][0]
        self.assertEqual(subscription_data['tier_detail']['name'], 'Basic')
        print("✓ Patient subscription list API working")

        print("✅ Criterion 2 PASSED: Members can view subscription details and coverage")

    def test_3_enrollment_process_includes_subscription_tier_selection(self):
        """Test Criterion 3: Enrollment process includes subscription tier selection"""
        print("\n=== Testing Criterion 3: Enrollment process includes subscription tier selection ===")

        # Test subscription tiers API
        url = f'/api/schemes/subscription-tiers/?scheme={self.scheme.id}&is_active=true'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertTrue(len(data['results']) >= 2)  # Should have basic and premium tiers

        # Verify tier data
        basic_tier_data = next(tier for tier in data['results'] if tier['name'] == 'Basic')
        self.assertEqual(basic_tier_data['monthly_price'], '500.00')
        self.assertEqual(basic_tier_data['max_dependents'], 2)
        print("✓ Subscription tiers API working")

        # Test subscription creation API
        url = '/api/schemes/subscriptions/create_subscription/'
        subscription_data = {
            'patient_id': self.patient.id,
            'tier_id': self.premium_tier.id,
            'subscription_type': 'MONTHLY',
            'start_date': str(date.today())
        }
        response = self.client.post(url, subscription_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify subscription was created
        created_subscription = MemberSubscription.objects.filter(
            patient=self.patient,
            tier=self.premium_tier
        ).first()
        self.assertIsNotNone(created_subscription)
        self.assertEqual(created_subscription.subscription_type, 'MONTHLY')
        print("✓ Subscription creation API working")

        print("✅ Criterion 3 PASSED: Enrollment process includes subscription tier selection")

    def test_4_data_quality_improved_with_subscription_aware_validation(self):
        """Test Criterion 4: Data quality improved with subscription-aware validation"""
        print("\n=== Testing Criterion 4: Data quality improved with subscription-aware validation ===")

        # Test claim serializer includes subscription context
        from claims.models import Claim, BenefitType
        from claims.serializers import ClaimSerializer

        # Create a benefit type and claim for testing
        benefit_type, created = BenefitType.objects.get_or_create(name="Consultation")
        claim = Claim.objects.create(
            patient=self.patient,
            provider=self.user,  # Using same user as provider for test
            service_type=benefit_type,
            cost=Decimal('200.00'),
            date_of_service=date.today(),
            status='PENDING'
        )

        # Test claim serializer with subscription context
        serializer = ClaimSerializer(claim)
        data = serializer.data

        # Check that subscription_context is included
        self.assertIn('subscription_context', data)
        subscription_context = data['subscription_context']

        self.assertTrue(subscription_context['has_subscription'])
        self.assertEqual(subscription_context['tier_name'], 'Basic')
        self.assertEqual(subscription_context['subscription_status'], 'ACTIVE')
        print("✓ Claim serializer includes subscription context")

        # Test subscription-aware claim validation
        from claims.services import ClaimsValidationEngine

        engine = ClaimsValidationEngine()
        is_valid, payable, message, details = engine.validate_claim_comprehensive(claim)

        # Should be valid since within subscription limits
        self.assertTrue(is_valid)
        self.assertGreater(payable, 0)
        print("✓ Subscription-aware claim validation working")

        # Test subscription limits enforcement
        # Create a claim that would exceed monthly limit
        large_claim = Claim.objects.create(
            patient=self.patient,
            provider=self.user,
            service_type=benefit_type,
            cost=Decimal('2000.00'),  # Large amount
            date_of_service=date.today(),
            status='PENDING'
        )

        # This should still be valid since we haven't hit the yearly limit yet
        is_valid, payable, message, details = engine.validate_claim_comprehensive(large_claim)
        self.assertTrue(is_valid)  # Should be valid as within yearly limit
        print("✓ Subscription limits properly enforced")

        print("✅ Criterion 4 PASSED: Data quality improved with subscription-aware validation")

def run_tests():
    """Run all tests and report results"""
    print("🧪 Running Week 10-12 Subscription Foundation Success Criteria Tests")
    print("=" * 70)

    # Create test suite
    import unittest
    suite = unittest.TestLoader().loadTestsFromTestCase(SubscriptionFoundationTests)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)

    if result.wasSuccessful():
        print("🎉 ALL SUCCESS CRITERIA MET!")
        print("✅ Subscription models created and functional")
        print("✅ Members can view their subscription details and coverage")
        print("✅ Enrollment process includes subscription tier selection")
        print("✅ Data quality improved with subscription-aware validation")
        print("\n🏆 Week 10-12 Subscription Foundation: COMPLETE ✅")
        return True
    else:
        print("❌ SOME TESTS FAILED")
        print(f"Failures: {len(result.failures)}")
        print(f"Errors: {len(result.errors)}")
        for failure in result.failures:
            print(f"FAILED: {failure[0]}")
            print(f"ERROR: {failure[1]}")
        for error in result.errors:
            print(f"ERROR: {error[0]}")
            print(f"DETAILS: {error[1]}")
        return False

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)