#!/usr/bin/env python
import os, django
from datetime import datetime, timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from claims.models import Patient, Claim
from claims.services import FraudDetectionEngine
from schemes.models import BenefitType

# Get some test data
User = get_user_model()
try:
    patient = Patient.objects.first()
    provider = User.objects.filter(role='PROVIDER').first()
    benefit_type = BenefitType.objects.first()

    if not all([patient, provider, benefit_type]):
        print('Missing test data')
        exit(1)

    print(f'Testing with: Patient={patient}, Provider={provider}, Service={benefit_type}')

    # Create a simple claim
    claim = Claim(
        patient=patient,
        provider=provider,
        service_type=benefit_type,
        cost=Decimal('200.00'),
        date_submitted=timezone.now(),
        date_of_service=timezone.now().date()
    )

    # Test fraud detection
    engine = FraudDetectionEngine()
    patterns = engine.detect_fraud_patterns(claim)

    print(f'Fraud patterns detected: {len(patterns)}')
    for i, pattern in enumerate(patterns, 1):
        print(f'{i}. {pattern["title"]} (Score: {pattern["score"]}, Severity: {pattern["severity"]})')
        print(f'   {pattern["description"]}')

except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()