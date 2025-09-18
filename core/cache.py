from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def invalidate_cache_pattern(pattern):
    """
    Invalidate cache keys matching a pattern
    Since Django's cache doesn't support pattern deletion natively,
    we'll clear specific known keys
    """
    try:
        # For database cache, we can clear all
        if 'db.DatabaseCache' in settings.CACHES['default']['BACKEND']:
            cache.clear()
            logger.info("Database cache cleared")
        else:
            # For Redis, we could use pattern deletion, but for simplicity
            # we'll clear known cache keys
            known_keys = [
                'benefit_types',
                'subscription_tiers',
                'system_health',
                'cache_stats'
            ]

            for key in known_keys:
                cache.delete(key)

            # Also clear system settings cache
            cache.delete_pattern('system_setting_*')

            logger.info(f"Cache keys invalidated for pattern: {pattern}")

    except Exception as e:
        logger.error(f"Cache invalidation failed: {str(e)}")


@receiver(post_save, sender='schemes.BenefitType')
def invalidate_benefit_type_cache(sender, instance, **kwargs):
    """Invalidate benefit types cache when BenefitType is modified"""
    cache.delete('benefit_types')
    logger.info("Benefit types cache invalidated")


@receiver(post_delete, sender='schemes.BenefitType')
def invalidate_benefit_type_cache_on_delete(sender, instance, **kwargs):
    """Invalidate benefit types cache when BenefitType is deleted"""
    cache.delete('benefit_types')
    logger.info("Benefit types cache invalidated (delete)")


@receiver(post_save, sender='schemes.SubscriptionTier')
def invalidate_subscription_tier_cache(sender, instance, **kwargs):
    """Invalidate subscription tiers cache when SubscriptionTier is modified"""
    cache.delete('subscription_tiers')
    logger.info("Subscription tiers cache invalidated")


@receiver(post_delete, sender='schemes.SubscriptionTier')
def invalidate_subscription_tier_cache_on_delete(sender, instance, **kwargs):
    """Invalidate subscription tiers cache when SubscriptionTier is deleted"""
    cache.delete('subscription_tiers')
    logger.info("Subscription tiers cache invalidated (delete)")


@receiver(post_save, sender='core.SystemSettings')
def invalidate_system_settings_cache(sender, instance, **kwargs):
    """Invalidate system settings cache when SystemSettings is modified"""
    cache_key = f"system_setting_{instance.key}"
    cache.delete(cache_key)
    logger.info(f"System setting cache invalidated: {instance.key}")


@receiver(post_delete, sender='core.SystemSettings')
def invalidate_system_settings_cache_on_delete(sender, instance, **kwargs):
    """Invalidate system settings cache when SystemSettings is deleted"""
    cache_key = f"system_setting_{instance.key}"
    cache.delete(cache_key)
    logger.info(f"System setting cache invalidated (delete): {instance.key}")


def invalidate_user_cache(user_id):
    """Invalidate user-specific cache entries"""
    try:
        cache_keys = [
            f"user_{user_id}_profile",
            f"user_{user_id}_permissions",
            f"user_{user_id}_claims"
        ]

        for key in cache_keys:
            cache.delete(key)

        logger.info(f"User cache invalidated for user {user_id}")
    except Exception as e:
        logger.error(f"User cache invalidation failed: {str(e)}")


def invalidate_claim_cache(claim_id=None, patient_id=None):
    """Invalidate claim-related cache entries"""
    try:
        cache_keys = []

        if claim_id:
            cache_keys.extend([
                f"claim_{claim_id}",
                f"claim_{claim_id}_details"
            ])

        if patient_id:
            cache_keys.extend([
                f"patient_{patient_id}_claims",
                f"patient_{patient_id}_coverage"
            ])

        # Also invalidate general claims cache
        cache_keys.append('recent_claims')
        cache_keys.append('claims_summary')

        for key in cache_keys:
            cache.delete(key)

        logger.info(f"Claim cache invalidated: claim_id={claim_id}, patient_id={patient_id}")
    except Exception as e:
        logger.error(f"Claim cache invalidation failed: {str(e)}")


def warm_cache_after_invalidation():
    """
    Warm up cache after invalidation to improve performance
    This can be called after major data changes
    """
    try:
        from core.tasks import cache_warmup
        # Run cache warmup asynchronously
        cache_warmup.delay()
        logger.info("Cache warmup scheduled after invalidation")
    except Exception as e:
        logger.error(f"Cache warmup scheduling failed: {str(e)}")


class CacheManager:
    """Utility class for cache management"""

    @staticmethod
    def get_or_set(key, value_func, timeout=300):
        """
        Get value from cache or set it if not exists
        """
        value = cache.get(key)
        if value is None:
            value = value_func()
            cache.set(key, value, timeout)
        return value

    @staticmethod
    def invalidate_pattern(pattern):
        """Invalidate cache keys matching a pattern"""
        invalidate_cache_pattern(pattern)

    @staticmethod
    def clear_all():
        """Clear all cache"""
        cache.clear()
        logger.info("All cache cleared")

    @staticmethod
    def get_cache_stats():
        """Get cache statistics"""
        try:
            # This is a simple implementation
            # In production, you might want more detailed stats
            return {
                'cache_backend': settings.CACHES['default']['BACKEND'],
                'cache_timeout': settings.CACHE_MIDDLEWARE_SECONDS,
            }
        except Exception as e:
            logger.error(f"Cache stats retrieval failed: {str(e)}")
            return {'error': str(e)}