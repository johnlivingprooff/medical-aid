"""
Serializers for enhanced credentialing workflow.
"""

from rest_framework import serializers
from .models_credentialing import (
    CredentialingRule, CredentialingReview, CredentialingTemplate,
    DocumentExpiryAlert
)


class CredentialingRuleSerializer(serializers.ModelSerializer):
    """Serializer for credentialing validation rules."""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = CredentialingRule
        fields = [
            'id', 'name', 'description', 'rule_type', 'doc_type', 'is_active',
            'min_file_size', 'max_file_size', 'allowed_extensions', 'required_fields',
            'content_patterns', 'expiry_check_days', 'action', 'auto_approve_score',
            'escalation_threshold', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_auto_approve_score(self, value):
        """Validate auto-approve score is between 0-100."""
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Auto-approve score must be between 0 and 100")
        return value

    def validate_escalation_threshold(self, value):
        """Validate escalation threshold is positive."""
        if value <= 0:
            raise serializers.ValidationError("Escalation threshold must be positive")
        return value


class CredentialingReviewSerializer(serializers.ModelSerializer):
    """Serializer for credentialing document reviews."""

    document_type = serializers.CharField(source='document.get_doc_type_display', read_only=True)
    document_file_name = serializers.CharField(source='document.file.name', read_only=True)
    provider_name = serializers.CharField(source='document.membership.provider.username', read_only=True)
    scheme_name = serializers.CharField(source='document.membership.scheme.name', read_only=True)
    reviewer_name = serializers.CharField(source='reviewer.username', read_only=True)
    escalated_to_name = serializers.CharField(source='escalated_to.username', read_only=True)
    days_overdue = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = CredentialingReview
        fields = [
            'id', 'document', 'document_type', 'document_file_name', 'provider_name', 'scheme_name',
            'reviewer', 'reviewer_name', 'status', 'priority', 'validation_score',
            'review_notes', 'rejection_reason', 'auto_checks_passed', 'manual_checks_required',
            'assigned_at', 'reviewed_at', 'due_date', 'escalated_to', 'escalated_to_name',
            'escalation_reason', 'review_history', 'days_overdue', 'is_overdue'
        ]
        read_only_fields = ['id', 'assigned_at', 'reviewed_at', 'review_history']

    def get_days_overdue(self, obj):
        """Get days overdue for the review."""
        return obj.days_overdue()

    def get_is_overdue(self, obj):
        """Check if the review is overdue."""
        return obj.is_overdue()


class CredentialingTemplateSerializer(serializers.ModelSerializer):
    """Serializer for credentialing templates."""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = CredentialingTemplate
        fields = [
            'id', 'name', 'description', 'facility_type', 'required_documents',
            'validation_rules', 'renewal_period_months', 'renewal_notice_days',
            'is_active', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class DocumentExpiryAlertSerializer(serializers.ModelSerializer):
    """Serializer for document expiry alerts."""

    document_type = serializers.CharField(source='document.get_doc_type_display', read_only=True)
    provider_name = serializers.CharField(source='document.membership.provider.username', read_only=True)
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.username', read_only=True)

    class Meta:
        model = DocumentExpiryAlert
        fields = [
            'id', 'document', 'document_type', 'provider_name', 'alert_type',
            'days_until_expiry', 'message', 'is_acknowledged', 'acknowledged_by',
            'acknowledged_by_name', 'acknowledged_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'acknowledged_at']


class CredentialingDashboardSerializer(serializers.Serializer):
    """Serializer for credentialing dashboard data."""

    timestamp = serializers.DateTimeField()
    user_role = serializers.CharField()

    # Admin dashboard fields
    overview = serializers.DictField(required=False)
    documents = serializers.DictField(required=False)
    reviews = serializers.DictField(required=False)
    activity = serializers.DictField(required=False)

    # Provider dashboard fields
    memberships = serializers.ListField(required=False)
    recent_uploads = serializers.ListField(required=False)

    # Reviewer dashboard fields
    assigned_reviews = serializers.DictField(required=False)
    recent_completed = serializers.ListField(required=False)


class CredentialingWorkflowSerializer(serializers.Serializer):
    """Serializer for credentialing workflow operations."""

    document_id = serializers.IntegerField(required=False)
    membership_id = serializers.IntegerField(required=False)
    action = serializers.ChoiceField(
        choices=['APPROVE', 'REJECT', 'ESCALATE'],
        required=False
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(
        choices=['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        required=False
    )
    review_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False
    )