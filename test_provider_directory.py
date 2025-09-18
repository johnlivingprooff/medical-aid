#!/usr/bin/env python
"""
Test script for the provider directory functionality.
Tests provider search, filtering, and performance metrics.
"""

import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import ProviderProfile, User, ProviderNetworkMembership
from schemes.models import SchemeCategory
from core.views_providers_directory import (
    ProviderDirectoryView,
    ProviderDetailView,
    ProviderDirectoryStatsView
)
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser


def create_test_data():
    """Use existing test data instead of creating new providers"""
    print("🧪 Using existing test data...")

    # Get existing providers
    existing_providers = ProviderProfile.objects.all()[:4]  # Get first 4 providers

    if len(existing_providers) < 4:
        print(f"  ❌ Need at least 4 providers, found {len(existing_providers)}")
        return []

    created_providers = []
    for provider in existing_providers:
        created_providers.append(provider)
        print(f"  ✅ Using existing provider: {provider.facility_name}")

    return created_providers


def test_provider_directory():
    """Test provider directory listing and filtering"""
    print("\n🧪 Testing Provider Directory...")

    # Create test request
    factory = RequestFactory()
    view = ProviderDirectoryView()

    # Test basic listing
    request = factory.get('/api/providers/directory/')
    request.user = AnonymousUser()  # Simulate authenticated user
    view.request = request

    try:
        queryset = view.get_queryset()
        providers = list(queryset)
        print(f"  ✅ Found {len(providers)} providers in directory")

        # Test filtering by facility type
        request = factory.get('/api/providers/directory/?facility_type=HOSPITAL')
        view.request = request
        queryset = view.get_queryset()
        hospitals = list(queryset)
        print(f"  ✅ Found {len(hospitals)} hospitals")

        # Test filtering by city
        request = factory.get('/api/providers/directory/?city=Cape Town')
        view.request = request
        queryset = view.get_queryset()
        cape_town_providers = list(queryset)
        print(f"  ✅ Found {len(cape_town_providers)} providers in Cape Town")

        # Test search
        request = factory.get('/api/providers/directory/?search=hospital')
        view.request = request
        queryset = view.get_queryset()
        search_results = list(queryset)
        print(f"  ✅ Search for 'hospital' found {len(search_results)} results")

        return True

    except Exception as e:
        print(f"  ❌ Directory test failed: {str(e)}")
        return False


def test_provider_detail():
    """Test provider detail view"""
    print("\n🧪 Testing Provider Detail...")

    try:
        # Get first provider
        provider = ProviderProfile.objects.first()
        if not provider:
            print("  ❌ No providers found for detail test")
            return False

        factory = RequestFactory()
        view = ProviderDetailView()

        # Test detail retrieval
        request = factory.get(f'/api/providers/{provider.user.username}/')
        request.user = AnonymousUser()
        view.request = request

        # Simulate the get_object method
        view.kwargs = {'username': provider.user.username}
        detail_provider = view.get_object()

        print(f"  ✅ Retrieved details for: {detail_provider.facility_name}")
        print(f"  📊 Facility type: {detail_provider.facility_type}")
        print(f"  📍 City: {detail_provider.city}")

        return True

    except Exception as e:
        print(f"  ❌ Detail test failed: {str(e)}")
        return False


def test_directory_stats():
    """Test provider directory statistics"""
    print("\n🧪 Testing Directory Statistics...")

    try:
        factory = RequestFactory()
        view = ProviderDirectoryStatsView()

        request = factory.get('/api/providers/directory/stats/')
        request.user = AnonymousUser()
        view.request = request

        response = view.get(request)
        stats = response.data

        print(f"  ✅ Total providers: {stats.get('total_providers', 0)}")
        print(f"  ✅ Active providers: {stats.get('active_providers', 0)}")

        facility_breakdown = stats.get('facility_type_breakdown', {})
        print(f"  ✅ Facility types: {len(facility_breakdown)} categories")

        for facility_type, count in facility_breakdown.items():
            print(f"    - {facility_type}: {count}")

        return True

    except Exception as e:
        print(f"  ❌ Stats test failed: {str(e)}")
        return False


def main():
    """Run all provider directory tests"""
    print("🚀 Starting Provider Directory Tests")
    print("=" * 50)

    try:
        # Create test data
        test_providers = create_test_data()

        # Test directory functionality
        directory_success = test_provider_directory()
        detail_success = test_provider_detail()
        stats_success = test_directory_stats()

        print("\n" + "=" * 50)
        print("📊 Test Results Summary:")
        print(f"  Provider Directory: {'✅ PASS' if directory_success else '❌ FAIL'}")
        print(f"  Provider Detail: {'✅ PASS' if detail_success else '❌ FAIL'}")
        print(f"  Directory Stats: {'✅ PASS' if stats_success else '❌ FAIL'}")

        # Overall success
        overall_success = all([directory_success, detail_success, stats_success])
        print(f"  Overall: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")

        print("\n🎉 Provider Directory Tests Completed!")

    except Exception as e:
        print(f"\n❌ Tests failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()