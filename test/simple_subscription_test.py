import os
import sys
import django
from decimal import Decimal
from datetime import date, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import TestCase
from django.contrib.auth import get_user_model
from schemes.models import SchemeCategory, BenefitCategory, SubscriptionTier, MemberSubscription

User = get_user_model()

class SimpleSubscriptionTest(TestCase):
    """Simple test for subscription models without Patient creation issues"""

    def setUp(self):
        """Set up test data"""
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

    def test_subscription_models(self):
        """Test that subscription models work correctly"""
        print("🧪 Testing Subscription Models")

        # Test SubscriptionTier
        self.assertEqual(self.basic_tier.name, "Basic")
        self.assertEqual(self.basic_tier.scheme, self.scheme)
        self.assertEqual(self.basic_tier.monthly_price, Decimal('500.00'))
        print("✓ SubscriptionTier model functional")

        # Test BenefitCategory
        self.assertEqual(self.benefit_category.name, "Medical Services")
        self.assertTrue(self.benefit_category.subscription_required)
        print("✓ BenefitCategory model functional")

        # Test MemberSubscription model methods (without database save)
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
        remaining = subscription.get_remaining_coverage()
        expected_remaining = Decimal('10000.00') - Decimal('1500.00')
        self.assertEqual(remaining, expected_remaining)
        print("✓ MemberSubscription model methods functional")

        # Test can_make_claim method
        can_claim, message = subscription.can_make_claim(Decimal('1000.00'))
        self.assertTrue(can_claim)
        print("✓ Subscription limit validation working")

        print("✅ All subscription models are working correctly!")

if __name__ == '__main__':
    import unittest
    unittest.main()