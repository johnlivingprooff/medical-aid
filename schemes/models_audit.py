
from django.db import models
from django.utils import timezone
import json


class SchemeAuditLog(models.Model):
    """Audit log for scheme operations, especially deletions"""
    
    class ActionType(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        UPDATED = 'UPDATED', 'Updated'
        DELETED = 'DELETED', 'Deleted'
        DELETION_ATTEMPTED = 'DELETION_ATTEMPTED', 'Deletion Attempted'
        DELETION_BLOCKED = 'DELETION_BLOCKED', 'Deletion Blocked'
    
    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        PARTIAL = 'PARTIAL', 'Partial'
    
    # Who performed the action
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.PROTECT,
        related_name='scheme_audit_logs'
    )
    
    # What action was performed
    action = models.CharField(
        max_length=20,
        choices=ActionType.choices
    )
    
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.SUCCESS
    )
    
    # Scheme information (stored as JSON since scheme might be deleted)
    scheme_id = models.IntegerField(help_text="Original scheme ID")
    scheme_data = models.JSONField(
        help_text="Complete scheme data snapshot before action"
    )
    
    # Impact assessment
    affected_members_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of members affected by this action"
    )
    affected_benefits_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of benefits affected by this action"
    )
    affected_subscriptions_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of active subscriptions affected"
    )
    
    # Additional context
    reason = models.TextField(
        blank=True,
        help_text="Reason provided for the action"
    )
    
    error_details = models.TextField(
        blank=True,
        help_text="Error details if action failed"
    )
    
    # Technical details
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the user who performed the action"
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string"
    )
    
    # Timestamps
    timestamp = models.DateTimeField(default=timezone.now)
    duration_seconds = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Time taken to complete the action"
    )
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['scheme_id', 'action']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['status', 'timestamp']),
        ]
        verbose_name = 'Scheme Audit Log'
        verbose_name_plural = 'Scheme Audit Logs'
    
    def __str__(self):
        return f"{self.user.username} {self.action} scheme {self.scheme_id} at {self.timestamp}"
    
    @classmethod
    def log_scheme_action(cls, user, action, scheme, request=None, **kwargs):
        """
        Convenience method to log scheme actions
        
        Args:
            user: User performing the action
            action: ActionType choice
            scheme: Scheme instance or dict with scheme data
            request: HTTP request object (optional)
            **kwargs: Additional fields to set
        """
        # Prepare scheme data
        if hasattr(scheme, '__dict__'):
            # It's a model instance
            scheme_data = {
                'id': scheme.id,
                'name': scheme.name,
                'description': getattr(scheme, 'description', ''),
                'created_at': scheme.created_at.isoformat() if hasattr(scheme, 'created_at') else None,
            }
            scheme_id = scheme.id
        else:
            # It's already a dict
            scheme_data = scheme
            scheme_id = scheme.get('id')
        
        # Extract IP and user agent from request
        ip_address = None
        user_agent = ''
        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Create log entry
        return cls.objects.create(
            user=user,
            action=action,
            scheme_id=scheme_id,
            scheme_data=scheme_data,
            ip_address=ip_address,
            user_agent=user_agent,
            **kwargs
        )
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip