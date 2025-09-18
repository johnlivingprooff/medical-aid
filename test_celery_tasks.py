#!/usr/bin/env python
"""
Test script to run Celery tasks synchronously for testing
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.tasks import health_check, cache_warmup

def test_tasks():
    """Test Celery tasks"""
    print("🧪 Testing Celery Tasks")
    print("=" * 50)

    # Test health check task
    print("\n1. Testing health_check task...")
    try:
        result = health_check()
        print(f"✅ Health check result: {result}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")

    # Test cache warmup task
    print("\n2. Testing cache_warmup task...")
    try:
        result = cache_warmup()
        print(f"✅ Cache warmup result: {result}")
    except Exception as e:
        print(f"❌ Cache warmup failed: {e}")

    print("\n🎉 Task testing completed!")

if __name__ == '__main__':
    test_tasks()