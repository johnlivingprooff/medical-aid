#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schemes.models import SchemeBenefit, BenefitType

def check_pharmacy_benefits():
    """Check pharmacy benefit configurations across all schemes"""
    print("Checking pharmacy benefit configurations...")
    
    try:
        # Get PHARMACY benefit type
        pharmacy_benefit_type = BenefitType.objects.get(name='PHARMACY')
        
        # Get all pharmacy benefits
        pharmacy_benefits = SchemeBenefit.objects.filter(
            benefit_type=pharmacy_benefit_type
        ).select_related('scheme')
        
        print(f"Found {pharmacy_benefits.count()} pharmacy benefit configurations:")
        print()
        
        for benefit in pharmacy_benefits:
            print(f"Scheme: {benefit.scheme.name}")
            print(f"  Coverage amount: ${benefit.coverage_amount}")
            print(f"  Deductible: ${benefit.deductible_amount}")
            print(f"  Copay fixed: ${benefit.copayment_fixed or 0}")
            print(f"  Copay %: {benefit.copayment_percentage or 0}%")
            print(f"  Active: {benefit.is_currently_active}")
            print()
            
    except BenefitType.DoesNotExist:
        print("❌ PHARMACY benefit type not found")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_pharmacy_benefits()