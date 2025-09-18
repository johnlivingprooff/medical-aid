"""
Serializers for notification models.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models_notifications import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationLog, NotificationType, NotificationChannel
)

User = get_user_model()


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications."""
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    recipient_role = serializers.CharField(source='recipient.role', read_only=True)
    time_since_created = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_name', 'recipient_role',
            'notification_type', 'title', 'message', 'html_message',
            'channel', 'priority', 'status', 'is_read',
            'related_claim_id', 'related_membership_id', 'related_document_id',
            'metadata', 'scheduled_for', 'sent_at', 'read_at',
            'created_at', 'updated_at', 'time_since_created'
        ]
        read_only_fields = [
            'id', 'recipient_name', 'recipient_role', 'sent_at', 'read_at',
            'created_at', 'updated_at', 'time_since_created', 'is_read'
        ]

    def get_time_since_created(self, obj):
        """Get human-readable time since creation."""
        from django.utils.timesince import timesince
        return timesince(obj.created_at)

    def get_is_read(self, obj):
        """Check if notification is read."""
        return obj.status == Notification.Status.READ


class NotificationDetailSerializer(NotificationSerializer):
    """Detailed serializer for individual notifications."""
    related_claim = serializers.SerializerMethodField()
    related_membership = serializers.SerializerMethodField()
    related_document = serializers.SerializerMethodField()
    logs = serializers.SerializerMethodField()

    class Meta(NotificationSerializer.Meta):
        fields = NotificationSerializer.Meta.fields + [
            'related_claim', 'related_membership', 'related_document', 'logs'
        ]

    def get_related_claim(self, obj):
        """Get related claim details if exists."""
        if obj.related_claim_id:
            try:
                from claims.models import Claim
                claim = Claim.objects.get(id=obj.related_claim_id)
                return {
                    'id': claim.id,
                    'claim_number': claim.claim_number,
                    'status': claim.status,
                    'cost': str(claim.cost),
                    'date_of_service': claim.date_of_service
                }
            except Claim.DoesNotExist:
                return None
        return None

    def get_related_membership(self, obj):
        """Get related membership details if exists."""
        if obj.related_membership_id:
            try:
                from accounts.models import ProviderNetworkMembership
                membership = ProviderNetworkMembership.objects.get(id=obj.related_membership_id)
                return {
                    'id': membership.id,
                    'scheme_name': membership.scheme.name,
                    'status': membership.status,
                    'effective_from': membership.effective_from,
                    'effective_to': membership.effective_to
                }
            except ProviderNetworkMembership.DoesNotExist:
                return None
        return None

    def get_related_document(self, obj):
        """Get related document details if exists."""
        if obj.related_document_id:
            try:
                from accounts.models import CredentialingDocument
                document = CredentialingDocument.objects.get(id=obj.related_document_id)
                return {
                    'id': document.id,
                    'doc_type': document.doc_type,
                    'file_name': document.file.name,
                    'status': document.status,
                    'uploaded_at': document.uploaded_at
                }
            except CredentialingDocument.DoesNotExist:
                return None
        return None

    def get_logs(self, obj):
        """Get notification logs."""
        logs = NotificationLog.objects.filter(notification=obj).order_by('-created_at')
        return NotificationLogSerializer(logs, many=True).data


class NotificationTemplateSerializer(serializers.ModelSerializer):
    """Serializer for notification templates."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'name', 'notification_type', 'subject_template',
            'message_template', 'html_template', 'variables',
            'is_active', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at', 'updated_at']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for notification preferences."""
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = NotificationPreference
        fields = [
            'id', 'user', 'user_name',
            'email_enabled', 'sms_enabled', 'push_enabled', 'in_app_enabled',
            'claim_updates_enabled', 'credentialing_updates_enabled',
            'payment_updates_enabled', 'system_announcements_enabled',
            'quiet_hours_start', 'quiet_hours_end', 'timezone',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_name', 'created_at', 'updated_at']


class NotificationLogSerializer(serializers.ModelSerializer):
    """Serializer for notification logs."""
    notification_title = serializers.CharField(source='notification.title', read_only=True)
    recipient_name = serializers.CharField(source='notification.recipient.get_full_name', read_only=True)

    class Meta:
        model = NotificationLog
        fields = [
            'id', 'notification', 'notification_title', 'recipient_name',
            'action', 'message', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'notification_title', 'recipient_name', 'created_at']


class NotificationCreateSerializer(serializers.Serializer):
    """Serializer for creating notifications."""
    recipient_id = serializers.IntegerField()
    notification_type = serializers.ChoiceField(choices=NotificationType.choices)
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    html_message = serializers.CharField(required=False, allow_blank=True)
    channel = serializers.ChoiceField(choices=NotificationChannel.choices, required=False)
    priority = serializers.ChoiceField(
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('URGENT', 'Urgent')],
        required=False,
        default='MEDIUM'
    )
    scheduled_for = serializers.DateTimeField(required=False)
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_recipient_id(self, value):
        """Validate that recipient exists."""
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("Recipient does not exist.")
        return value


class BulkNotificationSerializer(serializers.Serializer):
    """Serializer for bulk notifications."""
    recipient_ids = serializers.ListField(child=serializers.IntegerField())
    notification_type = serializers.ChoiceField(choices=NotificationType.choices)
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    html_message = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('URGENT', 'Urgent')],
        required=False,
        default='MEDIUM'
    )
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_recipient_ids(self, value):
        """Validate that all recipients exist."""
        existing_ids = set(User.objects.filter(id__in=value).values_list('id', flat=True))
        invalid_ids = set(value) - existing_ids

        if invalid_ids:
            raise serializers.ValidationError(f"Invalid recipient IDs: {list(invalid_ids)}")

        return value


class SystemAnnouncementSerializer(serializers.Serializer):
    """Serializer for system announcements."""
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    html_message = serializers.CharField(required=False, allow_blank=True)
    target_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=[
            ('ADMIN', 'Admin'), ('PROVIDER', 'Provider'), ('PATIENT', 'Patient')
        ]),
        required=False,
        default=['ADMIN', 'PROVIDER', 'PATIENT']
    )
    priority = serializers.ChoiceField(
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('URGENT', 'Urgent')],
        required=False,
        default='HIGH'
    )


class NotificationStatsSerializer(serializers.Serializer):
    """Serializer for notification statistics."""
    total = serializers.IntegerField()
    unread = serializers.IntegerField()
    read = serializers.IntegerField()
    failed = serializers.IntegerField()
    by_type = serializers.ListField(child=serializers.DictField())