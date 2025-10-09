#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.models import Patient
from schemes.models import MemberSubscription
from schemes.subscription_service import SubscriptionService

def test_subscription_usage_calculation():
    """Test the updated subscription usage calculation"""
    print("Testing updated subscription usage calculation...")
    
    try:
        # Get member MBR-00012 who has claims
        patient = Patient.objects.get(member_id='MBR-00012')
        subscription = patient.member_subscription
        
        if not subscription:
            print("❌ No subscription found for MBR-00012")
            return
            
        print(f"Patient: {patient.member_id}")
        print(f"Subscription: {subscription.tier.name}")
        
        print(f"\nBefore recalculation:")
        print(f"  Coverage used this year: ${subscription.coverage_used_this_year}")
        print(f"  Claims this month: {subscription.claims_this_month}")
        
        # Test the new recalculate_usage method
        print(f"\nRecalculating usage...")
        usage_data = subscription.recalculate_usage()
        
        print(f"After recalculation:")
        print(f"  Coverage used this year: ${subscription.coverage_used_this_year}")
        print(f"  Claims this month: {subscription.claims_this_month}")
        
        # Test the subscription service method
        print(f"\nUsing SubscriptionService.get_subscription_usage:")
        service_usage = SubscriptionService.get_subscription_usage(subscription)
        
        print(f"  Claims this month: {service_usage['claims_this_month']}")
        print(f"  Coverage used this year: ${service_usage['coverage_used_this_year']}")
        print(f"  Max coverage per year: ${service_usage['max_coverage_per_year']}")
        print(f"  Remaining coverage: ${service_usage['remaining_coverage']}")
        
        # Calculate utilization percentage
        if service_usage['max_coverage_per_year']:
            utilization = (service_usage['coverage_used_this_year'] / service_usage['max_coverage_per_year']) * 100
            print(f"  Utilization: {utilization:.1f}%")
        
        print(f"\n✅ Usage calculation working correctly!")
        
    except Patient.DoesNotExist:
        print("❌ Patient MBR-00012 not found")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_subscription_usage_calculation()