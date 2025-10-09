#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.models import Claim, Patient
from schemes.models import SchemeBenefit

def check_benefit_configuration():
    """Check the benefit configuration for claim 24"""
    print("Checking benefit configuration for claim 24...")
    
    try:
        claim = Claim.objects.get(id=24)
        patient = claim.patient
        service_type = claim.service_type
        
        print(f"Patient: {patient.member_id}")
        print(f"Scheme: {patient.scheme.name}")
        print(f"Service: {service_type.name}")
        print(f"Claim amount: ${claim.cost}")
        
        # Get benefit configuration
        try:
            benefit = SchemeBenefit.objects.get(
                scheme=patient.scheme,
                benefit_type=service_type
            )
            
            print(f"\n--- Benefit Configuration ---")
            print(f"Coverage amount: ${benefit.coverage_amount}")
            print(f"Deductible amount: ${benefit.deductible_amount}")
            print(f"Copayment fixed: ${benefit.copayment_fixed or 0}")
            print(f"Copayment percentage: {benefit.copayment_percentage or 0}%")
            print(f"Coverage limit count: {benefit.coverage_limit_count}")
            print(f"Is active: {benefit.is_currently_active}")
            
            print(f"\n--- Problem Analysis ---")
            if benefit.deductible_amount and float(benefit.deductible_amount) >= float(claim.cost):
                print(f"❌ ISSUE: Deductible (${benefit.deductible_amount}) is >= claim amount (${claim.cost})")
                print(f"This leaves $0 payable amount, causing approval to fail")
                print(f"Consider reducing the deductible amount for this benefit type")
            else:
                print(f"✅ Deductible seems reasonable")
                
        except SchemeBenefit.DoesNotExist:
            print(f"❌ No benefit configuration found for {service_type.name} in scheme {patient.scheme.name}")
            
    except Claim.DoesNotExist:
        print("❌ Claim with ID 24 not found")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_benefit_configuration()