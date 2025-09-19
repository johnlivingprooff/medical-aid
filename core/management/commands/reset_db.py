from django.core.management.base import BaseCommand
from django.db import connection
from django.contrib.auth import get_user_model
from django.apps import apps


class Command(BaseCommand):
    help = 'Reset database by truncating all tables (safe for production)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to delete all data'
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    '⚠️  WARNING: This will delete ALL data in the database!\n'
                    'Use --confirm to proceed.'
                )
            )
            return

        self.stdout.write(self.style.WARNING('🗑️  Starting database reset...'))

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
                self.stdout.write(self.style.SUCCESS('✅ Database is already empty'))
                return

            # Disable foreign key checks
            cursor.execute("SET session_replication_role = 'replica'")

            # Truncate all tables
            for table in tables:
                try:
                    cursor.execute(f'TRUNCATE TABLE "{table}" CASCADE')
                    self.stdout.write(f'  - Cleared {table}')
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f'  - Failed to clear {table}: {e}')
                    )

            # Re-enable foreign key checks
            cursor.execute("SET session_replication_role = 'origin'")

        self.stdout.write(self.style.SUCCESS('✅ Database reset complete!'))

        # Optionally reseed
        self.stdout.write('\n💡 Tip: Run "python manage.py seed" to reseed the database')