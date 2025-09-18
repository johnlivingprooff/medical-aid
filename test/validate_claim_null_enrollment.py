# test/validate_claim_null_enrollment.py
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.services import validate_and_process_claim
from claims.models import Claim, Patient
from accounts.models import User
from schemes.models import SchemeCategory, BenefitType, SchemeBenefit

def test_claim_validation_with_null_enrollment():
    """Test claim validation when patient has null enrollment_date"""
    print("Testing claim validation with null enrollment date...")

    try:
        # Create a test patient with null enrollment_date
        user = User.objects.create_user(username='test_patient', password='test123')
        scheme = SchemeCategory.objects.first()  # Get first available scheme
        if not scheme:
            print("No scheme found. Please create a scheme first.")
            return

        patient = Patient.objects.create(
            user=user,
            member_id='TEST-001',
            date_of_birth='1990-01-01',
            gender='M',
            scheme=scheme,
            enrollment_date=None,  # This is the problematic null value
            relationship='PRINCIPAL'
        )

        # Create a test benefit type
        benefit_type, created = BenefitType.objects.get_or_create(
            name='Consultation'
        )

        # Create a scheme benefit for this scheme and benefit type
        scheme_benefit, created = SchemeBenefit.objects.get_or_create(
            scheme=scheme,
            benefit_type=benefit_type,
            defaults={
                'coverage_amount': 10000.00,
                'coverage_limit_count': 10,
                'coverage_period': 'BENEFIT_YEAR',
                'deductible_amount': 1000.00,
                'copayment_percentage': 10.0,
                'copayment_fixed': 500.00,
                'requires_preauth': False,
                'waiting_period_days': 30,
                'network_only': False,
                'is_active': True
            }
        )

        # Create a temporary claim
        temp_claim = Claim(
            patient=patient,
            provider=user,  # Using same user as provider for simplicity
            service_type=benefit_type,
            cost=1000.00
        )

        # This should trigger the 500 error
        print("Calling validate_and_process_claim...")
        approved, payable, reason = validate_and_process_claim(temp_claim)

        print(f"Result: approved={approved}, payable={payable}, reason={reason}")

    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Clean up
        try:
            if 'patient' in locals():
                patient.delete()
            if 'user' in locals():
                user.delete()
        except:
            pass

if __name__ == '__main__':
    test_claim_validation_with_null_enrollment()
    print("Test completed")