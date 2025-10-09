#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.models import Claim, Patient
from claims.services import validate_and_process_claim_for_approval
from django.contrib.auth import get_user_model

User = get_user_model()

def test_claim_approval():
    """Test claim approval logic to identify the issue"""
    print("Testing claim approval logic...")
    
    # Get claim with ID 24
    try:
        claim = Claim.objects.get(id=24)
        print(f"Found claim {claim.id}")
        print(f"Status: {claim.status}")
        print(f"Patient: {claim.patient.member_id}")
        print(f"Service: {claim.service_type.name}")
        print(f"Cost: {claim.cost}")
        print(f"Provider: {claim.provider}")
        print(f"Date submitted: {claim.date_submitted}")
        
        # Test validation
        print("\n--- Running validation ---")
        approved, payable, reason, validation_details = validate_and_process_claim_for_approval(claim)
        
        print(f"Approved: {approved}")
        print(f"Payable: {payable}")
        print(f"Reason: {reason}")
        print(f"Validation details: {validation_details}")
        
        if not approved:
            print(f"\n❌ Claim validation failed: {reason}")
        else:
            print(f"\n✅ Claim validation passed: {reason}")
            
    except Claim.DoesNotExist:
        print("❌ Claim with ID 24 not found")
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_claim_approval()