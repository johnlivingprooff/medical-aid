"""
Real-time notification system for provider communications and claim updates.
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
import json
import logging

from accounts.models import ProviderNetworkMembership

User = get_user_model()
logger = logging.getLogger(__name__)


class NotificationType(models.TextChoices):
    """Types of notifications that can be sent."""

    CLAIM_STATUS_UPDATE = 'CLAIM_STATUS_UPDATE', 'Claim Status Update'
    CREDENTIALING_UPDATE = 'CREDENTIALING_UPDATE', 'Credentialing Update'
    DOCUMENT_REVIEWED = 'DOCUMENT_REVIEWED', 'Document Reviewed'
    MEMBERSHIP_EXPIRING = 'MEMBERSHIP_EXPIRING', 'Membership Expiring'
    PAYMENT_PROCESSED = 'PAYMENT_PROCESSED', 'Payment Processed'
    SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE', 'System Maintenance'
    GENERAL_ANNOUNCEMENT = 'GENERAL_ANNOUNCEMENT', 'General Announcement'


class NotificationChannel(models.TextChoices):
    """Channels through which notifications can be delivered."""

    EMAIL = 'EMAIL', 'Email'
    IN_APP = 'IN_APP', 'In-App Notification'
    SMS = 'SMS', 'SMS'
    PUSH = 'PUSH', 'Push Notification'


class NotificationTemplate(models.Model):
    """Templates for different types of notifications."""

    name = models.CharField(max_length=100, unique=True)
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    subject_template = models.CharField(max_length=255, blank=True, help_text='Email subject template')
    body_template = models.TextField(help_text='Notification body template')
    html_template = models.TextField(blank=True, help_text='HTML email template')

    # Template variables (JSON schema)
    template_variables = models.JSONField(default=dict, help_text='Available template variables')

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['notification_type', 'channel']

    def __str__(self):
        return f"{self.name} ({self.get_channel_display()})"

    def render_subject(self, context):
        """Render the subject template with context."""
        if not self.subject_template:
            return ""
        return self.subject_template.format(**context)

    def render_body(self, context):
        """Render the body template with context."""
        return self.body_template.format(**context)

    def render_html(self, context):
        """Render the HTML template with context."""
        if not self.html_template:
            return self.render_body(context)
        return self.html_template.format(**context)


class Notification(models.Model):
    """Individual notification instances."""

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT = 'SENT', 'Sent'
        DELIVERED = 'DELIVERED', 'Delivered'
        FAILED = 'FAILED', 'Failed'
        READ = 'READ', 'Read'

    # Recipients
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    recipient_email = models.EmailField(blank=True)  # For external recipients

    # Notification content
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    html_message = models.TextField(blank=True)

    # Metadata
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices, default=NotificationChannel.IN_APP)

    # Status and tracking
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)

    # Related objects (optional)
    related_claim_id = models.IntegerField(null=True, blank=True)
    related_membership_id = models.IntegerField(null=True, blank=True)
    related_document_id = models.IntegerField(null=True, blank=True)

    # Additional data
    metadata = models.JSONField(default=dict, help_text='Additional notification data')
    template_used = models.ForeignKey(NotificationTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, help_text='For scheduled notifications')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'status', 'created_at']),
            models.Index(fields=['notification_type', 'status']),
            models.Index(fields=['scheduled_for', 'status']),
        ]

    def __str__(self):
        return f"{self.notification_type} to {self.recipient.username}"

    def mark_as_sent(self):
        """Mark notification as sent."""
        self.status = self.Status.SENT
        self.sent_at = timezone.now()
        self.save(update_fields=['status', 'sent_at'])

    def mark_as_delivered(self):
        """Mark notification as delivered."""
        self.status = self.Status.DELIVERED
        self.delivered_at = timezone.now()
        self.save(update_fields=['status', 'delivered_at'])

    def mark_as_read(self):
        """Mark notification as read."""
        self.status = self.Status.READ
        self.read_at = timezone.now()
        self.save(update_fields=['status', 'read_at'])

    def mark_as_failed(self, reason=""):
        """Mark notification as failed."""
        self.status = self.Status.FAILED
        self.failed_at = timezone.now()
        self.failure_reason = reason
        self.save(update_fields=['status', 'failed_at', 'failure_reason'])

    def is_overdue(self):
        """Check if scheduled notification is overdue."""
        if not self.scheduled_for:
            return False
        return timezone.now() > self.scheduled_for

    def send(self):
        """Send the notification through the appropriate channel."""
        try:
            if self.channel == NotificationChannel.EMAIL:
                self._send_email()
            elif self.channel == NotificationChannel.SMS:
                self._send_sms()
            elif self.channel == NotificationChannel.PUSH:
                self._send_push()
            # IN_APP notifications are handled by the frontend

            self.mark_as_sent()
            return True

        except Exception as e:
            logger.error(f"Failed to send notification {self.id}: {str(e)}")
            self.mark_as_failed(str(e))
            return False

    def _send_email(self):
        """Send notification via email."""
        recipient_email = self.recipient_email or self.recipient.email

        if not recipient_email:
            raise ValueError("No email address available for recipient")

        subject = self.title
        body = self.message
        html_body = self.html_message or self.message

        send_mail(
            subject=subject,
            message=body,
            html_message=html_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False
        )

    def _send_sms(self):
        """Send notification via SMS (placeholder implementation)."""
        # This would integrate with an SMS service like Twilio, AWS SNS, etc.
        logger.info(f"SMS notification would be sent to {self.recipient.username}: {self.message}")
        # Implementation would depend on chosen SMS provider

    def _send_push(self):
        """Send push notification (placeholder implementation)."""
        # This would integrate with push notification services
        logger.info(f"Push notification would be sent to {self.recipient.username}: {self.title}")
        # Implementation would depend on chosen push service


class NotificationPreference(models.Model):
    """User preferences for notification delivery."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')

    # Channel preferences
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    push_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)

    # Notification type preferences
    claim_updates_enabled = models.BooleanField(default=True)
    credentialing_updates_enabled = models.BooleanField(default=True)
    payment_updates_enabled = models.BooleanField(default=True)
    system_announcements_enabled = models.BooleanField(default=True)

    # Quiet hours
    quiet_hours_start = models.TimeField(null=True, blank=True, help_text='Start of quiet hours (HH:MM)')
    quiet_hours_end = models.TimeField(null=True, blank=True, help_text='End of quiet hours (HH:MM)')

    # Advanced settings
    digest_frequency = models.CharField(
        max_length=20,
        choices=[
            ('NONE', 'No Digest'),
            ('DAILY', 'Daily'),
            ('WEEKLY', 'Weekly'),
        ],
        default='NONE',
        help_text='How often to send notification digests'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences for {self.user.username}"

    def can_receive_notification(self, notification_type, channel):
        """Check if user can receive a notification of given type and channel."""
        # Check if channel is enabled
        channel_enabled = getattr(self, f"{channel.lower()}_enabled", True)
        if not channel_enabled:
            return False

        # Check if notification type is enabled
        type_enabled_map = {
            NotificationType.CLAIM_STATUS_UPDATE: self.claim_updates_enabled,
            NotificationType.CREDENTIALING_UPDATE: self.credentialing_updates_enabled,
            NotificationType.PAYMENT_PROCESSED: self.payment_updates_enabled,
            NotificationType.SYSTEM_MAINTENANCE: self.system_announcements_enabled,
            NotificationType.GENERAL_ANNOUNCEMENT: self.system_announcements_enabled,
        }

        type_enabled = type_enabled_map.get(notification_type, True)
        if not type_enabled:
            return False

        # Check quiet hours
        if self.quiet_hours_start and self.quiet_hours_end:
            now = timezone.now().time()
            if self.quiet_hours_start <= self.quiet_hours_end:
                # Same day range
                if self.quiet_hours_start <= now <= self.quiet_hours_end:
                    return False
            else:
                # Overnight range
                if now >= self.quiet_hours_start or now <= self.quiet_hours_end:
                    return False

        return True


class NotificationLog(models.Model):
    """Log of all notification activities for auditing."""

    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name='logs')
    action = models.CharField(max_length=50)  # 'CREATED', 'SENT', 'DELIVERED', 'READ', 'FAILED'
    message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} for notification {self.notification.id}"