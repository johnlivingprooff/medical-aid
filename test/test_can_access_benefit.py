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

def test_can_access_benefit():
    """Test the can_access_benefit method"""
    print("Testing can_access_benefit method...")

    # Check what's in the database
    print(f"Total patients: {Patient.objects.count()}")
    print(f"Patients with subscriptions: {Patient.objects.filter(subscription__isnull=False).count()}")
    print(f"Total subscriptions: {MemberSubscription.objects.count()}")

    # Get a patient with a subscription
    try:
        patient = Patient.objects.filter(subscription__isnull=False).first()
        if not patient:
            print("No patient with subscription found - checking all patients...")
            patients = Patient.objects.all()[:3]
            for p in patients:
                has_sub = hasattr(p, 'subscription') and p.subscription is not None
                print(f"Patient {p.member_id}: has_subscription={has_sub}")
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