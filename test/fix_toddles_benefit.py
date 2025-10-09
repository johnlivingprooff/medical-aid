#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schemes.models import SchemeBenefit, BenefitType, SchemeCategory
from decimal import Decimal

def fix_toddles_pharmacy_benefit():
    """Fix the unrealistic deductible in Toddles pharmacy benefit"""
    print("Fixing Toddles pharmacy benefit configuration...")
    
    try:
        # Get the Toddles scheme and PHARMACY benefit type
        toddles_scheme = SchemeCategory.objects.get(name='Toddles')
        pharmacy_benefit_type = BenefitType.objects.get(name='PHARMACY')
        
        # Get the benefit
        benefit = SchemeBenefit.objects.get(
            scheme=toddles_scheme,
            benefit_type=pharmacy_benefit_type
        )
        
        print(f"Before fix:")
        print(f"  Coverage amount: ${benefit.coverage_amount}")
        print(f"  Deductible: ${benefit.deductible_amount}")
        print(f"  Copay fixed: ${benefit.copayment_fixed or 0}")
        print(f"  Copay %: {benefit.copayment_percentage or 0}%")
        
        # Fix the configuration to be more reasonable
        # Since coverage is high ($500,000), let's set a moderate deductible
        # and add some copayment structure
        benefit.deductible_amount = Decimal('100.00')  # Reasonable annual deductible
        benefit.copayment_fixed = Decimal('25.00')     # $25 fixed copay per prescription
        benefit.copayment_percentage = Decimal('10.00') # 10% coinsurance
        benefit.save()
        
        print(f"\nAfter fix:")
        print(f"  Coverage amount: ${benefit.coverage_amount}")
        print(f"  Deductible: ${benefit.deductible_amount}")
        print(f"  Copay fixed: ${benefit.copayment_fixed}")
        print(f"  Copay %: {benefit.copayment_percentage}%")
        
        print(f"\n✅ Successfully updated Toddles pharmacy benefit configuration")
        
    except (SchemeCategory.DoesNotExist, BenefitType.DoesNotExist, SchemeBenefit.DoesNotExist) as e:
        print(f"❌ Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    fix_toddles_pharmacy_benefit()