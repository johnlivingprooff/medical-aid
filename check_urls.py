#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.urls import get_resolver

def show_urls(urlconf='backend.urls'):
    print(f"URL patterns from {urlconf}:")
    print("=" * 80)
    
    resolver = get_resolver(urlconf)
    
    def show_pattern(pattern, prefix=''):
        if hasattr(pattern, 'url_patterns'):
            for p in pattern.url_patterns:
                show_pattern(p, prefix + str(pattern.pattern))
        else:
            full_pattern = prefix + str(pattern.pattern)
            if 'reports' in full_pattern.lower() or 'detailed-claims' in full_pattern.lower():
                print(f"✓ {full_pattern}")
                if hasattr(pattern, 'callback'):
                    print(f"  → {pattern.callback.__module__}.{pattern.callback.__name__}")
    
    for pattern in resolver.url_patterns:
        show_pattern(pattern)

if __name__ == '__main__':
    show_urls()
