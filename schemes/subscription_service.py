"""
Subscription management services for the medical aid system.
Handles subscription creation, updates, billing, and benefit access control.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Tuple, Dict, Any
from django.utils import timezone
from django.db import transaction

from .models import SubscriptionTier, MemberSubscription, BenefitCategory
from accounts.notification_service import NotificationService
from accounts.models_notifications import NotificationType
from claims.models import Patient


class SubscriptionService:
    """Service class for managing subscriptions and related operations."""

    @staticmethod
    def create_subscription(
        patient: Patient,
        tier: SubscriptionTier,
        subscription_type: str = 'MONTHLY',
        start_date: Optional[date] = None
    ) -> MemberSubscription:
        """
        Create a new subscription for a patient.

        Args:
            patient: The patient to create subscription for
            tier: The subscription tier
            subscription_type: 'MONTHLY' or 'YEARLY'
            start_date: Start date for subscription (defaults to today)

        Returns:
            The created MemberSubscription instance
        """
        if start_date is None:
            start_date = timezone.now().date()

        # Calculate end date based on subscription type
        if subscription_type == 'YEARLY':
            end_date = start_date + timedelta(days=365)
        else:
            end_date = start_date + timedelta(days=30)

        # Calculate next payment date
        next_payment_date = start_date

        with transaction.atomic():
            subscription = MemberSubscription.objects.create(
                patient=patient,
                tier=tier,
                subscription_type=subscription_type,
                start_date=start_date,
                end_date=end_date,
                next_payment_date=next_payment_date
            )

        # Send welcome/onboarding email notification to the member
        try:
            svc = NotificationService()
            user = getattr(patient, 'user', None)
            if user:
                svc.create_notification(
                    recipient=user,
                    notification_type=NotificationType.WELCOME_MEMBER,
                    title="Welcome to your medical aid subscription",
                    message=(
                        f"Hi {getattr(user, 'username', 'Member')},\n\n"
                        f"Your {tier.name} subscription is now active from {start_date} to {end_date}.\n"
                        f"You're all set to start using your benefits.\n\n"
                        f"If you have any questions, reply to this email or contact support."
                    ),
                    priority='HIGH',
                    metadata={
                        'subscription_id': subscription.id,
                        'tier': tier.name,
                        'start_date': start_date.isoformat(),
                        'end_date': end_date.isoformat(),
                    }
                )
        except Exception:
            # Avoid raising errors in business flow due to notification failures
            pass

        return subscription

    @staticmethod
    def upgrade_subscription(
        subscription: MemberSubscription,
        new_tier: SubscriptionTier
    ) -> MemberSubscription:
        """
        Upgrade a subscription to a new tier.

        Args:
            subscription: Current subscription
            new_tier: New tier to upgrade to

        Returns:
            Updated subscription
        """
        with transaction.atomic():
            subscription.tier = new_tier
            subscription.save()
            # Reset usage counters for new tier
            subscription.claims_this_month = 0
            subscription.coverage_used_this_year = Decimal('0.00')
            subscription.save()

        return subscription

    @staticmethod
    def check_subscription_access(
        patient: Patient,
        benefit_category: Optional[BenefitCategory] = None
    ) -> Tuple[bool, str]:
        """
        Check if a patient has access to benefits based on their subscription.

        Args:
            patient: The patient to check
            benefit_category: Specific benefit category to check (optional)

        Returns:
            Tuple of (has_access, reason)
        """
        try:
            subscription = patient.subscription
        except MemberSubscription.DoesNotExist:
            return False, "No active subscription found"

        if not subscription.is_active():
            return False, f"Subscription is {subscription.status.lower()}"

        if benefit_category:
            # Check if the benefit category is included in the subscription tier
            if not subscription.tier.benefit_categories.filter(id=benefit_category.id).exists():
                return False, f"Benefit category '{benefit_category.name}' not included in {subscription.tier.name} tier"

        return True, "Access granted"

    @staticmethod
    def calculate_subscription_price(
        tier: SubscriptionTier,
        subscription_type: str = 'MONTHLY',
        discount_percentage: float = 0
    ) -> Decimal:
        """
        Calculate the price for a subscription with optional discount.

        Args:
            tier: The subscription tier
            subscription_type: 'MONTHLY' or 'YEARLY'
            discount_percentage: Discount percentage (0-100)

        Returns:
            Calculated price
        """
        base_price = tier.get_price(subscription_type)
        discount_amount = base_price * Decimal(str(discount_percentage / 100))
        return base_price - discount_amount

    @staticmethod
    def get_subscription_usage(subscription: MemberSubscription) -> Dict[str, Any]:
        """
        Get usage statistics for a subscription.

        Args:
            subscription: The subscription to analyze

        Returns:
            Dictionary with usage statistics
        """
        # Recalculate usage to ensure accuracy
        subscription.recalculate_usage()
        
        return {
            'claims_this_month': subscription.claims_this_month,
            'max_claims_per_month': subscription.tier.max_claims_per_month,
            'coverage_used_this_year': float(subscription.coverage_used_this_year),
            'max_coverage_per_year': float(subscription.tier.max_coverage_per_year) if subscription.tier.max_coverage_per_year else None,
            'remaining_coverage': float(subscription.get_remaining_coverage()) if subscription.get_remaining_coverage() is not None else None,
            'subscription_status': subscription.status,
            'is_active': subscription.is_active(),
            'tier_name': subscription.tier.name,
            'monthly_price': float(subscription.tier.monthly_price),
            'yearly_price': float(subscription.tier.yearly_price)
        }

    @staticmethod
    def process_monthly_reset():
        """
        Reset monthly usage counters for all active subscriptions.
        This should be run monthly via a scheduled task.
        """
        active_subscriptions = MemberSubscription.objects.filter(
            status=MemberSubscription.SubscriptionStatus.ACTIVE
        )

        with transaction.atomic():
            for subscription in active_subscriptions:
                subscription.claims_this_month = 0
                subscription.save()

    @staticmethod
    def process_yearly_reset():
        """
        Reset yearly usage counters for all active subscriptions.
        This should be run yearly via a scheduled task.
        """
        active_subscriptions = MemberSubscription.objects.filter(
            status=MemberSubscription.SubscriptionStatus.ACTIVE
        )

        with transaction.atomic():
            for subscription in active_subscriptions:
                subscription.coverage_used_this_year = Decimal('0.00')
                subscription.save()

    @staticmethod
    def get_available_tiers(scheme_id: int) -> list:
        """
        Get all available subscription tiers for a scheme.

        Args:
            scheme_id: The scheme ID

        Returns:
            List of available tiers
        """
        return list(
            SubscriptionTier.objects.filter(
                scheme_id=scheme_id,
                is_active=True
            ).order_by('sort_order', 'monthly_price')
        )

    @staticmethod
    def validate_subscription_data(data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validate subscription creation/update data.

        Args:
            data: Subscription data to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        required_fields = ['patient', 'tier']
        for field in required_fields:
            if field not in data:
                return False, f"Missing required field: {field}"

        # Check if patient already has a subscription
        patient_id = data.get('patient')
        if isinstance(patient_id, Patient):
            patient_id = patient_id.id

        existing_subscription = MemberSubscription.objects.filter(
            patient_id=patient_id,
            status__in=['ACTIVE', 'SUSPENDED']
        ).exists()

        if existing_subscription:
            return False, "Patient already has an active subscription"

        return True, "Data is valid"


class SubscriptionAnalytics:
    """Analytics service for subscription data."""

    @staticmethod
    def get_subscription_metrics(scheme_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get subscription metrics for analysis.

        Args:
            scheme_id: Optional scheme ID to filter by

        Returns:
            Dictionary with subscription metrics
        """
        queryset = MemberSubscription.objects.all()
        if scheme_id:
            queryset = queryset.filter(tier__scheme_id=scheme_id)

        total_subscriptions = queryset.count()
        active_subscriptions = queryset.filter(status='ACTIVE').count()
        suspended_subscriptions = queryset.filter(status='SUSPENDED').count()
        cancelled_subscriptions = queryset.filter(status='CANCELLED').count()

        # Tier distribution
        tier_distribution = {}
        for tier in SubscriptionTier.objects.all():
            if scheme_id and tier.scheme_id != scheme_id:
                continue
            count = queryset.filter(tier=tier).count()
            if count > 0:
                tier_distribution[tier.name] = count

        return {
            'total_subscriptions': total_subscriptions,
            'active_subscriptions': active_subscriptions,
            'suspended_subscriptions': suspended_subscriptions,
            'cancelled_subscriptions': cancelled_subscriptions,
            'active_percentage': (active_subscriptions / total_subscriptions * 100) if total_subscriptions > 0 else 0,
            'tier_distribution': tier_distribution
        }