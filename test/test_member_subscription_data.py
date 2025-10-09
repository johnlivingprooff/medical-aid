#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.models import Patient
from schemes.models import MemberSubscription, SubscriptionTier
import json

def test_member_subscription_data():
    """Test subscription data for members to debug frontend display issues"""
    print("Testing member subscription data...")
    
    try:
        # Get some patients with subscriptions
        patients_with_subscriptions = Patient.objects.filter(
            member_subscription__isnull=False
        ).select_related('member_subscription', 'member_subscription__tier')[:5]
        
        print(f"Found {patients_with_subscriptions.count()} patients with subscriptions")
        
        for patient in patients_with_subscriptions:
            subscription = patient.member_subscription
            print(f"\n--- Patient: {patient.member_id} ---")
            print(f"Name: {patient.user.first_name} {patient.user.last_name}")
            print(f"Status: {patient.status}")
            print(f"Subscription ID: {subscription.id if subscription else 'None'}")
            
            if subscription:
                print(f"Tier: {subscription.tier.name}")
                print(f"Status: {subscription.status}")
                print(f"Subscription Type: {subscription.subscription_type}")
                print(f"Start Date: {subscription.start_date}")
                print(f"End Date: {subscription.end_date}")
                print(f"Max coverage/year: {subscription.tier.max_coverage_per_year}")
                print(f"Max claims/month: {subscription.tier.max_claims_per_month}")
                
                # Check if patient has claims this year
                from claims.models import Claim
                from django.utils import timezone
                from datetime import datetime
                
                current_year = timezone.now().year
                year_start = datetime(current_year, 1, 1, tzinfo=timezone.get_current_timezone())
                
                claims_this_year = Claim.objects.filter(
                    patient=patient,
                    date_submitted__gte=year_start,
                    status='APPROVED'
                )
                
                total_used = sum(float(claim.cost) for claim in claims_this_year)
                claims_count = claims_this_year.count()
                
                print(f"Claims this year: {claims_count}")
                print(f"Total used this year: ${total_used:.2f}")
                
                # Calculate what the frontend should show
                max_coverage = float(subscription.tier.max_coverage_per_year or 0)
                remaining = max_coverage - total_used
                utilization = (total_used / max_coverage * 100) if max_coverage > 0 else 0
                
                print(f"Remaining: ${remaining:.2f}")
                print(f"Utilization: {utilization:.1f}%")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_member_subscription_data()