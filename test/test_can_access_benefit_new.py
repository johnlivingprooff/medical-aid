#!/usr/bin/env python
"""
Test script to verify the can_access_benefit method fix
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schemes.models import MemberSubscription, SchemeBenefit, BenefitType, SubscriptionTier, SchemeCategory
from claims.models import Patient
from django.utils import timezone

def test_can_access_benefit():
    """Test the can_access_benefit method"""
    print("Testing can_access_benefit method...")

    # Check what's in the database
    print(f"Total patients: {Patient.objects.count()}")
    print(f"Patients with subscriptions: {Patient.objects.filter(member_subscription__isnull=False).count()}")
    print(f"Total subscriptions: {MemberSubscription.objects.count()}")

    # If no subscriptions exist, create test data
    if MemberSubscription.objects.count() == 0:
        print("Creating test subscription data...")
        try:
            # Get a patient and scheme
            patient = Patient.objects.filter(relationship='PRINCIPAL').first()
            scheme = patient.scheme
            tier = SubscriptionTier.objects.filter(scheme=scheme).first()

            if not patient or not tier:
                print("Missing patient or tier data")
                return

            # Create a subscription
            subscription = MemberSubscription.objects.create(
                patient=patient,
                tier=tier,
                subscription_type='MONTHLY',
                status='ACTIVE',
                start_date=patient.enrollment_date or timezone.now().date(),
                end_date=(timezone.now() + timezone.timedelta(days=365)).date()
            )
            print(f"Created subscription: {subscription}")
            print(f"Subscription patient: {subscription.patient}")
            print(f"Patient subscription: {patient.member_subscription}")

        except Exception as e:
            print(f"Error creating subscription: {e}")
            return

    # Get a patient with a subscription
    try:
        patient = Patient.objects.filter(member_subscription__isnull=False).first()
        if not patient:
            print("No patient with subscription found")
            return

        subscription = patient.member_subscription
        print(f"Testing with patient: {patient.member_id}, subscription: {subscription}")

        # Get a benefit type that's covered
        benefit_type = BenefitType.objects.filter(
            scheme_benefits__scheme=subscription.tier.scheme,
            scheme_benefits__is_active=True
        ).first()

        if not benefit_type:
            print("No covered benefit type found - checking scheme benefits...")
            scheme_benefits = SchemeBenefit.objects.filter(scheme=subscription.tier.scheme)
            print(f"Scheme benefits for {subscription.tier.scheme}: {scheme_benefits.count()}")
            return

        print(f"Testing with benefit type: {benefit_type.name}")

        # Test the method
        can_access = subscription.can_access_benefit(benefit_type)
        print(f"Can access benefit: {can_access}")

        print("Test completed successfully!")

    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_can_access_benefit()