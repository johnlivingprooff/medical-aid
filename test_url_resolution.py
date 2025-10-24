import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.urls import resolve, reverse, get_resolver
from django.urls.exceptions import Resolver404

print("Testing URL Resolution")
print("=" * 70)

# Test URL resolution
test_urls = [
    '/api/core/reports/scheme-usage/',
    '/api/core/reports/disease-stats/',
    '/api/core/reports/detailed-claims/',
]

for url in test_urls:
    print(f"\nTesting: {url}")
    try:
        match = resolve(url)
        print(f"  ✓ Resolved to: {match.func.__module__}.{match.func.__name__}")
        print(f"  ✓ View name: {match.view_name}")
        print(f"  ✓ URL name: {match.url_name}")
    except Resolver404 as e:
        print(f"  ❌ 404 - Not Found: {e}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

# Try to reverse lookup
print("\n" + "=" * 70)
print("Testing Reverse URL Lookup")
print("=" * 70)

names = ['report-scheme-usage', 'report-disease-stats', 'report-detailed-claims']
for name in names:
    print(f"\nLooking up: {name}")
    try:
        url = reverse(f'core:{name}')
        print(f"  ✓ Found: {url}")
    except Exception as e:
        print(f"  ❌ Not found: {e}")

# List all core.* URL names
print("\n" + "=" * 70)
print("All registered URL names with 'report' or 'claims'")
print("=" * 70)

resolver = get_resolver()
def show_urls(urlpatterns, prefix=''):
    for pattern in urlpatterns:
        if hasattr(pattern, 'url_patterns'):
            show_urls(pattern.url_patterns, prefix + str(pattern.pattern))
        else:
            full_url = prefix + str(pattern.pattern)
            if 'report' in full_url.lower() or 'claims' in full_url.lower():
                print(f"  {full_url}")
                if hasattr(pattern, 'name') and pattern.name:
                    print(f"    Name: {pattern.name}")

show_urls(resolver.url_patterns)
