"""
Notification service for managing real-time provider communications.
"""

from django.db import models, transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import logging
from datetime import datetime, time
from typing import Dict, List, Optional, Union, Any

from accounts.models import ProviderNetworkMembership
from claims.models import Claim
from .models_notifications import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationLog, NotificationType, NotificationChannel
)

User = get_user_model()
logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing notifications and communications."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def create_notification(self, recipient: Any, notification_type: str,
                          title: str, message: str, **kwargs) -> Notification:
        """
        Create a new notification.

        Args:
            recipient: User to receive the notification
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            **kwargs: Additional notification data
        """
        # Get user preferences
        preferences = self._get_user_preferences(recipient)

        # Determine best channel based on preferences and notification type
        channel = self._determine_channel(notification_type, preferences)

        # Check if user can receive this notification
        if not preferences.can_receive_notification(notification_type, channel):
            self.logger.info(f"Notification blocked by user preferences: {recipient.username}")
            return None

        # Prepare template context and render from template when available
        template_context = kwargs.get('template_context', {})
        # Seed context with common defaults
        context = {
            **template_context,
            **kwargs.get('metadata', {}),
            'recipient_username': getattr(recipient, 'username', ''),
            'recipient_first_name': getattr(recipient, 'first_name', '') or getattr(recipient, 'username', ''),
            'recipient_full_name': getattr(recipient, 'get_full_name', lambda: '')() if hasattr(recipient, 'get_full_name') else str(getattr(recipient, 'username', '')),
        }

        rendered_title, rendered_message, rendered_html, used_template = self._render_from_template(
            notification_type=notification_type,
            channel=channel,
            fallback_title=title,
            fallback_message=message,
            fallback_html=kwargs.get('html_message', ''),
            context=context,
        )

        # Create notification
        notification = Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=rendered_title,
            message=rendered_message,
            channel=channel,
            priority=kwargs.get('priority', 'MEDIUM'),
            related_claim_id=kwargs.get('claim_id'),
            related_membership_id=kwargs.get('membership_id'),
            related_document_id=kwargs.get('document_id'),
            metadata=kwargs.get('metadata', {}),
            scheduled_for=kwargs.get('scheduled_for'),
            html_message=rendered_html,
            template_used=used_template,
        )

        # Log creation
        NotificationLog.objects.create(
            notification=notification,
            action='CREATED',
            message=f'Notification created for {recipient.username}',
            metadata={'notification_type': notification_type}
        )

        # Send immediately if not scheduled
        if not notification.scheduled_for:
            self._send_notification(notification)

        return notification

    def _render_from_template(self, notification_type: str, channel: str,
                               fallback_title: str, fallback_message: str, fallback_html: str,
                               context: Dict[str, Any]):
        """Render title/body/html using active NotificationTemplate if available.

        Returns tuple: (title, message, html, template_or_None)
        """
        try:
            template = NotificationTemplate.objects.filter(
                notification_type=notification_type,
                channel=channel,
                is_active=True
            ).first()

            if not template:
                return fallback_title, fallback_message, (fallback_html or fallback_message), None

            # Render pieces with safe fallbacks
            title = template.render_subject(context) or fallback_title
            body = template.render_body(context) or fallback_message
            html = template.render_html(context) or fallback_html or body
            return title, body, html, template
        except Exception as e:
            # Log and fallback to provided values
            self.logger.warning(f"Template render failed for {notification_type}: {e}")
            return fallback_title, fallback_message, (fallback_html or fallback_message), None

    def _get_user_preferences(self, user: Any) -> NotificationPreference:
        """Get or create notification preferences for a user."""
        preferences, created = NotificationPreference.objects.get_or_create(
            user=user,
            defaults={
                'email_enabled': True,
                'sms_enabled': False,
                'push_enabled': True,
                'in_app_enabled': True,
                'claim_updates_enabled': True,
                'credentialing_updates_enabled': True,
                'payment_updates_enabled': True,
                'system_announcements_enabled': True,
                'member_messages_enabled': True,
                'subscription_reminders_enabled': True,
            }
        )
        return preferences

    def _determine_channel(self, notification_type: str, preferences: NotificationPreference) -> str:
        """Determine the best channel for a notification type."""
        # Priority order: EMAIL > PUSH > SMS > IN_APP

        if notification_type in [NotificationType.CLAIM_STATUS_UPDATE,
                               NotificationType.CREDENTIALING_UPDATE,
                               NotificationType.MEMBERSHIP_EXPIRING,
                               NotificationType.WELCOME_MEMBER,
                               NotificationType.SUBSCRIPTION_RENEWAL_REMINDER,
                               NotificationType.MEMBER_MESSAGE]:
            # Important notifications go to email first
            if preferences.email_enabled:
                return NotificationChannel.EMAIL
            elif preferences.push_enabled:
                return NotificationChannel.PUSH
            elif preferences.sms_enabled:
                return NotificationChannel.SMS

        elif notification_type == NotificationType.SYSTEM_MAINTENANCE:
            # System notifications go to email
            if preferences.email_enabled:
                return NotificationChannel.EMAIL

        # Default to in-app for other types
        return NotificationChannel.IN_APP

    def _send_notification(self, notification: Notification):
        """Send a notification through its designated channel."""
        try:
            success = notification.send()
            if success:
                NotificationLog.objects.create(
                    notification=notification,
                    action='SENT',
                    message=f'Notification sent via {notification.channel}',
                    metadata={'channel': notification.channel}
                )
            else:
                NotificationLog.objects.create(
                    notification=notification,
                    action='FAILED',
                    message='Failed to send notification',
                    metadata={'channel': notification.channel}
                )
        except Exception as e:
            self.logger.error(f"Error sending notification {notification.id}: {str(e)}")
            NotificationLog.objects.create(
                notification=notification,
                action='FAILED',
                message=f'Send error: {str(e)}',
                metadata={'error': str(e)}
            )

    def notify_claim_status_update(self, claim, old_status: str, new_status: str):
        """Notify provider of claim status change."""
        provider = claim.provider

        title = f"Claim Status Update - {claim.claim_number}"
        message = f"""
        Your claim {claim.claim_number} has been updated.

        Previous Status: {old_status}
        New Status: {new_status}
        Service Date: {claim.date_of_service}
        Amount: R{claim.cost}

        {"Please review the claim details for any required actions." if new_status == "REJECTED" else "Thank you for your patience."}
        """

        return self.create_notification(
            recipient=provider,
            notification_type=NotificationType.CLAIM_STATUS_UPDATE,
            title=title,
            message=message.strip(),
            priority='HIGH' if new_status in ['APPROVED', 'REJECTED'] else 'MEDIUM',
            claim_id=claim.id,
            metadata={
                'claim_number': claim.claim_number,
                'old_status': old_status,
                'new_status': new_status,
                'amount': str(claim.cost),
                'service_date': claim.date_of_service.isoformat()
            }
        )

    def notify_credentialing_update(self, membership: ProviderNetworkMembership,
                                  old_status: str, new_status: str):
        """Notify provider of credentialing status change."""
        provider = membership.provider

        title = f"Credentialing Status Update - {membership.scheme.name}"
        message = f"""
        Your credentialing status for {membership.scheme.name} has been updated.

        Previous Status: {old_status}
        New Status: {new_status}
        Effective From: {membership.effective_from}

        {"Your membership is now active and you can start submitting claims." if new_status == "APPROVED" else
         "Please review and submit any required documents." if new_status == "PENDING" else
         "Please contact support regarding your credentialing status."}
        """

        return self.create_notification(
            recipient=provider,
            notification_type=NotificationType.CREDENTIALING_UPDATE,
            title=title,
            message=message.strip(),
            priority='HIGH' if new_status == 'APPROVED' else 'MEDIUM',
            membership_id=membership.id,
            metadata={
                'scheme_name': membership.scheme.name,
                'old_status': old_status,
                'new_status': new_status,
                'effective_from': membership.effective_from.isoformat() if membership.effective_from else None
            }
        )

    def notify_membership_expiring(self, membership: ProviderNetworkMembership, days_until_expiry: int):
        """Notify provider of upcoming membership expiry."""
        provider = membership.provider

        title = f"Membership Expiring Soon - {membership.scheme.name}"
        message = f"""
        Your membership with {membership.scheme.name} is expiring soon.

        Days Until Expiry: {days_until_expiry}
        Expiry Date: {membership.effective_to}
        Scheme: {membership.scheme.name}

        Please renew your membership to continue providing services.
        """

        priority = 'URGENT' if days_until_expiry <= 7 else 'HIGH' if days_until_expiry <= 30 else 'MEDIUM'

        return self.create_notification(
            recipient=provider,
            notification_type=NotificationType.MEMBERSHIP_EXPIRING,
            title=title,
            message=message.strip(),
            priority=priority,
            membership_id=membership.id,
            metadata={
                'scheme_name': membership.scheme.name,
                'days_until_expiry': days_until_expiry,
                'expiry_date': membership.effective_to.isoformat() if membership.effective_to else None
            }
        )

    def notify_document_reviewed(self, document, review_status: str, reviewer_notes: str = ""):
        """Notify provider of document review completion."""
        provider = document.membership.provider

        title = f"Document Review Complete - {document.get_doc_type_display()}"
        message = f"""
        Your {document.get_doc_type_display()} document has been reviewed.

        Review Status: {review_status}
        Document: {document.file.name}
        Review Date: {timezone.now().date()}

        {f"Reviewer Notes: {reviewer_notes}" if reviewer_notes else ""}
        """

        return self.create_notification(
            recipient=provider,
            notification_type=NotificationType.DOCUMENT_REVIEWED,
            title=title,
            message=message.strip(),
            priority='HIGH' if review_status == 'REJECTED' else 'MEDIUM',
            document_id=document.id,
            metadata={
                'document_type': document.doc_type,
                'review_status': review_status,
                'reviewer_notes': reviewer_notes,
                'file_name': document.file.name
            }
        )

    def send_bulk_notification(self, recipients: List[Any], notification_type: str,
                             title: str, message: str, **kwargs) -> List[Notification]:
        """Send the same notification to multiple recipients."""
        notifications = []

        for recipient in recipients:
            notification = self.create_notification(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                **kwargs
            )
            if notification:
                notifications.append(notification)

        return notifications

    def send_system_announcement(self, title: str, message: str,
                               target_roles: List[str] = None) -> List[Notification]:
        """Send system-wide announcement to specified user roles."""
        if target_roles is None:
            target_roles = ['ADMIN', 'PROVIDER', 'PATIENT']

        recipients = User.objects.filter(role__in=target_roles)

        return self.send_bulk_notification(
            recipients=list(recipients),
            notification_type=NotificationType.SYSTEM_MAINTENANCE,
            title=title,
            message=message,
            priority='HIGH',
            metadata={'announcement_type': 'system_wide'}
        )

    def get_user_notifications(self, user: Any, status: str = None,
                             notification_type: str = None, limit: int = 50) -> List[Notification]:
        """Get notifications for a user with optional filtering."""
        queryset = Notification.objects.filter(recipient=user)

        if status:
            queryset = queryset.filter(status=status)

        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        return list(queryset.order_by('-created_at')[:limit])

    def mark_notifications_read(self, user: Any, notification_ids: List[int]) -> int:
        """Mark multiple notifications as read."""
        updated = Notification.objects.filter(
            recipient=user,
            id__in=notification_ids,
            status__in=['SENT', 'DELIVERED']
        ).update(
            status=Notification.Status.READ,
            read_at=timezone.now()
        )

        # Log the read actions
        for notification_id in notification_ids:
            try:
                notification = Notification.objects.get(id=notification_id)
                NotificationLog.objects.create(
                    notification=notification,
                    action='READ',
                    message=f'Marked as read by {user.username}'
                )
            except Notification.DoesNotExist:
                continue

        return updated

    def get_notification_stats(self, user: Any = None) -> Dict:
        """Get notification statistics."""
        queryset = Notification.objects.all()

        if user:
            queryset = queryset.filter(recipient=user)

        stats = queryset.aggregate(
            total=models.Count('id'),
            unread=models.Count('id', filter=models.Q(status__in=['SENT', 'DELIVERED'])),
            read=models.Count('id', filter=models.Q(status='READ')),
            failed=models.Count('id', filter=models.Q(status='FAILED')),
        )

        # Type breakdown
        type_stats = queryset.values('notification_type').annotate(
            count=models.Count('id')
        ).order_by('-count')

        return {
            'total': stats['total'],
            'unread': stats['unread'],
            'read': stats['read'],
            'failed': stats['failed'],
            'by_type': list(type_stats)
        }

    def process_scheduled_notifications(self):
        """Process notifications that are scheduled for sending."""
        now = timezone.now()

        # Get overdue scheduled notifications
        scheduled_notifications = Notification.objects.filter(
            status='PENDING',
            scheduled_for__lte=now
        )

        sent_count = 0
        for notification in scheduled_notifications:
            self._send_notification(notification)
            sent_count += 1

        self.logger.info(f"Processed {sent_count} scheduled notifications")
        return sent_count

    def cleanup_old_notifications(self, days_old: int = 90):
        """Clean up old read notifications."""
        cutoff_date = timezone.now() - timezone.timedelta(days=days_old)

        deleted_count = Notification.objects.filter(
            status='READ',
            read_at__lte=cutoff_date
        ).delete()

        self.logger.info(f"Cleaned up {deleted_count} old notifications")
        return deleted_count

    # Convenience methods for common member-facing notifications
    def send_welcome_member(self, user: Any, tier_name: str, start_date: str, end_date: str):
        """Send a welcome email to a new member."""
        return self.create_notification(
            recipient=user,
            notification_type=NotificationType.WELCOME_MEMBER,
            title="Welcome to your medical aid subscription",
            message=(
                f"Hi {getattr(user, 'username', 'Member')},\n\n"
                f"Your {tier_name} subscription is now active from {start_date} to {end_date}.\n"
                f"You're all set to start using your benefits.\n\n"
                f"If you have any questions, reply to this email or contact support."
            ),
            priority='HIGH',
            metadata={
                'tier': tier_name,
                'start_date': start_date,
                'end_date': end_date,
            }
        )

    def send_member_message_notification(self, member_user: Any, sender_name: str, subject: str, preview: str, member_message_id: int, patient_id: int):
        """Notify a member that they have received a message."""
        title = subject or "New message from your medical aid"
        return self.create_notification(
            recipient=member_user,
            notification_type=NotificationType.MEMBER_MESSAGE,
            title=title,
            message=f"You have a new message from {sender_name}:\n\n{preview}",
            priority='HIGH',
            metadata={
                'member_message_id': member_message_id,
                'patient_id': patient_id,
            }
        )