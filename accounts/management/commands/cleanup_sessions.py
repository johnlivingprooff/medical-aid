"""
Management command to clean up expired sessions.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import UserSession, cleanup_expired_sessions


class Command(BaseCommand):
    help = 'Clean up expired user sessions and Django sessions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned up without actually doing it',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Clean up sessions older than this many days (default: 30)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        days = options['days']

        self.stdout.write(
            self.style.SUCCESS(f'Cleaning up expired sessions{" (DRY RUN)" if dry_run else ""}...')
        )

        # Clean up expired sessions
        cleaned_count = cleanup_expired_sessions()

        # Also clean up old UserSessions based on age
        cutoff_date = timezone.now() - timezone.timedelta(days=days)

        old_sessions = UserSession.objects.filter(
            created_at__lt=cutoff_date
        )

        if dry_run:
            self.stdout.write(
                f'Would clean up {cleaned_count} expired sessions'
            )
            self.stdout.write(
                f'Would clean up {old_sessions.count()} sessions older than {days} days'
            )
        else:
            # Actually delete old sessions
            deleted_count = old_sessions.delete()[0]

            self.stdout.write(
                self.style.SUCCESS(f'Cleaned up {cleaned_count} expired sessions')
            )
            self.stdout.write(
                self.style.SUCCESS(f'Deleted {deleted_count} old sessions ({days} days+)')
            )

        self.stdout.write(self.style.SUCCESS('Session cleanup completed!'))