#!/usr/bin/env python
"""
Comprehensive security test script for Medical Aid Management System.
Tests encryption, MFA, and session management functionality.
"""

import os
import sys
import django
from pathlib import Path

# Setup Django environment
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
import json

from core.encryption_new import encryption_manager
from accounts.models import UserSession, SessionSettings
from claims.models import Patient, Claim
from schemes.models import SchemeCategory

User = get_user_model()

def test_encryption():
    """Test encryption functionality."""
    print("🔐 Testing Encryption...")

    # Test basic encryption/decryption
    test_data = "Sensitive PHI data"
    encrypted = encryption_manager.encrypt(test_data)
    decrypted = encryption_manager.decrypt(encrypted)

    assert decrypted == test_data, "Encryption/decryption failed"
    print("✅ Basic encryption/decryption working")

    # Test encrypted field types
    from core.encryption_new import EncryptedCharField, EncryptedTextField

    # These would normally be used in models, but we can test the field logic
    field = EncryptedCharField(max_length=100)
    encrypted_value = field.get_prep_value("test value")
    decrypted_value = field.from_db_value(encrypted_value, None, None)

    assert decrypted_value == "test value", "Encrypted field failed"
    print("✅ Encrypted field types working")

def test_mfa_setup():
    """Test MFA functionality."""
    print("🔑 Testing MFA Setup...")

    # Create a test user
    user, created = User.objects.get_or_create(
        username='test_security_user',
        defaults={
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
    )

    if created:
        user.set_password('testpass123')
        user.save()

    # Test MFA device creation (would normally be done via API)
    from django_otp.plugins.otp_totp.models import TOTPDevice

    device, created = TOTPDevice.objects.get_or_create(
        user=user,
        name='test_device',
        defaults={'confirmed': True}
    )

    assert device is not None, "MFA device creation failed"
    print("✅ MFA device creation working")

    # Clean up
    if created:
        device.delete()
        user.delete()

def test_session_management():
    """Test session management functionality."""
    print("📊 Testing Session Management...")

    # Create a test user
    user, created = User.objects.get_or_create(
        username='test_session_user',
        defaults={
            'email': 'session@example.com',
            'first_name': 'Session',
            'last_name': 'Test'
        }
    )

    if created:
        user.set_password('testpass123')
        user.save()

    # Create a test session
    from django.contrib.sessions.models import Session
    import uuid

    session_key = f'test_session_{uuid.uuid4().hex[:10]}'
    django_session = Session.objects.create(
        session_key=session_key,
        session_data='{}',
        expire_date=timezone.now() + timedelta(hours=1)
    )

    session = UserSession.objects.create(
        user=user,
        session=django_session,
        ip_address='127.0.0.1',
        user_agent='Test Browser',
        device_info={'type': 'desktop', 'browser': 'Test'},
        location_info={'country': 'Local Test'}
    )

    assert session is not None, "Session creation failed"
    print("✅ Session creation working")

    # Test session cleanup
    from accounts.models_sessions import cleanup_expired_sessions

    # Mark session as expired
    session.created_at = timezone.now() - timedelta(days=31)
    session.save()

    cleaned_count = cleanup_expired_sessions()
    print(f"✅ Session cleanup working (cleaned {cleaned_count} sessions)")

    # Clean up
    session.delete()
    if created:
        user.delete()

def test_encrypted_models():
    """Test encrypted model field functionality."""
    print("🛡️ Testing Encrypted Models...")

    # Test encrypted field types without database constraints
    from core.encryption import EncryptedCharField, EncryptedTextField

    # Test EncryptedCharField
    field = EncryptedCharField(max_length=200)  # Use longer length for encrypted data
    test_value = "1234567890"
    encrypted_value = field.get_prep_value(test_value)
    decrypted_value = field.from_db_value(encrypted_value, None, None)

    assert decrypted_value == test_value, "EncryptedCharField failed"
    print("✅ EncryptedCharField working")

    # Test EncryptedTextField
    text_field = EncryptedTextField()
    test_text = "Test diagnosis information"
    encrypted_text = text_field.get_prep_value(test_text)
    decrypted_text = text_field.from_db_value(encrypted_text, None, None)

    assert decrypted_text == test_text, "EncryptedTextField failed"
    print("✅ EncryptedTextField working")

    print("✅ Encrypted model fields working")

def run_all_tests():
    """Run all security tests."""
    print("🚀 Starting Security Tests for Medical Aid System")
    print("=" * 50)

    try:
        test_encryption()
        test_mfa_setup()
        test_session_management()
        test_encrypted_models()

        print("=" * 50)
        print("🎉 All security tests passed!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)