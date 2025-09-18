"""
Session management models for enhanced security and tracking.
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class UserSession(models.Model):
    """Enhanced session tracking for security monitoring."""

    class SessionStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        EXPIRED = 'EXPIRED', 'Expired'
        TERMINATED = 'TERMINATED', 'Terminated'
        SUSPICIOUS = 'SUSPICIOUS', 'Suspicious Activity'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session = models.OneToOneField(Session, on_delete=models.CASCADE)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_info = models.JSONField(default=dict, blank=True)
    location_info = models.JSONField(default=dict, blank=True)

    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.ACTIVE
    )

    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Security tracking
    login_attempts = models.PositiveIntegerField(default=0)
    failed_mfa_attempts = models.PositiveIntegerField(default=0)
    suspicious_activities = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-last_activity']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['last_activity']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.status} - {self.ip_address}"

    def is_expired(self):
        """Check if session has expired."""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

    def terminate(self, reason="Manual termination"):
        """Terminate this session."""
        self.status = self.SessionStatus.TERMINATED
        self.suspicious_activities.append({
            'timestamp': timezone.now().isoformat(),
            'action': 'terminated',
            'reason': reason
        })
        self.save()

        # Delete the actual Django session
        try:
            self.session.delete()
        except:
            pass  # Session might already be deleted

    def mark_suspicious(self, reason, details=None):
        """Mark session as suspicious."""
        self.status = self.SessionStatus.SUSPICIOUS
        self.suspicious_activities.append({
            'timestamp': timezone.now().isoformat(),
            'action': 'marked_suspicious',
            'reason': reason,
            'details': details or {}
        })
        self.save()

    def update_activity(self):
        """Update last activity timestamp."""
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])

    @property
    def is_active(self):
        """Check if session is currently active."""
        return (
            self.status == self.SessionStatus.ACTIVE
            and not self.is_expired()
            and self.session.expire_date > timezone.now()
        )


class SessionSettings(models.Model):
    """Global session management settings."""

    # Session limits
    max_concurrent_sessions = models.PositiveIntegerField(
        default=5,
        help_text="Maximum concurrent sessions per user"
    )
    session_timeout_minutes = models.PositiveIntegerField(
        default=60,
        help_text="Session timeout in minutes"
    )

    # Security settings
    block_suspicious_ips = models.BooleanField(
        default=True,
        help_text="Block sessions from suspicious IP addresses"
    )
    require_mfa_for_new_sessions = models.BooleanField(
        default=True,
        help_text="Require MFA verification for new sessions"
    )

    # Monitoring
    enable_session_monitoring = models.BooleanField(
        default=True,
        help_text="Enable detailed session monitoring"
    )
    alert_on_suspicious_activity = models.BooleanField(
        default=True,
        help_text="Send alerts for suspicious session activity"
    )

    # Single instance settings
    class Meta:
        verbose_name = "Session Settings"
        verbose_name_plural = "Session Settings"

    def save(self, *args, **kwargs):
        # Ensure only one instance exists
        if not self.pk and SessionSettings.objects.exists():
            raise ValueError("Only one SessionSettings instance is allowed")
        return super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Get the global session settings."""
        return cls.objects.first() or cls.objects.create()


def get_user_active_sessions(user):
    """Get all active sessions for a user."""
    return UserSession.objects.filter(
        user=user,
        status=UserSession.SessionStatus.ACTIVE
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
    )


def terminate_user_sessions(user, exclude_session_key=None):
    """Terminate all sessions for a user except the specified one."""
    sessions = get_user_active_sessions(user)
    if exclude_session_key:
        sessions = sessions.exclude(session__session_key=exclude_session_key)

    terminated_count = 0
    for user_session in sessions:
        user_session.terminate("Bulk termination")
        terminated_count += 1

    return terminated_count


def cleanup_expired_sessions():
    """Clean up expired sessions and user sessions."""
    now = timezone.now()

    # Mark expired UserSessions
    expired_user_sessions = UserSession.objects.filter(
        status=UserSession.SessionStatus.ACTIVE
    ).filter(
        models.Q(expires_at__lte=now) |
        models.Q(session__expire_date__lte=now)
    )

    for user_session in expired_user_sessions:
        user_session.status = UserSession.SessionStatus.EXPIRED
        user_session.save(update_fields=['status'])

    # Clean up old Django sessions
    Session.objects.filter(expire_date__lte=now).delete()

    return expired_user_sessions.count()