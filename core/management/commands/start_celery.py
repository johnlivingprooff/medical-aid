#!/usr/bin/env python
"""
Management command to start Celery worker and beat scheduler
"""
import os
import sys
import subprocess
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = 'Start Celery worker and beat scheduler for background tasks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--worker-only',
            action='store_true',
            help='Start only the worker, not the beat scheduler',
        )
        parser.add_argument(
            '--beat-only',
            action='store_true',
            help='Start only the beat scheduler, not the worker',
        )
        parser.add_argument(
            '--concurrency',
            type=int,
            default=2,
            help='Number of worker processes (default: 2)',
        )

    def handle(self, *args, **options):
        # Check if Redis is available
        redis_available = getattr(settings, 'REDIS_AVAILABLE', False)

        if not redis_available:
            self.stdout.write(
                self.style.WARNING(
                    '⚠️  Redis not available. Using database broker (slower performance).\n'
                    'To improve performance, install and start Redis:\n'
                    '1. Download from: https://redis.io/download\n'
                    '2. Run: redis-server.exe\n'
                    '3. Or use Docker: docker run -d -p 6379:6379 redis:alpine'
                )
            )

        if options['beat_only']:
            self.start_beat_scheduler()
        elif options['worker_only']:
            self.start_worker(options['concurrency'])
        else:
            # Start both
            self.start_worker(options['concurrency'])
            self.start_beat_scheduler()

    def start_worker(self, concurrency):
        """Start Celery worker"""
        self.stdout.write(
            self.style.SUCCESS(f'🚀 Starting Celery worker with {concurrency} processes...')
        )

        cmd = [
            sys.executable, '-m', 'celery', '-A', 'backend.celery',
            'worker', '--loglevel=info', f'--concurrency={concurrency}',
            '--pool=solo'  # Use solo pool for Windows compatibility
        ]

        try:
            subprocess.run(cmd, check=True)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('🛑 Celery worker stopped'))
        except subprocess.CalledProcessError as e:
            self.stderr.write(
                self.style.ERROR(f'Failed to start Celery worker: {e}')
            )

    def start_beat_scheduler(self):
        """Start Celery beat scheduler"""
        self.stdout.write(
            self.style.SUCCESS('⏰ Starting Celery beat scheduler...')
        )

        cmd = [
            sys.executable, '-m', 'celery', '-A', 'backend.celery',
            'beat', '--loglevel=info', '--scheduler=django_celery_beat.schedulers:DatabaseScheduler'
        ]

        try:
            subprocess.run(cmd, check=True)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('🛑 Celery beat scheduler stopped'))
        except subprocess.CalledProcessError as e:
            self.stderr.write(
                self.style.ERROR(f'Failed to start Celery beat scheduler: {e}')
            )