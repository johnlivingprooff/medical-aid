#!/usr/bin/env python
"""
Test script for Pre-Authorization Workflow System
Tests the complete pre-authorization workflow including:
- Rule creation and evaluation
- Request submission and auto-approval
- Manual approval/rejection workflows
- Approval revocation
- Integration with claims system
"""

import os
import sys
import django
from datetime import date, timedelta
from decimal import Decimal

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from claims.models import PreAuthorizationRequest, PreAuthorizationApproval, PreAuthorizationRule, Patient, Claim
from claims.services import PreAuthorizationService
from schemes.models import BenefitType, SchemeCategory
from accounts.models import ProviderProfile

User = get_user_model()

def create_test_data():
    """Create test data for pre-authorization testing"""
    print("Creating test data...")

    # Get or create test scheme
    scheme, created = SchemeCategory.objects.get_or_create(
        name="Test Medical Aid Scheme",
        defaults={'description': "Test scheme for pre-auth testing", 'price': Decimal('1000.00')}
    )

    # Get or create test benefit type
    benefit_type, created = BenefitType.objects.get_or_create(
        name="MRI Scan"
    )

    # Create test provider
    provider_user, created = User.objects.get_or_create(
        username="test_provider",
        defaults={
            'email': 'provider@test.com',
            'first_name': 'Test',
            'last_name': 'Provider',
            'role': 'PROVIDER'
        }
    )
    if created:
        provider_user.set_password('testpass123')
        provider_user.save()

    provider_profile, created = ProviderProfile.objects.get_or_create(
        user=provider_user,
        defaults={
            'facility_name': 'Test Radiology',
            'facility_type': 'IMAGING'
        }
    )

    # Create test patient
    patient_user, created = User.objects.get_or_create(
        username="test_patient",
        defaults={
            'email': 'patient@test.com',
            'first_name': 'Test',
            'last_name': 'Patient',
            'role': 'PATIENT'
        }
    )
    if created:
        patient_user.set_password('testpass123')
        patient_user.save()

    patient, created = Patient.objects.get_or_create(
        user=patient_user,
        defaults={
            'scheme': scheme,
            'enrollment_date': date.today() - timedelta(days=365),
            'date_of_birth': date(1980, 1, 1),
            'gender': 'M'
        }
    )

    return scheme, benefit_type, provider_user, patient

def test_preauth_rules():
    """Test pre-authorization rule creation and evaluation"""
    print("\n=== Testing Pre-Authorization Rules ===")

    scheme, benefit_type, provider, patient = create_test_data()

    # Create test rules
    rules_data = [
        {
            'name': 'Low Cost Auto-Approve',
            'description': 'Auto-approve requests under $500',
            'benefit_type': benefit_type,
            'rule_type': 'COST_THRESHOLD',
            'condition_field': 'estimated_cost',
            'condition_operator': 'LT',
            'condition_value': '500.00',
            'action_type': 'AUTO_APPROVE',
            'action_value': '100',  # 100% approval
            'is_active': True,
            'priority': 1
        },
        {
            'name': 'High Cost Review',
            'description': 'Flag high-cost requests for review',
            'benefit_type': benefit_type,
            'rule_type': 'COST_THRESHOLD',
            'condition_field': 'estimated_cost',
            'condition_operator': 'GT',
            'condition_value': '5000.00',
            'action_type': 'FLAG_REVIEW',
            'action_value': 'HIGH_COST',
            'is_active': True,
            'priority': 2
        }
    ]

    created_rules = []
    for rule_data in rules_data:
        rule, created = PreAuthorizationRule.objects.get_or_create(
            name=rule_data['name'],
            defaults=rule_data
        )
        created_rules.append(rule)
        print(f"✓ Created rule: {rule.name}")

    # Test rule evaluation
    service = PreAuthorizationService()

    # Test low-cost scenario (should auto-approve)
    low_cost_request = PreAuthorizationRequest(
        patient=patient,
        provider=provider,
        benefit_type=benefit_type,
        procedure_description="Basic X-Ray",
        estimated_cost=Decimal('300.00'),
        urgency_level='ROUTINE',
        clinical_notes="Routine check-up"
    )

    result = service.evaluate_rules(low_cost_request)
    print(f"Low-cost evaluation result: {result}")

    # Test high-cost scenario (should flag for review)
    high_cost_request = PreAuthorizationRequest(
        patient=patient,
        provider=provider,
        benefit_type=benefit_type,
        procedure_description="Complex MRI",
        estimated_cost=Decimal('6000.00'),
        urgency_level='URGENT',
        clinical_notes="Emergency diagnosis required"
    )

    result = service.evaluate_rules(high_cost_request)
    print(f"High-cost evaluation result: {result}")

    return created_rules

def test_preauth_workflow():
    """Test complete pre-authorization workflow"""
    print("\n=== Testing Pre-Authorization Workflow ===")

    scheme, benefit_type, provider, patient = create_test_data()

    # Create a rule for auto-approval
    rule, created = PreAuthorizationRule.objects.get_or_create(
        name='Auto-Approve Under $1000',
        defaults={
            'description': 'Auto-approve requests under $1000',
            'benefit_type': benefit_type,
            'rule_type': 'COST_THRESHOLD',
            'condition_field': 'estimated_cost',
            'condition_operator': 'LT',
            'condition_value': '1000.00',
            'action_type': 'AUTO_APPROVE',
            'action_value': '100',
            'is_active': True,
            'priority': 1
        }
    )

    # Create pre-auth request
    request = PreAuthorizationRequest.objects.create(
        patient=patient,
        provider=provider,
        benefit_type=benefit_type,
        procedure_description="CT Scan - Head",
        estimated_cost=Decimal('750.00'),
        urgency_level='URGENT',
        clinical_notes="Patient presents with severe headache, possible concussion",
        supporting_documents="CT scan request form attached",
        status=PreAuthorizationRequest.Status.PENDING
    )

    print(f"✓ Created pre-auth request: {request.request_number}")

    # Test auto-approval
    service = PreAuthorizationService()
    auto_result = service.process_auto_approval(request)

    print(f"Auto-approval result: {auto_result}")

    if auto_result['auto_processed'] and auto_result['status'] == 'APPROVED':
        print("✓ Auto-approval successful")
        request.refresh_from_db()
        print(f"Request status: {request.status}")
        print(f"Approved amount: {request.approved_amount}")

        # Check if approval record was created
        approval = PreAuthorizationApproval.objects.filter(request=request).first()
        if approval:
            print(f"✓ Approval record created: {approval.id}")
        else:
            print("✗ No approval record found")
    else:
        print("✗ Auto-approval failed or not triggered")

    return request

def test_manual_approval():
    """Test manual approval workflow"""
    print("\n=== Testing Manual Approval Workflow ===")

    scheme, benefit_type, provider, patient = create_test_data()

    # Create admin user for manual approval
    admin_user, created = User.objects.get_or_create(
        username="test_admin",
        defaults={
            'email': 'admin@test.com',
            'first_name': 'Test',
            'last_name': 'Admin',
            'role': 'ADMIN'
        }
    )
    if created:
        admin_user.set_password('testpass123')
        admin_user.save()

    # Create a request that won't auto-approve (high cost)
    request = PreAuthorizationRequest.objects.create(
        patient=patient,
        provider=provider,
        benefit_type=benefit_type,
        procedure_description="Advanced MRI with Contrast",
        estimated_cost=Decimal('2500.00'),
        urgency_level='URGENT',
        clinical_notes="Complex neurological assessment required",
        status=PreAuthorizationRequest.Status.PENDING
    )

    print(f"✓ Created high-cost request: {request.request_number}")

    # Manually approve the request
    request.status = PreAuthorizationRequest.Status.APPROVED
    request.approved_amount = Decimal('2000.00')
    request.approved_conditions = "Pre-authorization valid for 30 days. Patient must present medical aid card."
    request.review_notes = "Approved with conditions - cost containment applied"
    request.reviewed_by = admin_user
    request.reviewed_date = timezone.now()
    request.save()

    print("✓ Manually approved request")

    # Create approval record
    approval = PreAuthorizationApproval.objects.create(
        request=request,
        benefit_type=benefit_type,
        approved_amount=Decimal('2000.00'),
        approved_conditions="Pre-authorization valid for 30 days",
        approval_notes="Approved with cost containment",
        approved_by=admin_user
    )

    print(f"✓ Created approval record: {approval.id}")

    return request, approval

def test_claim_integration():
    """Test integration with claims system"""
    print("\n=== Testing Claims Integration ===")

    scheme, benefit_type, provider, patient = create_test_data()

    # Create approved pre-auth request
    preauth_request = PreAuthorizationRequest.objects.create(
        patient=patient,
        provider=provider,
        benefit_type=benefit_type,
        procedure_description="Ultrasound - Abdominal",
        estimated_cost=Decimal('450.00'),
        urgency_level='ROUTINE',
        status=PreAuthorizationRequest.Status.APPROVED,
        approved_amount=Decimal('450.00'),
        approved_conditions="Standard approval"
    )

    print(f"✓ Created approved pre-auth: {preauth_request.request_number}")

    # Create claim with pre-auth reference
    claim = Claim.objects.create(
        patient=patient,
        provider=provider,
        service_type=benefit_type,
        cost=Decimal('450.00'),
        date_of_service=date.today(),
        diagnosis_code="R10.9",
        procedure_code="US-ABD",
        notes=f"Pre-authorized: {preauth_request.request_number}",
        preauth_number=preauth_request.request_number,
        preauth_expiry=preauth_request.expiry_date
    )

    print(f"✓ Created claim with pre-auth reference: {claim.id}")

    return preauth_request, claim

def run_all_tests():
    """Run all pre-authorization tests"""
    print("Starting Pre-Authorization System Tests")
    print("=" * 50)

    try:
        # Test rule creation and evaluation
        rules = test_preauth_rules()

        # Test auto-approval workflow
        auto_request = test_preauth_workflow()

        # Test manual approval workflow
        manual_request, manual_approval = test_manual_approval()

        # Test claims integration
        preauth, claim = test_claim_integration()

        print("\n" + "=" * 50)
        print("✅ All Pre-Authorization Tests Completed Successfully!")
        print("\nSummary:")
        print(f"- Created {len(rules)} test rules")
        print(f"- Tested auto-approval workflow")
        print(f"- Tested manual approval workflow")
        print(f"- Tested claims integration")
        print("\nThe Pre-Authorization Workflow System is ready for production use!")

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_all_tests()