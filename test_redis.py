#!/usr/bin/env python
"""
Redis connectivity test script
"""
import os
import sys
import redis
from django.conf import settings

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

def test_redis_connection():
    """Test Redis connection and basic operations"""
    try:
        # Get Redis URL from settings
        redis_url = getattr(settings, 'REDIS_URL', 'redis://127.0.0.1:6379/0')

        # Parse Redis URL
        if redis_url.startswith('redis://'):
            # Simple parsing for redis://host:port/db
            parts = redis_url.replace('redis://', '').split('/')
            host_port = parts[0].split(':')
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 6379
            db = int(parts[1]) if len(parts) > 1 else 0
        else:
            host, port, db = '127.0.0.1', 6379, 0

        print(f"Testing Redis connection to {host}:{port}, DB {db}")

        # Create Redis client
        r = redis.Redis(host=host, port=port, db=db, decode_responses=True)

        # Test connection
        r.ping()
        print("✓ Redis connection successful")

        # Test basic operations
        test_key = 'test_connection'
        test_value = 'working'

        r.set(test_key, test_value)
        retrieved_value = r.get(test_key)
        r.delete(test_key)

        if retrieved_value == test_value:
            print("✓ Redis read/write operations working")
        else:
            print("✗ Redis read/write operations failed")
            return False

        # Test Django cache
        from django.core.cache import cache
        cache.set('django_test', 'success', timeout=60)
        cached_value = cache.get('django_test')

        if cached_value == 'success':
            print("✓ Django Redis cache working")
        else:
            print("✗ Django Redis cache failed")
            return False

        print("🎉 All Redis tests passed!")
        return True

    except redis.ConnectionError as e:
        print(f"✗ Redis connection failed: {e}")
        print("\nTo start Redis:")
        print("1. Download Redis from https://redis.io/download")
        print("2. Extract and run: redis-server.exe")
        print("3. Or use Docker: docker run -d -p 6379:6379 redis:alpine")
        return False

    except Exception as e:
        print(f"✗ Redis test failed: {e}")
        return False

if __name__ == '__main__':
    success = test_redis_connection()
    sys.exit(0 if success else 1)