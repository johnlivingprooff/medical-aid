#!/usr/bin/env python
"""
Render deployment script for database management
This script handles database setup and seeding for Render deployments
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from django.core.management import execute_from_command_line


def check_database_connection():
    """Check if database connection is working"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


def run_migrations():
    """Run database migrations"""
    print("🏗️  Running migrations...")
    try:
        execute_from_command_line(['manage.py', 'migrate', '--verbosity=1'])
        print("✅ Migrations completed successfully")
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


def seed_database():
    """Seed database with initial data"""
    print("🌱 Seeding database...")
    try:
        execute_from_command_line(['manage.py', 'seed', '--verbosity=1'])
        print("✅ Database seeding completed successfully")
        return True
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        return False


def collect_static():
    """Collect static files"""
    print("📁 Collecting static files...")
    try:
        execute_from_command_line(['manage.py', 'collectstatic', '--noinput', '--verbosity=1'])
        print("✅ Static files collected successfully")
        return True
    except Exception as e:
        print(f"❌ Static collection failed: {e}")
        return False


def main():
    """Main deployment function"""
    print("🚀 Starting Render deployment...")

    # Check database connection
    if not check_database_connection():
        sys.exit(1)

    # Run migrations
    if not run_migrations():
        sys.exit(1)

    # Seed database (only if it's empty or explicitly requested)
    should_seed = os.getenv('RENDER_SEED_DATABASE', 'false').lower() == 'true'

    if should_seed:
        if not seed_database():
            print("⚠️  Seeding failed, but continuing deployment...")
    else:
        print("ℹ️  Skipping database seeding (set RENDER_SEED_DATABASE=true to enable)")

    # Collect static files
    if not collect_static():
        sys.exit(1)

    print("✅ Render deployment completed successfully!")


if __name__ == '__main__':
    main()