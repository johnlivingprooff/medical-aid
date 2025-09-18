#!/usr/bin/env python
"""
Test script for the enhanced EDI processing system.
Tests X12 parsing, validation, and transaction processing.
"""

import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.edi_service import edi_processor, X12Parser, EDIValidator
from core.models import EDITransaction


def test_x12_parsing():
    """Test X12 parsing functionality"""
    print("🧪 Testing X12 Parsing...")

    # Sample X12 837 claim submission
    sample_x12 = """ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *240101*1200*^*00501*000000001*0*P*:~
GS*HC*SENDERID*RECEIVERID*20240101*120000*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*123456*20240101*1200*CH~
NM1*41*2*SENDER NAME*****46*123456789~
PER*IC*CONTACT NAME*TE*5551234567~
NM1*40*2*RECEIVER NAME*****46*987654321~
HL*1**20*1~
NM1*85*2*PROVIDER NAME*****XX*1234567890~
N3*123 PROVIDER ST~
N4*CITY*ST*12345~
REF*EI*123456789~
HL*2*1*22*0~
SBR*P*18*******MC~
NM1*IL*1*PATIENT*LAST*FIRST*M***MI*123456789~
N3*456 PATIENT AVE~
N4*PATIENCITY*PA*12346~
DMG*D8*19800101*M~
NM1*PR*2*MEDICAL AID*****PI*PLAN123~
CLM*CLAIM123*100.00***11:B:1*Y*A*Y*Y~
DTP*434*D8*20240101~
REF*F8*REF123~
HI*BK:8901*BF:V700~
NM1*71*1*DR*PROVIDER*JOHN*M***MD*1234567890~
SVD*PLAN123*50.00*HC:99201~
DTP*472*D8*20240101~
SE*25*0001~
GE*1*1~
IEA*1*000000001~"""

    parser = X12Parser(sample_x12)
    parsed_data = parser.parse()

    print(f"  ✅ Parsed {len(parser.segments)} segments")
    print(f"  ✅ Interchange sender: {parsed_data.get('interchange', {}).get('sender_id', 'N/A')}")
    print(f"  ✅ Functional groups: {len(parsed_data.get('functional_groups', []))}")
    print(f"  ✅ Transactions: {len(parsed_data.get('transactions', []))}")

    if parser.errors:
        print(f"  ⚠️  Parse errors: {parser.errors}")
    else:
        print("  ✅ No parse errors")

    return parsed_data


def test_edi_validation():
    """Test EDI validation functionality"""
    print("\n🧪 Testing EDI Validation...")

    # Get parsed data from previous test
    parsed_data = test_x12_parsing()

    validator = EDIValidator()
    validation_errors = validator.validate_transaction(parsed_data)

    print(f"  ✅ Validation completed with {len(validation_errors)} errors")

    if validation_errors:
        print("  ⚠️  Validation errors found:")
        for error in validation_errors[:3]:  # Show first 3 errors
            print(f"    - {error.get('code', 'UNK')}: {error.get('message', 'Unknown error')}")
    else:
        print("  ✅ No validation errors")

    return validation_errors


def test_edi_processing():
    """Test full EDI processing workflow"""
    print("\n🧪 Testing EDI Processing...")

    # Sample X12 content
    sample_x12 = """ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *240101*1200*^*00501*000000001*0*P*:~
GS*HC*SENDERID*RECEIVERID*20240101*120000*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*123456*20240101*1200*CH~
NM1*41*2*SENDER NAME*****46*123456789~
SE*5*0001~
GE*1*1~
IEA*1*000000001~"""

    success, message, response_data = edi_processor.process_edi_submission(
        x12_content=sample_x12,
        transaction_type=EDITransaction.TransactionType.CLAIM_SUBMISSION
    )

    print(f"  ✅ Processing result: {success}")
    print(f"  📝 Message: {message}")
    print(f"  🆔 Transaction ID: {response_data.get('transaction_id', 'N/A')}")
    print(f"  📊 Segments: {response_data.get('segment_count', 0)}")

    if response_data.get('validation_errors'):
        print(f"  ⚠️  Validation errors: {len(response_data['validation_errors'])}")

    # Verify transaction was created in database
    if success and 'transaction_id' in response_data:
        transaction = EDITransaction.objects.filter(
            transaction_id=response_data['transaction_id']
        ).first()

        if transaction:
            print("  ✅ Transaction saved to database")
            print(f"  📊 Status: {transaction.status}")
            print(f"  📅 Created: {transaction.submitted_at}")
        else:
            print("  ❌ Transaction not found in database")

    return success


def main():
    """Run all EDI tests"""
    print("🚀 Starting EDI System Tests")
    print("=" * 50)

    try:
        # Test X12 parsing
        parsed_data = test_x12_parsing()

        # Test validation
        validation_errors = test_edi_validation()

        # Test full processing
        processing_success = test_edi_processing()

        print("\n" + "=" * 50)
        print("📊 Test Results Summary:")
        print(f"  X12 Parsing: {'✅ PASS' if parsed_data else '❌ FAIL'}")
        print(f"  EDI Validation: {'✅ PASS' if not validation_errors else '⚠️  WARNING'}")
        print(f"  EDI Processing: {'✅ PASS' if processing_success else '❌ FAIL'}")

        # Count total transactions in database
        total_transactions = EDITransaction.objects.count()
        print(f"  Database Transactions: {total_transactions}")

        print("\n🎉 EDI System Tests Completed!")

    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()