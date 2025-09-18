# test/comprehensive_claim_validation.py
import os
import sys
import django
from datetime import date

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.services import validate_and_process_claim
from claims.models import Claim, Patient
from accounts.models import User
from schemes.models import SchemeCategory, BenefitType, SchemeBenefit

def test_comprehensive_claim_validation():
    """Test claim validation in various scenarios"""
    print("Testing comprehensive claim validation scenarios...")

    try:
        # Get or create test data
        user = User.objects.create_user(username='test_patient_comprehensive', password='test123')
        scheme = SchemeCategory.objects.first()
        if not scheme:
            print("No scheme found. Please create a scheme first.")
            return

        benefit_type, _ = BenefitType.objects.get_or_create(name='Consultation')

        # Create scheme benefit
        scheme_benefit, _ = SchemeBenefit.objects.get_or_create(
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

        # Test Case 1: Null enrollment date
        print("\n1. Testing null enrollment date...")
        user1 = User.objects.create_user(username='test_patient_null', password='test123')
        patient_null = Patient.objects.create(
            user=user1,
            member_id='TEST-NULL-001',
            date_of_birth='1990-01-01',
            gender='M',
            scheme=scheme,
            enrollment_date=None,
            relationship='PRINCIPAL'
        )

        temp_claim_null = Claim(
            patient=patient_null,
            provider=user,
            service_type=benefit_type,
            cost=1000.00
        )

        approved, payable, reason = validate_and_process_claim(temp_claim_null)
        print(f"   Result: approved={approved}, payable={payable}, reason='{reason}'")
        assert not approved and "enrollment date is missing" in reason.lower()

        # Test Case 2: Valid enrollment date
        print("\n2. Testing valid enrollment date...")
        user2 = User.objects.create_user(username='test_patient_valid', password='test123')
        patient_valid = Patient.objects.create(
            user=user2,
            member_id='TEST-VALID-001',
            date_of_birth='1990-01-01',
            gender='M',
            scheme=scheme,
            enrollment_date=date.today(),
            relationship='PRINCIPAL'
        )

        temp_claim_valid = Claim(
            patient=patient_valid,
            provider=user,
            service_type=benefit_type,
            cost=1000.00
        )

        approved, payable, reason = validate_and_process_claim(temp_claim_valid)
        print(f"   Result: approved={approved}, payable={payable}, reason='{reason}'")

        # Test Case 3: Enrollment date in future (should fail waiting period)
        print("\n3. Testing future enrollment date...")
        user3 = User.objects.create_user(username='test_patient_future', password='test123')
        patient_future = Patient.objects.create(
            user=user3,
            member_id='TEST-FUTURE-001',
            date_of_birth='1990-01-01',
            gender='M',
            scheme=scheme,
            enrollment_date=date.today().replace(day=date.today().day + 10),  # 10 days in future
            relationship='PRINCIPAL'
        )

        temp_claim_future = Claim(
            patient=patient_future,
            provider=user,
            service_type=benefit_type,
            cost=1000.00
        )

        approved, payable, reason = validate_and_process_claim(temp_claim_future)
        print(f"   Result: approved={approved}, payable={payable}, reason='{reason}'")
        assert not approved and "waiting period" in reason.lower()

        print("\n✅ All test cases passed successfully!")

    except Exception as e:
        print(f"❌ Error occurred: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Clean up
        try:
            for var_name in ['user', 'user1', 'user2', 'user3']:
                if var_name in locals():
                    user_obj = locals()[var_name]
                    if hasattr(user_obj, 'delete'):
                        user_obj.delete()
        except:
            pass

if __name__ == '__main__':
    test_comprehensive_claim_validation()
    print("Comprehensive test completed")