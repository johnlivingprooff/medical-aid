#!/usr/bin/env python
"""
Quick test for SystemSettings.get_setting method
"""
import os
import sys
import django
from datetime import date

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import SystemSettings

def test_get_setting():
    """Test the get_setting method logic"""
    # Test 1: Non-existent key should return default
    result = SystemSettings.get_setting('NON_EXISTENT_KEY', 'default_value')
    assert result == 'default_value', f"Expected 'default_value', got {result}"
    print("✓ Test 1 passed: Non-existent key returns default")

    # Test 2: Non-existent key with no default should return None
    result = SystemSettings.get_setting('ANOTHER_NON_EXISTENT_KEY')
    assert result is None, f"Expected None, got {result}"
    print("✓ Test 2 passed: Non-existent key with no default returns None")

    print("\n🎉 All tests passed! The get_setting method is working correctly.")

if __name__ == '__main__':
    test_get_setting()