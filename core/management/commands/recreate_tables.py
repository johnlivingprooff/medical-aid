from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Drop and recreate all tables (alternative to flush for managed databases)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to drop and recreate all tables'
        )
        parser.add_argument(
            '--no-migrations',
            action='store_true',
            help='Skip running migrations after dropping tables'
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.ERROR(
                    '🚨 DANGER: This will DROP ALL TABLES and recreate them!\n'
                    'This will PERMANENTLY DELETE all data.\n'
                    'Use --confirm to proceed.'
                )
            )
            return

        self.stdout.write(self.style.WARNING('🔥 Starting complete database recreation...'))

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

            if tables:
                # Drop all tables
                for table in tables:
                    try:
                        cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
                        self.stdout.write(f'  - Dropped {table}')
                    except Exception as e:
                        self.stdout.write(
                            self.style.WARNING(f'  - Failed to drop {table}: {e}')
                        )

        # Run migrations to recreate tables
        if not options['no_migrations']:
            self.stdout.write('\n🏗️  Recreating tables with migrations...')
            call_command('migrate', verbosity=1)

        self.stdout.write(self.style.SUCCESS('✅ Database recreation complete!'))

        # Optionally reseed
        self.stdout.write('\n💡 Tip: Run "python manage.py seed" to populate with sample data')