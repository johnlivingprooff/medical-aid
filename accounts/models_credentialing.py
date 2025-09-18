"""
Enhanced credentialing workflow with automated document review and approval processes.
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
import os
import re
from datetime import date, timedelta

from accounts.models import ProviderNetworkMembership, CredentialingDocument, ProviderProfile

User = get_user_model()


class CredentialingRule(models.Model):
    """Rules for automated document validation and approval."""

    class RuleType(models.TextChoices):
        DOCUMENT_VALIDITY = 'DOCUMENT_VALIDITY', 'Document Validity Check'
        LICENSE_VERIFICATION = 'LICENSE_VERIFICATION', 'License Verification'
        CONTRACT_VALIDATION = 'CONTRACT_VALIDATION', 'Contract Validation'
        INSURANCE_CHECK = 'INSURANCE_CHECK', 'Insurance Coverage Check'
        COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW', 'Compliance Review'

    class ActionType(models.TextChoices):
        AUTO_APPROVE = 'AUTO_APPROVE', 'Auto Approve'
        AUTO_REJECT = 'AUTO_REJECT', 'Auto Reject'
        REQUIRE_REVIEW = 'REQUIRE_REVIEW', 'Require Manual Review'
        ESCALATE = 'ESCALATE', 'Escalate to Senior Review'

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    rule_type = models.CharField(max_length=30, choices=RuleType.choices)
    doc_type = models.CharField(max_length=20, choices=CredentialingDocument.DocType.choices)
    is_active = models.BooleanField(default=True)

    # Rule conditions
    min_file_size = models.PositiveIntegerField(null=True, blank=True, help_text='Minimum file size in bytes')
    max_file_size = models.PositiveIntegerField(null=True, blank=True, help_text='Maximum file size in bytes')
    allowed_extensions = models.JSONField(default=list, help_text='Allowed file extensions')
    required_fields = models.JSONField(default=list, help_text='Required fields to check')

    # Validation patterns
    content_patterns = models.JSONField(default=list, help_text='Regex patterns to match in document content')
    expiry_check_days = models.PositiveIntegerField(default=30, help_text='Days before expiry to flag')

    # Action configuration
    action = models.CharField(max_length=20, choices=ActionType.choices, default=ActionType.REQUIRE_REVIEW)
    auto_approve_score = models.PositiveIntegerField(default=0, help_text='Minimum score for auto-approval (0-100)')
    escalation_threshold = models.PositiveIntegerField(default=90, help_text='Days without action before escalation')

    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='credentialing_rules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['rule_type', 'doc_type', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_rule_type_display()})"


class CredentialingReview(models.Model):
    """Review process for credentialing documents."""

    class ReviewStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_REVIEW = 'IN_REVIEW', 'In Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        ESCALATED = 'ESCALATED', 'Escalated'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    document = models.OneToOneField(CredentialingDocument, on_delete=models.CASCADE, related_name='review')
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviews')

    status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)

    # Review details
    validation_score = models.PositiveIntegerField(default=0, help_text='Automated validation score (0-100)')
    review_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    # Automated checks results
    auto_checks_passed = models.JSONField(default=dict, help_text='Results of automated validation checks')
    manual_checks_required = models.JSONField(default=list, help_text='Manual checks that need attention')

    # Timestamps
    assigned_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)

    # Escalation
    escalated_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='escalated_reviews')
    escalated_at = models.DateTimeField(null=True, blank=True)
    escalation_reason = models.TextField(blank=True)

    # Audit trail
    review_history = models.JSONField(default=list, help_text='History of review actions')

    class Meta:
        ordering = ['-assigned_at', '-due_date']
        indexes = [
            models.Index(fields=['status', 'priority', 'due_date']),
            models.Index(fields=['reviewer', 'status']),
        ]

    def __str__(self):
        return f"Review for {self.document} - {self.status}"

    def assign_reviewer(self, reviewer, priority=None):
        """Assign a reviewer to this document."""
        self.reviewer = reviewer
        self.assigned_at = timezone.now()
        if priority:
            self.priority = priority

        # Set due date based on priority
        if self.priority == self.Priority.URGENT:
            self.due_date = self.assigned_at + timedelta(hours=4)
        elif self.priority == self.Priority.HIGH:
            self.due_date = self.assigned_at + timedelta(days=1)
        elif self.priority == self.Priority.MEDIUM:
            self.due_date = self.assigned_at + timedelta(days=3)
        else:  # LOW
            self.due_date = self.assigned_at + timedelta(days=7)

        self.status = self.ReviewStatus.IN_REVIEW
        self.save()

        # Add to review history
        self.add_review_action('ASSIGNED', f'Assigned to {reviewer.username}', reviewer)

    def complete_review(self, action, reviewer, notes='', rejection_reason=''):
        """Complete the review with approval or rejection."""
        self.reviewed_at = timezone.now()
        self.review_notes = notes

        if action == 'APPROVE':
            self.status = self.ReviewStatus.APPROVED
            self.document.status = CredentialingDocument.ReviewStatus.REVIEWED
            self.document.save()
        elif action == 'REJECT':
            self.status = self.ReviewStatus.REJECTED
            self.rejection_reason = rejection_reason
            self.document.status = CredentialingDocument.ReviewStatus.REJECTED
            self.document.save()
        elif action == 'ESCALATE':
            self.status = self.ReviewStatus.ESCALATED
            self.escalated_at = timezone.now()

        self.save()

        # Add to review history
        action_desc = f"{action}: {notes}" if notes else action
        self.add_review_action(action, action_desc, reviewer)

    def add_review_action(self, action, description, user):
        """Add an action to the review history."""
        history_entry = {
            'action': action,
            'description': description,
            'user': user.username,
            'timestamp': timezone.now().isoformat(),
        }
        self.review_history.append(history_entry)
        self.save(update_fields=['review_history'])

    def is_overdue(self):
        """Check if the review is overdue."""
        if not self.due_date:
            return False
        return timezone.now() > self.due_date

    def days_overdue(self):
        """Get the number of days this review is overdue."""
        if not self.is_overdue():
            return 0
        return (timezone.now() - self.due_date).days


class CredentialingTemplate(models.Model):
    """Templates for required documents and validation rules."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    facility_type = models.CharField(max_length=20, choices=ProviderProfile.FacilityType.choices, blank=True)

    # Required documents
    required_documents = models.JSONField(default=list, help_text='List of required document types')

    # Validation rules
    validation_rules = models.JSONField(default=dict, help_text='Validation rules for each document type')

    # Renewal requirements
    renewal_period_months = models.PositiveIntegerField(default=12, help_text='Months between renewals')
    renewal_notice_days = models.PositiveIntegerField(default=60, help_text='Days before expiry to send renewal notice')

    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='credentialing_templates')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_required_docs_for_provider(self, provider_profile):
        """Get required documents based on provider type."""
        docs = self.required_documents.copy()

        # Add facility-specific requirements
        if provider_profile.facility_type == 'HOSPITAL':
            docs.extend(['SPECIALTY_LICENSE', 'EMERGENCY_CERT'])
        elif provider_profile.facility_type == 'PHARMACY':
            docs.extend(['PHARMACY_LICENSE', 'CONTROLLED_SUBSTANCES_CERT'])
        elif provider_profile.facility_type in ['LAB', 'IMAGING']:
            docs.extend(['TECHNICAL_CERTIFICATION'])

        return list(set(docs))  # Remove duplicates


class DocumentExpiryAlert(models.Model):
    """Alerts for expiring credentialing documents."""

    class AlertType(models.TextChoices):
        EXPIRY_WARNING = 'EXPIRY_WARNING', 'Expiry Warning'
        EXPIRY_CRITICAL = 'EXPIRY_CRITICAL', 'Expiry Critical'
        RENEWAL_DUE = 'RENEWAL_DUE', 'Renewal Due'
        EXPIRED = 'EXPIRED', 'Expired'

    document = models.ForeignKey(CredentialingDocument, on_delete=models.CASCADE, related_name='expiry_alerts')
    alert_type = models.CharField(max_length=20, choices=AlertType.choices)
    days_until_expiry = models.IntegerField()
    message = models.TextField()
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['alert_type', 'is_acknowledged', 'created_at']),
        ]

    def __str__(self):
        return f"{self.alert_type} for {self.document} ({self.days_until_expiry} days)"

    def acknowledge(self, user):
        """Acknowledge this alert."""
        self.is_acknowledged = True
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.save()