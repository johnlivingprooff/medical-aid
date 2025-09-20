#!/usr/bin/env python
"""
Test script to verify the updated emit_low_balance_alerts function
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.services import emit_low_balance_alerts
from claims.models import Claim, Patient
from schemes.models import SchemeBenefit, MemberSubscription
from django.contrib.auth import get_user_model
from django.utils import timezone

def test_emit_low_balance_alerts():
    """Test the updated emit_low_balance_alerts function"""
    print("Testing updated emit_low_balance_alerts function...")

    try:
        # Get some test data
        patient = Patient.objects.filter(relationship='PRINCIPAL').first()
        benefit = SchemeBenefit.objects.filter(scheme=patient.scheme).first()
        subscription = getattr(patient, 'member_subscription', None)
        user = get_user_model().objects.filter(is_staff=True).first()

        if not patient or not benefit or not user:
            print("Missing test data")
            return

        # Create a test claim
        claim = Claim.objects.create(
            patient=patient,
            provider=user,
            service_type=benefit.benefit_type,
            cost=100.0,
            date_submitted=timezone.now()
        )

        # Test the function with both benefit and subscription
        emit_low_balance_alerts(claim, benefit, subscription, 50.0, 5)
        print('Function call with both benefit and subscription successful!')

        # Test with just benefit
        emit_low_balance_alerts(claim, benefit, None, 50.0, 5)
        print('Function call with just benefit successful!')

        # Test with just subscription
        emit_low_balance_alerts(claim, None, subscription)
        print('Function call with just subscription successful!')

        # Clean up
        claim.delete()
        print('All tests passed!')

    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_emit_low_balance_alerts()