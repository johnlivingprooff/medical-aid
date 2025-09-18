"""
Automated credentialing service for document validation and review workflow.
"""

from django.db import transaction
from django.utils import timezone
from django.core.files.base import File
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
import os
import re
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from accounts.models import CredentialingDocument, ProviderNetworkMembership
from .models_credentialing import (
    CredentialingRule, CredentialingReview, CredentialingTemplate,
    DocumentExpiryAlert
)

User = get_user_model()
logger = logging.getLogger(__name__)


class CredentialingService:
    """Service for automated credentialing document processing."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def process_document_upload(self, document: CredentialingDocument) -> Dict:
        """
        Process a newly uploaded credentialing document.
        Performs automated validation and initiates review workflow.
        """
        results = {
            'validation_score': 0,
            'auto_checks': {},
            'requires_review': True,
            'review_priority': 'MEDIUM',
            'messages': []
        }

        try:
            # Get applicable rules
            rules = self._get_applicable_rules(document)

            # Run automated validation
            validation_results = self._run_automated_validation(document, rules)
            results['auto_checks'] = validation_results['checks']
            results['validation_score'] = validation_results['score']

            # Determine action based on rules and score
            action_result = self._determine_action(document, rules, validation_results['score'])
            results.update(action_result)

            # Create review record if needed
            if results['requires_review']:
                self._create_review_record(document, results)

            # Update document status
            self._update_document_status(document, results)

            results['success'] = True

        except Exception as e:
            self.logger.error(f"Error processing document {document.id}: {str(e)}")
            results['success'] = False
            results['error'] = str(e)
            results['messages'].append(f"Processing error: {str(e)}")

        return results

    def _get_applicable_rules(self, document: CredentialingDocument) -> List[CredentialingRule]:
        """Get all applicable validation rules for a document."""
        return CredentialingRule.objects.filter(
            doc_type=document.doc_type,
            is_active=True
        ).order_by('created_at')

    def _run_automated_validation(self, document: CredentialingDocument, rules: List[CredentialingRule]) -> Dict:
        """Run automated validation checks on the document."""
        total_score = 0
        checks_passed = 0
        total_checks = 0
        check_results = {}

        for rule in rules:
            rule_checks = self._validate_against_rule(document, rule)
            check_results[rule.name] = rule_checks

            for check_name, check_result in rule_checks.items():
                total_checks += 1
                if check_result['passed']:
                    checks_passed += 1
                    total_score += check_result.get('score', 10)  # Default 10 points per check

        # Calculate percentage score
        final_score = int((checks_passed / total_checks * 100)) if total_checks > 0 else 0

        return {
            'score': final_score,
            'checks_passed': checks_passed,
            'total_checks': total_checks,
            'checks': check_results
        }

    def _validate_against_rule(self, document: CredentialingDocument, rule: CredentialingRule) -> Dict:
        """Validate a document against a specific rule."""
        results = {}

        # File size validation
        if rule.min_file_size or rule.max_file_size:
            file_size = document.file.size
            results['file_size'] = {
                'passed': self._check_file_size(file_size, rule.min_file_size, rule.max_file_size),
                'actual_size': file_size,
                'required_min': rule.min_file_size,
                'required_max': rule.max_file_size,
                'score': 15
            }

        # File extension validation
        if rule.allowed_extensions:
            file_ext = os.path.splitext(document.file.name)[1].lower().lstrip('.')
            results['file_extension'] = {
                'passed': file_ext in rule.allowed_extensions,
                'actual_extension': file_ext,
                'allowed_extensions': rule.allowed_extensions,
                'score': 10
            }

        # Content pattern validation (if file is text-based)
        if rule.content_patterns:
            content_check = self._validate_content_patterns(document, rule.content_patterns)
            results['content_patterns'] = content_check

        return results

    def _check_file_size(self, actual_size: int, min_size: Optional[int], max_size: Optional[int]) -> bool:
        """Check if file size is within acceptable range."""
        if min_size and actual_size < min_size:
            return False
        if max_size and actual_size > max_size:
            return False
        return True

    def _validate_content_patterns(self, document: CredentialingDocument, patterns: List[str]) -> Dict:
        """Validate document content against regex patterns."""
        try:
            # Only check text-based files
            if not document.file.name.lower().endswith(('.txt', '.pdf', '.doc', '.docx')):
                return {
                    'passed': True,
                    'message': 'Content validation skipped for binary file',
                    'score': 0
                }

            # Read file content (simplified - in real implementation, use proper PDF/doc parsers)
            content = ""
            if document.file.name.lower().endswith('.txt'):
                content = document.file.read().decode('utf-8', errors='ignore')

            patterns_matched = 0
            for pattern in patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    patterns_matched += 1

            passed = patterns_matched >= len(patterns) * 0.7  # 70% match threshold
            return {
                'passed': passed,
                'patterns_matched': patterns_matched,
                'total_patterns': len(patterns),
                'match_percentage': (patterns_matched / len(patterns) * 100) if patterns else 0,
                'score': 20 if passed else 0
            }

        except Exception as e:
            return {
                'passed': False,
                'error': str(e),
                'score': 0
            }

    def _determine_action(self, document: CredentialingDocument, rules: List[CredentialingRule], score: int) -> Dict:
        """Determine the action to take based on validation results."""
        # Find the most restrictive rule that applies
        action = 'REQUIRE_REVIEW'
        priority = 'MEDIUM'

        for rule in rules:
            if score >= rule.auto_approve_score and rule.action == 'AUTO_APPROVE':
                action = 'AUTO_APPROVE'
                break
            elif score < 50 and rule.action == 'AUTO_REJECT':
                action = 'AUTO_REJECT'
                priority = 'HIGH'
                break
            elif rule.action == 'ESCALATE':
                action = 'ESCALATE'
                priority = 'HIGH'
                break

        return {
            'action': action,
            'requires_review': action != 'AUTO_APPROVE',
            'review_priority': priority,
            'auto_approved': action == 'AUTO_APPROVE',
            'auto_rejected': action == 'AUTO_REJECT'
        }

    def _create_review_record(self, document: CredentialingDocument, results: Dict):
        """Create a review record for manual review."""
        review = CredentialingReview.objects.create(
            document=document,
            status='PENDING',
            priority=results.get('review_priority', 'MEDIUM'),
            validation_score=results.get('validation_score', 0),
            auto_checks_passed=results.get('auto_checks', {}),
            manual_checks_required=results.get('manual_checks_required', [])
        )

        # Add initial history entry
        review.add_review_action(
            'AUTO_VALIDATION',
            f'Automated validation completed with score {review.validation_score}%',
            None
        )

        return review

    def _update_document_status(self, document: CredentialingDocument, results: Dict):
        """Update the document status based on processing results."""
        if results.get('auto_approved'):
            document.status = CredentialingDocument.ReviewStatus.REVIEWED
        elif results.get('auto_rejected'):
            document.status = CredentialingDocument.ReviewStatus.REJECTED
        else:
            document.status = CredentialingDocument.ReviewStatus.PENDING

        document.save()

    def assign_reviewer(self, review_id: int, reviewer: User, priority: str = None) -> bool:
        """Assign a reviewer to a credentialing review."""
        try:
            review = CredentialingReview.objects.get(id=review_id)
            review.assign_reviewer(reviewer, priority)
            return True
        except CredentialingReview.DoesNotExist:
            return False

    def complete_review(self, review_id: int, reviewer: User, action: str,
                       notes: str = '', rejection_reason: str = '') -> bool:
        """Complete a credentialing review."""
        try:
            review = CredentialingReview.objects.get(id=review_id)
            review.complete_review(action, reviewer, notes, rejection_reason)
            return True
        except CredentialingReview.DoesNotExist:
            return False

    def check_document_expiry(self, document: CredentialingDocument) -> List[DocumentExpiryAlert]:
        """Check if a document is nearing expiry and create alerts."""
        alerts = []

        # This would need to be enhanced with actual expiry date extraction from documents
        # For now, we'll create alerts based on document age
        days_old = (timezone.now().date() - document.created_at.date()).days

        if days_old >= 330:  # 11 months
            alert = DocumentExpiryAlert.objects.create(
                document=document,
                alert_type='EXPIRY_WARNING',
                days_until_expiry=30,  # Assuming 1 year validity
                message=f'Document will expire in approximately 30 days'
            )
            alerts.append(alert)

        elif days_old >= 365:  # 1 year
            alert = DocumentExpiryAlert.objects.create(
                document=document,
                alert_type='EXPIRED',
                days_until_expiry=0,
                message='Document has expired and needs renewal'
            )
            alerts.append(alert)

        return alerts

    def bulk_assign_reviews(self, review_ids: List[int], reviewer: User, priority: str = None) -> Dict:
        """Bulk assign multiple reviews to a reviewer."""
        results = {'assigned': 0, 'failed': 0, 'errors': []}

        for review_id in review_ids:
            if self.assign_reviewer(review_id, reviewer, priority):
                results['assigned'] += 1
            else:
                results['failed'] += 1
                results['errors'].append(f'Failed to assign review {review_id}')

        return results

    def get_pending_reviews(self, reviewer: User = None, priority: str = None) -> List[CredentialingReview]:
        """Get pending reviews, optionally filtered by reviewer and priority."""
        queryset = CredentialingReview.objects.filter(status='PENDING')

        if reviewer:
            queryset = queryset.filter(reviewer=reviewer)

        if priority:
            queryset = queryset.filter(priority=priority)

        return list(queryset.select_related('document', 'document__membership'))

    def get_overdue_reviews(self) -> List[CredentialingReview]:
        """Get all overdue reviews."""
        return [review for review in CredentialingReview.objects.filter(
            status__in=['PENDING', 'IN_REVIEW']
        ) if review.is_overdue()]

    def generate_renewal_notices(self) -> List[Dict]:
        """Generate renewal notices for expiring documents."""
        notices = []

        # Get documents that need renewal (this is simplified)
        thirty_days_from_now = timezone.now().date() + timedelta(days=30)

        # In a real implementation, this would check actual expiry dates from documents
        old_documents = CredentialingDocument.objects.filter(
            created_at__date__lte=thirty_days_from_now - timedelta(days=335)  # ~11 months ago
        )

        for doc in old_documents:
            notices.append({
                'document': doc,
                'provider': doc.membership.provider,
                'days_until_renewal': 30,
                'message': f'Your {doc.get_doc_type_display()} document expires soon and needs renewal'
            })

        return notices


class CredentialingWorkflowManager:
    """Manages the overall credentialing workflow for provider memberships."""

    def __init__(self):
        self.service = CredentialingService()

    def process_membership_application(self, membership: ProviderNetworkMembership) -> Dict:
        """Process a new provider membership application."""
        results = {
            'documents_required': [],
            'documents_submitted': 0,
            'validation_complete': False,
            'ready_for_review': False,
            'messages': []
        }

        try:
            # Get credentialing template
            template = self._get_credentialing_template(membership.provider.provider_profile)

            # Check required documents
            required_docs = template.get_required_docs_for_provider(membership.provider.provider_profile)
            results['documents_required'] = required_docs

            # Check submitted documents
            submitted_docs = membership.documents.all()
            results['documents_submitted'] = submitted_docs.count()

            # Validate all submitted documents
            validation_results = []
            for doc in submitted_docs:
                doc_result = self.service.process_document_upload(doc)
                validation_results.append(doc_result)

            # Check if all required documents are present and valid
            submitted_types = [doc.doc_type for doc in submitted_docs]
            missing_docs = [doc for doc in required_docs if doc not in submitted_types]

            if missing_docs:
                results['messages'].append(f'Missing required documents: {", ".join(missing_docs)}')
            else:
                results['validation_complete'] = True
                results['ready_for_review'] = True

            results['validation_results'] = validation_results

        except Exception as e:
            results['error'] = str(e)
            results['messages'].append(f'Processing error: {str(e)}')

        return results

    def _get_credentialing_template(self, provider_profile) -> CredentialingTemplate:
        """Get the appropriate credentialing template for a provider."""
        # Try to find template matching facility type
        template = CredentialingTemplate.objects.filter(
            facility_type=provider_profile.facility_type,
            is_active=True
        ).first()

        # Fallback to general template
        if not template:
            template = CredentialingTemplate.objects.filter(
                facility_type='',
                is_active=True
            ).first()

        # Create default template if none exists
        if not template:
            template = CredentialingTemplate.objects.create(
                name='Default Credentialing Template',
                description='Default template for provider credentialing',
                required_documents=['LICENSE', 'CONTRACT', 'INSURANCE']
            )

        return template

    def update_membership_status(self, membership: ProviderNetworkMembership) -> str:
        """Update the credentialing status of a membership based on document reviews."""
        documents = membership.documents.all()

        if not documents.exists():
            return 'PENDING'

        total_docs = documents.count()
        approved_docs = documents.filter(status='REVIEWED').count()
        rejected_docs = documents.filter(status='REJECTED').count()

        if rejected_docs > 0:
            return 'REJECTED'
        elif approved_docs == total_docs:
            return 'APPROVED'
        else:
            return 'PENDING'