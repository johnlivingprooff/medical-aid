import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('medical_aid')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Define periodic tasks
app.conf.beat_schedule = {
    'cache-warmup-daily': {
        'task': 'core.tasks.cache_warmup',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    'cleanup-expired-cache': {
        'task': 'core.tasks.cleanup_expired_cache',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
    },
    'generate-daily-reports': {
        'task': 'core.tasks.generate_daily_reports',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6 AM
    },
    'health-check': {
        'task': 'core.tasks.health_check',
        'schedule': 300.0,  # Every 5 minutes
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')