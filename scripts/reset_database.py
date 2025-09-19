#!/usr/bin/env python
"""
Database reset script for Render/Neon deployments
Run this script to safely reset your database in production
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


def reset_database():
    """Safely reset the database by truncating all tables"""
    print("🗑️  Starting database reset...")

    with connection.cursor() as cursor:
        # Get all table names
        cursor.execute("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename NOT LIKE 'pg_%'
            AND tablename NOT LIKE 'sql_%'
        """)

        tables = [row[0] for row in cursor.fetchall()]

        if not tables:
            print("✅ Database is already empty")
            return

        # Disable foreign key checks
        cursor.execute("SET session_replication_role = 'replica'")

        # Truncate all tables
        for table in tables:
            try:
                cursor.execute(f'TRUNCATE TABLE "{table}" CASCADE')
                print(f"  - Cleared {table}")
            except Exception as e:
                print(f"  - Failed to clear {table}: {e}")

        # Re-enable foreign key checks
        cursor.execute("SET session_replication_role = 'origin'")

    print("✅ Database reset complete!")


def reseed_database():
    """Reseed the database with sample data"""
    print("\n🌱 Reseeding database...")
    try:
        execute_from_command_line(['manage.py', 'seed'])
        print("✅ Database reseeding complete!")
    except Exception as e:
        print(f"❌ Reseeding failed: {e}")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--confirm':
        reset_database()
        if len(sys.argv) > 2 and sys.argv[2] == '--reseed':
            reseed_database()
    else:
        print("🚨 DANGER: This will delete ALL data in the database!")
        print("Run with --confirm to proceed")
        print("Run with --confirm --reseed to also reseed after reset")