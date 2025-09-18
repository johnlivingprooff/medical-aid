from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from silk.models import Request
import psutil
import os


@staff_member_required
def system_monitoring_dashboard(request):
    """Comprehensive system monitoring dashboard"""

    # Get recent Silk requests (last hour)
    last_hour = timezone.now() - timedelta(hours=1)
    recent_requests = Request.objects.filter(
        start_time__gte=last_hour
    ).order_by('-start_time')[:50]

    # Performance metrics
    total_requests = Request.objects.filter(start_time__gte=last_hour).count()
    slow_requests = Request.objects.filter(
        start_time__gte=last_hour,
        time_taken__gte=1000  # Requests taking 1+ second
    ).count()

    # Database connection info
    db_connections = len(connection.queries) if hasattr(connection, 'queries') else 0

    # Cache statistics
    cache_stats = {
        'cache_backend': 'DatabaseCache',  # Default fallback
        'cache_hits': 0,
        'cache_misses': 0,
    }

    # System resource usage
    system_stats = {
        'cpu_percent': psutil.cpu_percent(interval=1),
        'memory_percent': psutil.virtual_memory().percent,
        'disk_usage': psutil.disk_usage('/').percent,
        'process_count': len(psutil.pids()),
    }

    # Database performance
    db_stats = {
        'connection_count': db_connections,
        'query_count': len(connection.queries) if hasattr(connection, 'queries') else 0,
    }

    # Celery task statistics (if available)
    celery_stats = {
        'active_tasks': 0,
        'scheduled_tasks': 0,
        'failed_tasks': 0,
    }

    try:
        from django_celery_results.models import TaskResult
        from django_celery_beat.models import PeriodicTask

        last_24h = timezone.now() - timedelta(hours=24)
        celery_stats['active_tasks'] = PeriodicTask.objects.filter(enabled=True).count()
        celery_stats['failed_tasks'] = TaskResult.objects.filter(
            date_created__gte=last_24h,
            status='FAILURE'
        ).count()
    except ImportError:
        pass

    context = {
        'title': 'System Monitoring Dashboard',
        'recent_requests': recent_requests,
        'total_requests': total_requests,
        'slow_requests': slow_requests,
        'slow_request_percentage': (slow_requests / total_requests * 100) if total_requests > 0 else 0,
        'cache_stats': cache_stats,
        'system_stats': system_stats,
        'db_stats': db_stats,
        'celery_stats': celery_stats,
        'last_updated': timezone.now(),
    }

    return render(request, 'admin/system_monitoring_dashboard.html', context)