from celery import shared_task
from django.core.cache import cache
from django.db import connection
from django.core.mail import send_mail
from django.conf import settings
from datetime import datetime, timedelta
from django.db import models
import logging

logger = logging.getLogger(__name__)

@shared_task
def cache_warmup():
    """
    Warm up cache with frequently accessed data
    """
    try:
        # Clear any problematic cache data first
        from django.core.cache import cache
        try:
            cache.clear()
        except:
            pass  # Ignore cache clear errors

        # Cache system settings (no is_active filter since field doesn't exist)
        from core.models import SystemSettings
        settings = SystemSettings.objects.all()
        for setting in settings:
            cache_key = f"system_setting_{setting.key}"
            cache.set(cache_key, setting.value, timeout=3600)  # 1 hour

        # Cache common lookups
        from schemes.models import BenefitType, SubscriptionTier
        benefit_types = list(BenefitType.objects.values('id', 'name'))
        cache.set('benefit_types', benefit_types, timeout=3600)

        subscription_tiers = list(SubscriptionTier.objects.values('id', 'name', 'monthly_price', 'yearly_price'))
        cache.set('subscription_tiers', subscription_tiers, timeout=3600)

        logger.info("Cache warmup completed successfully")
        return "Cache warmup completed"

    except Exception as e:
        logger.error(f"Cache warmup failed: {str(e)}")
        return f"Cache warmup failed: {str(e)}"

@shared_task
def cleanup_expired_cache():
    """
    Clean up expired cache entries
    """
    try:
        # This is handled automatically by Redis, but we can log cache stats
        cache_stats = cache.get('cache_stats', {})
        logger.info(f"Cache cleanup completed. Current stats: {cache_stats}")
        return "Cache cleanup completed"

    except Exception as e:
        logger.error(f"Cache cleanup failed: {str(e)}")
        return f"Cache cleanup failed: {str(e)}"

@shared_task
def generate_daily_reports():
    """
    Generate daily summary reports
    """
    try:
        from claims.models import Claim
        from django.db.models import Count, Sum
        from datetime import date

        today = date.today()
        yesterday = today - timedelta(days=1)

        # Generate claims summary
        claims_summary = Claim.objects.filter(
            created_at__date=yesterday
        ).aggregate(
            total_claims=Count('id'),
            total_amount=Sum('cost'),
            approved_count=Count('id', filter=models.Q(status='APPROVED')),
            pending_count=Count('id', filter=models.Q(status='PENDING')),
            rejected_count=Count('id', filter=models.Q(status='REJECTED'))
        )

        # Cache the report
        cache_key = f"daily_report_{yesterday}"
        cache.set(cache_key, claims_summary, timeout=86400)  # 24 hours

        # Send email notification to admins
        if settings.DEBUG is False:  # Only send in production
            send_mail(
                subject=f"Daily Report - {yesterday}",
                message=f"""
Daily Claims Summary for {yesterday}:

Total Claims: {claims_summary['total_claims']}
Total Amount: ${claims_summary['total_amount'] or 0:.2f}
Approved: {claims_summary['approved_count']}
Pending: {claims_summary['pending_count']}
Rejected: {claims_summary['rejected_count']}
                """,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.ADMIN_EMAIL],
                fail_silently=True
            )

        logger.info(f"Daily report generated for {yesterday}")
        return f"Daily report generated for {yesterday}"

    except Exception as e:
        logger.error(f"Daily report generation failed: {str(e)}")
        return f"Daily report generation failed: {str(e)}"

@shared_task
def health_check():
    """
    Perform system health checks
    """
    try:
        health_status = {
            'database': False,
            'cache': False,
            'timestamp': datetime.now().isoformat()
        }

        # Check database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            health_status['database'] = True

        # Check cache connection
        try:
            cache.set('health_check', 'ok', timeout=10)
            cached_value = cache.get('health_check')
            health_status['cache'] = (cached_value == 'ok')
        except Exception as e:
            health_status['cache'] = False
            health_status['cache_error'] = str(e)

        # Cache health status
        try:
            cache.set('system_health', health_status, timeout=300)  # 5 minutes
        except:
            pass  # Ignore cache errors

        all_healthy = all(health_status.values())
        status_message = "All systems healthy" if all_healthy else "Some systems unhealthy"

        logger.info(f"Health check completed: {status_message}")
        return health_status

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {'error': str(e), 'timestamp': datetime.now().isoformat()}

@shared_task
def process_bulk_claims(claim_ids):
    """
    Process multiple claims in bulk
    Useful for batch operations
    """
    try:
        from claims.models import Claim
        from claims.services import validate_and_process_claim

        processed = 0
        successful = 0
        failed = 0

        for claim_id in claim_ids:
            try:
                claim = Claim.objects.get(id=claim_id)
                is_valid, amount, message = validate_and_process_claim(claim)

                if is_valid:
                    successful += 1
                else:
                    failed += 1

                processed += 1

            except Claim.DoesNotExist:
                failed += 1
                processed += 1
                continue

        result = {
            'total_processed': processed,
            'successful': successful,
            'failed': failed,
            'timestamp': datetime.now().isoformat()
        }

        logger.info(f"Bulk claims processing completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Bulk claims processing failed: {str(e)}")
        return {'error': str(e), 'timestamp': datetime.now().isoformat()}

@shared_task
def send_notification_email(recipient_email, subject, message):
    """
    Send notification emails asynchronously
    """
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False
        )

        logger.info(f"Notification email sent to {recipient_email}")
        return f"Email sent to {recipient_email}"

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}")
        return f"Failed to send email: {str(e)}"