# Celery Background Tasks Setup

This document describes the Celery background task system implemented for the Medical Aid Management System.

## Overview

Celery is an asynchronous task queue/job queue based on distributed message passing. It allows us to run time-consuming tasks in the background, improving application responsiveness and scalability.

## Architecture

- **Broker**: Redis (if available) or Database (fallback)
- **Result Backend**: Redis (if available) or Database (fallback)
- **Task Routing**: Organized by queues (cache, reports, monitoring)
- **Monitoring**: Django Admin integration with django-celery-beat

## Installation

Celery and related packages are already installed:

```bash
pip install celery==5.4.0 django-celery-beat==2.6.0 django-celery-results==2.6.0
```

## Configuration

### Django Settings

The Celery configuration is in `backend/settings.py`:

```python
# Celery Configuration
if REDIS_AVAILABLE:
    CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
    CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
else:
    CELERY_BROKER_URL = 'django://'
    CELERY_RESULT_BACKEND = 'django-db'

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
```

### Task Routing

Tasks are organized into queues:

- `cache`: Cache-related tasks (warmup, cleanup)
- `reports`: Report generation tasks
- `monitoring`: Health checks and monitoring

## Available Tasks

### Core Tasks (`core/tasks.py`)

1. **`cache_warmup`**
   - Warms up cache with frequently accessed data
   - Scheduled: Daily at 2 AM
   - Queue: cache

2. **`cleanup_expired_cache`**
   - Cleans up expired cache entries
   - Scheduled: Daily at 3 AM
   - Queue: cache

3. **`generate_daily_reports`**
   - Generates daily summary reports
   - Scheduled: Daily at 6 AM
   - Queue: reports

4. **`health_check`**
   - Performs system health checks
   - Scheduled: Every 5 minutes
   - Queue: monitoring

5. **`process_bulk_claims`**
   - Processes multiple claims in bulk
   - Manual execution
   - Queue: default

6. **`send_notification_email`**
   - Sends notification emails asynchronously
   - Manual execution
   - Queue: default

## Running Celery

### Development

Use the management command to start Celery:

```bash
# Start both worker and beat scheduler
python manage.py start_celery

# Start only worker
python manage.py start_celery --worker-only

# Start only beat scheduler
python manage.py start_celery --beat-only

# Specify concurrency
python manage.py start_celery --concurrency=4
```

### Production

For production deployment, run Celery as a service:

```bash
# Worker
celery -A backend.celery worker --loglevel=info

# Beat scheduler
celery -A backend.celery beat --loglevel=info --scheduler=django_celery_beat.schedulers:DatabaseScheduler
```

## Monitoring

### Django Admin

Access Celery monitoring through Django Admin:
- **Periodic Tasks**: `/admin/django_celery_beat/periodictask/`
- **Task Results**: `/admin/django_celery_results/taskresult/`
- **Intervals**: `/admin/django_celery_beat/intervalschedule/`
- **Crontabs**: `/admin/django_celery_beat/crontabschedule/`

### Flower (Optional)

For advanced monitoring, install Flower:

```bash
pip install flower
celery -A backend.celery flower
```

Access at: http://localhost:5555

## Usage Examples

### Running Tasks Manually

```python
from core.tasks import cache_warmup, health_check

# Run synchronously (for testing)
result = cache_warmup()
print(result)

# Run asynchronously
task = cache_warmup.delay()
print(f"Task ID: {task.id}")

# Check result
result = task.get(timeout=10)
```

### Bulk Operations

```python
from core.tasks import process_bulk_claims

# Process multiple claims
claim_ids = [1, 2, 3, 4, 5]
result = process_bulk_claims.delay(claim_ids)
```

### Email Notifications

```python
from core.tasks import send_notification_email

# Send email asynchronously
send_notification_email.delay(
    recipient_email="user@example.com",
    subject="Claim Approved",
    message="Your claim has been approved."
)
```

## Redis Setup (Optional but Recommended)

For better performance, set up Redis:

### Windows
1. Download Redis from: https://redis.io/download
2. Extract and run: `redis-server.exe`
3. Or use Docker: `docker run -d -p 6379:6379 redis:alpine`

### Environment Variables

Set these in your `.env` file:

```bash
REDIS_URL=redis://127.0.0.1:6379/0
```

## Troubleshooting

### Common Issues

1. **Tasks not executing**
   - Check if Celery worker is running
   - Verify broker connection
   - Check task logs

2. **Redis connection errors**
   - Ensure Redis is running
   - Check REDIS_URL configuration
   - Verify firewall settings

3. **Database broker fallback**
   - If Redis is unavailable, system uses database broker
   - Performance will be slower but functional

### Logs

Check Celery logs for debugging:

```bash
# Worker logs
celery -A backend.celery worker --loglevel=debug

# Beat logs
celery -A backend.celery beat --loglevel=debug
```

## Performance Considerations

- **Redis vs Database Broker**: Redis provides better performance
- **Task Timeouts**: Configure appropriate timeouts for long-running tasks
- **Concurrency**: Adjust worker concurrency based on server resources
- **Queues**: Use separate queues for different task types

## Security

- Tasks run with the same permissions as the Django application
- Sensitive data should be handled carefully in tasks
- Use proper authentication for external service calls
- Monitor task execution for security issues