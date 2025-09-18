"""
Enhanced credentialing views with automated document review and approval processes.
"""

from django.db.models import Q, Count, F
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, ChoiceFilter, DateFilter

from accounts.models import ProviderNetworkMembership, CredentialingDocument
from .models_credentialing import (
    CredentialingRule, CredentialingReview, CredentialingTemplate,
    DocumentExpiryAlert
)
from .serializers_credentialing import (
    CredentialingRuleSerializer, CredentialingReviewSerializer,
    CredentialingTemplateSerializer, DocumentExpiryAlertSerializer,
    CredentialingDashboardSerializer
)
from .credentialing_service import CredentialingService, CredentialingWorkflowManager


class CredentialingRuleViewSet(viewsets.ModelViewSet):
    """Manage credentialing validation rules."""

    queryset = CredentialingRule.objects.all()
    serializer_class = CredentialingRuleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rule_type', 'doc_type', 'is_active', 'action']

    def get_queryset(self):
        """Filter rules based on user permissions."""
        user = self.request.user
        if getattr(user, 'role', None) == 'ADMIN':
            return self.queryset
        # Non-admin users can only view active rules
        return self.queryset.filter(is_active=True)

    @action(detail=True, methods=['post'])
    def test_rule(self, request, pk=None):
        """Test a credentialing rule against sample data."""
        rule = self.get_object()
        test_data = request.data

        # This would implement rule testing logic
        return Response({
            'rule': rule.name,
            'test_results': 'Rule testing not yet implemented',
            'test_data': test_data
        })


class CredentialingReviewViewSet(viewsets.ModelViewSet):
    """Manage credentialing document reviews."""

    queryset = CredentialingReview.objects.select_related(
        'document', 'document__membership', 'reviewer', 'escalated_to'
    ).all()
    serializer_class = CredentialingReviewSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'priority', 'reviewer']

    def get_queryset(self):
        """Filter reviews based on user role and permissions."""
        user = self.request.user
        queryset = self.queryset

        if getattr(user, 'role', None) == 'ADMIN':
            return queryset
        elif getattr(user, 'role', None) == 'PROVIDER':
            # Providers can only see reviews for their own documents
            return queryset.filter(document__membership__provider=user)
        else:
            # Reviewers can only see reviews assigned to them
            return queryset.filter(
                Q(reviewer=user) |
                Q(escalated_to=user) |
                Q(status='PENDING')  # Allow claiming pending reviews
            )

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign a review to the current user."""
        review = self.get_object()
        service = CredentialingService()

        priority = request.data.get('priority', review.priority)

        if service.assign_reviewer(review.id, request.user, priority):
            return Response({'message': 'Review assigned successfully'})
        return Response({'error': 'Failed to assign review'}, status=400)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete a review with approval or rejection."""
        review = self.get_object()
        service = CredentialingService()

        action = request.data.get('action')  # 'APPROVE', 'REJECT', 'ESCALATE'
        notes = request.data.get('notes', '')
        rejection_reason = request.data.get('rejection_reason', '')

        if not action or action not in ['APPROVE', 'REJECT', 'ESCALATE']:
            return Response({'error': 'Invalid action'}, status=400)

        if service.complete_review(review.id, request.user, action, notes, rejection_reason):
            return Response({'message': f'Review {action.lower()}d successfully'})
        return Response({'error': 'Failed to complete review'}, status=400)

    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        """Bulk assign multiple reviews."""
        review_ids = request.data.get('review_ids', [])
        priority = request.data.get('priority', 'MEDIUM')

        if not review_ids:
            return Response({'error': 'No review IDs provided'}, status=400)

        service = CredentialingService()
        results = service.bulk_assign_reviews(review_ids, request.user, priority)

        return Response(results)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending reviews for the current user."""
        service = CredentialingService()
        reviews = service.get_pending_reviews(request.user)

        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue reviews (admin only)."""
        user = request.user
        if getattr(user, 'role', None) != 'ADMIN':
            return Response({'error': 'Admin access required'}, status=403)

        service = CredentialingService()
        reviews = service.get_overdue_reviews()

        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)


class CredentialingTemplateViewSet(viewsets.ModelViewSet):
    """Manage credentialing templates."""

    queryset = CredentialingTemplate.objects.all()
    serializer_class = CredentialingTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter templates based on user permissions."""
        user = self.request.user
        if getattr(user, 'role', None) == 'ADMIN':
            return self.queryset
        # Non-admin users can only view active templates
        return self.queryset.filter(is_active=True)

    @action(detail=True, methods=['get'])
    def requirements(self, request, pk=None):
        """Get document requirements for a specific provider type."""
        template = self.get_object()
        facility_type = request.query_params.get('facility_type')

        if facility_type:
            # Mock provider profile for requirements calculation
            class MockProfile:
                facility_type = facility_type

            requirements = template.get_required_docs_for_provider(MockProfile())
        else:
            requirements = template.required_documents

        return Response({
            'template': template.name,
            'facility_type': facility_type,
            'required_documents': requirements,
            'validation_rules': template.validation_rules
        })


class DocumentExpiryAlertViewSet(viewsets.ReadOnlyModelViewSet):
    """View document expiry alerts."""

    queryset = DocumentExpiryAlert.objects.select_related('document', 'acknowledged_by').all()
    serializer_class = DocumentExpiryAlertSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['alert_type', 'is_acknowledged']

    def get_queryset(self):
        """Filter alerts based on user permissions."""
        user = self.request.user
        queryset = self.queryset

        if getattr(user, 'role', None) == 'PROVIDER':
            # Providers only see alerts for their documents
            return queryset.filter(document__membership__provider=user)
        # Admins and reviewers see all alerts
        return queryset

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge an expiry alert."""
        alert = self.get_object()
        alert.acknowledge(request.user)
        return Response({'message': 'Alert acknowledged'})


class CredentialingDashboardView(generics.GenericAPIView):
    """Credentialing dashboard with statistics and pending actions."""

    permission_classes = [IsAuthenticated]
    serializer_class = CredentialingDashboardSerializer

    def get(self, request):
        """Get credentialing dashboard data."""
        user = request.user
        user_role = getattr(user, 'role', None)

        dashboard_data = {
            'timestamp': timezone.now(),
            'user_role': user_role,
        }

        if user_role == 'ADMIN':
            dashboard_data.update(self._get_admin_dashboard())
        elif user_role == 'PROVIDER':
            dashboard_data.update(self._get_provider_dashboard(user))
        else:
            dashboard_data.update(self._get_reviewer_dashboard(user))

        return Response(dashboard_data)

    def _get_admin_dashboard(self):
        """Get dashboard data for administrators."""
        # Overall statistics
        total_memberships = ProviderNetworkMembership.objects.count()
        pending_credentialing = ProviderNetworkMembership.objects.filter(credential_status='PENDING').count()
        approved_credentialing = ProviderNetworkMembership.objects.filter(credential_status='APPROVED').count()
        rejected_credentialing = ProviderNetworkMembership.objects.filter(credential_status='REJECTED').count()

        # Document statistics
        total_documents = CredentialingDocument.objects.count()
        pending_reviews = CredentialingDocument.objects.filter(status='PENDING').count()
        reviewed_documents = CredentialingDocument.objects.filter(status='REVIEWED').count()
        rejected_documents = CredentialingDocument.objects.filter(status='REJECTED').count()

        # Review statistics
        total_reviews = CredentialingReview.objects.count()
        pending_reviews_count = CredentialingReview.objects.filter(status='PENDING').count()
        in_review_count = CredentialingReview.objects.filter(status='IN_REVIEW').count()
        completed_reviews = CredentialingReview.objects.filter(status__in=['APPROVED', 'REJECTED']).count()

        # Overdue reviews
        overdue_reviews = CredentialingReview.objects.filter(
            status__in=['PENDING', 'IN_REVIEW'],
            due_date__lt=timezone.now()
        ).count()

        # Recent activity (last 7 days)
        seven_days_ago = timezone.now() - timezone.timedelta(days=7)
        recent_uploads = CredentialingDocument.objects.filter(created_at__gte=seven_days_ago).count()
        recent_reviews = CredentialingReview.objects.filter(reviewed_at__gte=seven_days_ago).count()

        return {
            'overview': {
                'total_memberships': total_memberships,
                'pending_credentialing': pending_credentialing,
                'approved_credentialing': approved_credentialing,
                'rejected_credentialing': rejected_credentialing,
                'credentialing_completion_rate': round((approved_credentialing / total_memberships * 100), 1) if total_memberships > 0 else 0
            },
            'documents': {
                'total': total_documents,
                'pending_reviews': pending_reviews,
                'reviewed': reviewed_documents,
                'rejected': rejected_documents,
                'review_completion_rate': round((reviewed_documents / total_documents * 100), 1) if total_documents > 0 else 0
            },
            'reviews': {
                'total_reviews': total_reviews,
                'pending': pending_reviews_count,
                'in_review': in_review_count,
                'completed': completed_reviews,
                'overdue': overdue_reviews
            },
            'activity': {
                'recent_uploads': recent_uploads,
                'recent_reviews': recent_reviews,
                'period_days': 7
            }
        }

    def _get_provider_dashboard(self, user):
        """Get dashboard data for providers."""
        # Provider's memberships
        memberships = ProviderNetworkMembership.objects.filter(provider=user)

        membership_data = []
        for membership in memberships:
            documents = membership.documents.all()
            total_docs = documents.count()
            approved_docs = documents.filter(status='REVIEWED').count()
            rejected_docs = documents.filter(status='REJECTED').count()
            pending_docs = documents.filter(status='PENDING').count()

            membership_data.append({
                'scheme': membership.scheme.name,
                'status': membership.credential_status,
                'documents': {
                    'total': total_docs,
                    'approved': approved_docs,
                    'rejected': rejected_docs,
                    'pending': pending_docs,
                    'completion_rate': round((approved_docs / total_docs * 100), 1) if total_docs > 0 else 0
                }
            })

        # Recent uploads
        recent_uploads = CredentialingDocument.objects.filter(
            membership__provider=user,
            created_at__gte=timezone.now() - timezone.timedelta(days=30)
        ).order_by('-created_at')[:5]

        return {
            'memberships': membership_data,
            'recent_uploads': [
                {
                    'id': upload.id,
                    'doc_type': upload.get_doc_type_display(),
                    'status': upload.status,
                    'uploaded_at': upload.created_at,
                    'notes': upload.notes
                } for upload in recent_uploads
            ]
        }

    def _get_reviewer_dashboard(self, user):
        """Get dashboard data for reviewers."""
        # Assigned reviews
        assigned_reviews = CredentialingReview.objects.filter(
            Q(reviewer=user) | Q(escalated_to=user),
            status__in=['PENDING', 'IN_REVIEW']
        )

        pending_count = assigned_reviews.filter(status='PENDING').count()
        in_review_count = assigned_reviews.filter(status='IN_REVIEW').count()

        # Overdue reviews
        overdue_reviews = [review for review in assigned_reviews if review.is_overdue()]
        overdue_count = len(overdue_reviews)

        # Recent completed reviews
        recent_completed = CredentialingReview.objects.filter(
            reviewer=user,
            status__in=['APPROVED', 'REJECTED'],
            reviewed_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).order_by('-reviewed_at')[:5]

        return {
            'assigned_reviews': {
                'pending': pending_count,
                'in_review': in_review_count,
                'overdue': overdue_count,
                'total': pending_count + in_review_count
            },
            'recent_completed': [
                {
                    'id': review.id,
                    'document_type': review.document.get_doc_type_display(),
                    'action': review.status,
                    'completed_at': review.reviewed_at,
                    'notes': review.review_notes
                } for review in recent_completed
            ]
        }


class CredentialingWorkflowView(generics.GenericAPIView):
    """Handle credentialing workflow operations."""

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def process_upload(self, request):
        """Process a document upload through the automated workflow."""
        document_id = request.data.get('document_id')
        if not document_id:
            return Response({'error': 'Document ID required'}, status=400)

        try:
            document = CredentialingDocument.objects.get(id=document_id)
            service = CredentialingService()
            results = service.process_document_upload(document)

            return Response(results)
        except CredentialingDocument.DoesNotExist:
            return Response({'error': 'Document not found'}, status=404)

    @action(detail=False, methods=['post'])
    def process_membership(self, request):
        """Process a membership application through the workflow."""
        membership_id = request.data.get('membership_id')
        if not membership_id:
            return Response({'error': 'Membership ID required'}, status=400)

        try:
            membership = ProviderNetworkMembership.objects.get(id=membership_id)
            manager = CredentialingWorkflowManager()
            results = manager.process_membership_application(membership)

            return Response(results)
        except ProviderNetworkMembership.DoesNotExist:
            return Response({'error': 'Membership not found'}, status=404)

    @action(detail=False, methods=['get'])
    def renewal_notices(self, request):
        """Get renewal notices for expiring documents."""
        service = CredentialingService()
        notices = service.generate_renewal_notices()

        return Response({
            'notices': notices,
            'count': len(notices)
        })