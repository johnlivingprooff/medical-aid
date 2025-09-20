#!/usr/bin/env python
"""
Quick test for the patient_pattern fraud detection fix
"""
import os
import sys
import django
from datetime import date

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from claims.services import FraudDetectionEngine
from claims.models import Claim, Patient, BenefitType
from django.contrib.auth import get_user_model

def test_patient_pattern_with_null_date():
    """Test that patient_pattern detection handles null date_of_service"""
    User = get_user_model()

    # Create a mock claim with null date_of_service
    class MockClaim:
        def __init__(self):
            self.id = 1
            self.date_of_service = None  # This should not cause an error
            self.patient = None
            self.provider = None

    # Create validation engine
    engine = FraudDetectionEngine()

    # Test the method directly
    mock_claim = MockClaim()
    result = engine._detect_patient_pattern(mock_claim)

    # Should return None (no fraud detected) instead of crashing
    assert result is None, f"Expected None, got {result}"
    print("✓ Test passed: Null date_of_service handled gracefully")

    print("\n🎉 Fix verified! The patient_pattern fraud detection now handles null dates correctly.")

if __name__ == '__main__':
    test_patient_pattern_with_null_date()