"""
Real-time provider network status monitoring views.
Provides live status information about provider network participation and availability.
"""

from django.db.models import Q, Count, Avg, F, Case, When, Value, IntegerField
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from accounts.models import ProviderNetworkMembership, ProviderProfile, User
from claims.models import Claim
from .serializers import ProviderNetworkStatusSerializer


class ProviderNetworkStatusView(APIView):
    """
    Real-time provider network status monitoring.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name='scheme_id',
                type=int,
                description='Filter by scheme ID',
                required=False
            ),
            OpenApiParameter(
                name='facility_type',
                type=str,
                description='Filter by facility type',
                required=False
            ),
            OpenApiParameter(
                name='status',
                type=str,
                description='Filter by network status (ACTIVE, PENDING, SUSPENDED)',
                required=False
            ),
        ]
    )
    def get(self, request):
        """Get real-time network status for all providers."""
        # Base queryset
        memberships = ProviderNetworkMembership.objects.select_related(
            'provider__provider_profile',
            'scheme'
        )

        # Apply filters
        scheme_id = request.query_params.get('scheme_id')
        if scheme_id:
            memberships = memberships.filter(scheme_id=scheme_id)

        facility_type = request.query_params.get('facility_type')
        if facility_type:
            memberships = memberships.filter(
                provider__provider_profile__facility_type=facility_type
            )

        network_status = request.query_params.get('status')
        if network_status:
            memberships = memberships.filter(status=network_status)

        # Get current time for real-time calculations
        now = timezone.now()

        network_status_data = []
        for membership in memberships:
            # Calculate real-time metrics
            recent_activity = self._calculate_recent_activity(membership.provider, membership.scheme)
            network_health = self._calculate_network_health(membership)
            performance_metrics = self._calculate_performance_metrics(membership.provider, membership.scheme)

            status_data = {
                'provider': {
                    'id': membership.provider.id,
                    'username': membership.provider.username,
                    'facility_name': membership.provider.provider_profile.facility_name,
                    'facility_type': membership.provider.provider_profile.facility_type,
                    'city': membership.provider.provider_profile.city,
                },
                'scheme': {
                    'id': membership.scheme.id,
                    'name': membership.scheme.name,
                    'category': membership.scheme.category,
                },
                'network_membership': {
                    'status': membership.status,
                    'credential_status': membership.credential_status,
                    'effective_from': membership.effective_from,
                    'effective_to': membership.effective_to,
                    'notes': membership.notes,
                },
                'real_time_status': {
                    'is_active': membership.status == 'ACTIVE' and (
                        membership.effective_to is None or membership.effective_to > now.date()
                    ),
                    'is_credentialed': membership.credential_status == 'APPROVED',
                    'days_until_expiry': self._calculate_days_until_expiry(membership),
                    'last_activity': recent_activity['last_claim_date'],
                    'activity_status': recent_activity['activity_status'],
                },
                'network_health': network_health,
                'performance_metrics': performance_metrics,
                'alerts': self._generate_status_alerts(membership, recent_activity, network_health),
            }
            network_status_data.append(status_data)

        return Response({
            'timestamp': now,
            'total_providers': len(network_status_data),
            'network_status': network_status_data
        })

    def _calculate_recent_activity(self, provider, scheme):
        """Calculate recent activity metrics."""
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        ninety_days_ago = timezone.now() - timezone.timedelta(days=90)

        # Recent claims in this scheme
        recent_claims = Claim.objects.filter(
            provider=provider,
            patient__scheme=scheme,
            created_at__gte=thirty_days_ago
        )

        last_claim = recent_claims.order_by('-created_at').first()

        # Activity status based on recency
        if last_claim and last_claim.created_at >= thirty_days_ago:
            activity_status = 'ACTIVE'
        elif last_claim and last_claim.created_at >= ninety_days_ago:
            activity_status = 'MODERATE'
        else:
            activity_status = 'INACTIVE'

        return {
            'total_claims_30d': recent_claims.count(),
            'last_claim_date': last_claim.created_at if last_claim else None,
            'activity_status': activity_status
        }

    def _calculate_network_health(self, membership):
        """Calculate network health indicators."""
        # Document completeness
        total_docs = membership.documents.count()
        approved_docs = membership.documents.filter(status='REVIEWED').count()
        pending_docs = membership.documents.filter(status='PENDING').count()
        rejected_docs = membership.documents.filter(status='REJECTED').count()

        # Calculate health score (0-100)
        health_score = 0

        # Status contributes 40%
        if membership.status == 'ACTIVE':
            health_score += 40
        elif membership.status == 'PENDING':
            health_score += 20

        # Credentials contribute 30%
        if membership.credential_status == 'APPROVED':
            health_score += 30
        elif membership.credential_status == 'PENDING':
            health_score += 15

        # Documents contribute 30%
        if total_docs > 0:
            doc_completion = (approved_docs / total_docs) * 30
            health_score += doc_completion

        # Determine health status
        if health_score >= 80:
            health_status = 'EXCELLENT'
        elif health_score >= 60:
            health_status = 'GOOD'
        elif health_score >= 40:
            health_status = 'FAIR'
        else:
            health_status = 'POOR'

        return {
            'health_score': round(health_score, 1),
            'health_status': health_status,
            'documents': {
                'total': total_docs,
                'approved': approved_docs,
                'pending': pending_docs,
                'rejected': rejected_docs,
                'completion_rate': round((approved_docs / total_docs * 100), 1) if total_docs > 0 else 0
            }
        }

    def _calculate_performance_metrics(self, provider, scheme):
        """Calculate performance metrics for the provider in this scheme."""
        ninety_days_ago = timezone.now() - timezone.timedelta(days=90)

        # Claims in this scheme
        scheme_claims = Claim.objects.filter(
            provider=provider,
            patient__scheme=scheme,
            created_at__gte=ninety_days_ago
        )

        total_claims = scheme_claims.count()
        approved_claims = scheme_claims.filter(status='APPROVED').count()
        rejected_claims = scheme_claims.filter(status='REJECTED').count()
        pending_claims = scheme_claims.filter(status='PENDING').count()

        approval_rate = (approved_claims / total_claims * 100) if total_claims > 0 else 0

        # Average processing time (for approved claims)
        avg_processing_time = None
        if approved_claims > 0:
            approved_with_times = scheme_claims.filter(
                status='APPROVED',
                processed_date__isnull=False
            )
            if approved_with_times.exists():
                total_time = sum(
                    (claim.processed_date - claim.created_at).days
                    for claim in approved_with_times
                )
                avg_processing_time = total_time / approved_with_times.count()

        return {
            'period_days': 90,
            'claims': {
                'total': total_claims,
                'approved': approved_claims,
                'rejected': rejected_claims,
                'pending': pending_claims,
                'approval_rate': round(approval_rate, 1)
            },
            'processing': {
                'average_days': round(avg_processing_time, 1) if avg_processing_time else None,
                'claims_processed': approved_claims
            }
        }

    def _calculate_days_until_expiry(self, membership):
        """Calculate days until membership expires."""
        if not membership.effective_to:
            return None

        days_until = (membership.effective_to - timezone.now().date()).days
        return max(0, days_until)  # Don't return negative values

    def _generate_status_alerts(self, membership, recent_activity, network_health):
        """Generate status alerts based on current conditions."""
        alerts = []
        now = timezone.now()

        # Expiry alerts
        days_until_expiry = self._calculate_days_until_expiry(membership)
        if days_until_expiry is not None:
            if days_until_expiry <= 30:
                alerts.append({
                    'type': 'EXPIRY_WARNING',
                    'severity': 'HIGH' if days_until_expiry <= 7 else 'MEDIUM',
                    'message': f'Network membership expires in {days_until_expiry} days',
                    'action_required': 'Renew membership'
                })

        # Credential alerts
        if membership.credential_status == 'PENDING':
            alerts.append({
                'type': 'CREDENTIAL_PENDING',
                'severity': 'MEDIUM',
                'message': 'Credentialing documents are pending review',
                'action_required': 'Submit/update credentialing documents'
            })
        elif membership.credential_status == 'REJECTED':
            alerts.append({
                'type': 'CREDENTIAL_REJECTED',
                'severity': 'HIGH',
                'message': 'Credentialing documents were rejected',
                'action_required': 'Review rejection reasons and resubmit'
            })

        # Activity alerts
        if recent_activity['activity_status'] == 'INACTIVE':
            alerts.append({
                'type': 'INACTIVITY_WARNING',
                'severity': 'LOW',
                'message': 'No recent claims activity detected',
                'action_required': 'Monitor provider engagement'
            })

        # Health alerts
        if network_health['health_status'] == 'POOR':
            alerts.append({
                'type': 'HEALTH_CRITICAL',
                'severity': 'HIGH',
                'message': f'Network health is poor ({network_health["health_score"]}%)',
                'action_required': 'Review and address health issues'
            })
        elif network_health['health_status'] == 'FAIR':
            alerts.append({
                'type': 'HEALTH_WARNING',
                'severity': 'MEDIUM',
                'message': f'Network health needs attention ({network_health["health_score"]}%)',
                'action_required': 'Address outstanding issues'
            })

        return alerts


class ProviderNetworkDashboardView(APIView):
    """
    Provider network dashboard with summary statistics and alerts.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get provider network dashboard data."""
        # Overall network statistics
        total_memberships = ProviderNetworkMembership.objects.count()
        active_memberships = ProviderNetworkMembership.objects.filter(status='ACTIVE').count()
        pending_memberships = ProviderNetworkMembership.objects.filter(status='PENDING').count()
        suspended_memberships = ProviderNetworkMembership.objects.filter(status='SUSPENDED').count()

        # Credentialing statistics
        approved_credentials = ProviderNetworkMembership.objects.filter(credential_status='APPROVED').count()
        pending_credentials = ProviderNetworkMembership.objects.filter(credential_status='PENDING').count()
        rejected_credentials = ProviderNetworkMembership.objects.filter(credential_status='REJECTED').count()

        # Facility type breakdown
        facility_breakdown = dict(
            ProviderProfile.objects.values('facility_type')
            .annotate(count=Count('id'))
            .values_list('facility_type', 'count')
        )

        # Critical alerts
        critical_alerts = []

        # Expiring memberships (next 30 days)
        expiring_soon = ProviderNetworkMembership.objects.filter(
            status='ACTIVE',
            effective_to__isnull=False,
            effective_to__lte=timezone.now().date() + timezone.timedelta(days=30),
            effective_to__gte=timezone.now().date()
        ).select_related('provider__provider_profile', 'scheme')

        for membership in expiring_soon:
            days_until = (membership.effective_to - timezone.now().date()).days
            critical_alerts.append({
                'type': 'EXPIRING_MEMBERSHIP',
                'provider': membership.provider.provider_profile.facility_name,
                'scheme': membership.scheme.name,
                'days_until_expiry': days_until,
                'severity': 'HIGH' if days_until <= 7 else 'MEDIUM'
            })

        # Rejected credentials
        rejected_creds = ProviderNetworkMembership.objects.filter(
            credential_status='REJECTED'
        ).select_related('provider__provider_profile', 'scheme')

        for membership in rejected_creds:
            critical_alerts.append({
                'type': 'REJECTED_CREDENTIALS',
                'provider': membership.provider.provider_profile.facility_name,
                'scheme': membership.scheme.name,
                'severity': 'HIGH'
            })

        # Network health summary
        health_stats = ProviderNetworkMembership.objects.aggregate(
            avg_health=Avg(
                Case(
                    When(status='ACTIVE', then=Value(40)),
                    When(status='PENDING', then=Value(20)),
                    default=Value(0),
                    output_field=IntegerField()
                ) + Case(
                    When(credential_status='APPROVED', then=Value(30)),
                    When(credential_status='PENDING', then=Value(15)),
                    default=Value(0),
                    output_field=IntegerField()
                )
            )
        )

        return Response({
            'timestamp': timezone.now(),
            'network_overview': {
                'total_memberships': total_memberships,
                'active_memberships': active_memberships,
                'pending_memberships': pending_memberships,
                'suspended_memberships': suspended_memberships,
                'active_rate': round((active_memberships / total_memberships * 100), 1) if total_memberships > 0 else 0
            },
            'credentialing_status': {
                'approved': approved_credentials,
                'pending': pending_credentials,
                'rejected': rejected_credentials,
                'completion_rate': round((approved_credentials / total_memberships * 100), 1) if total_memberships > 0 else 0
            },
            'facility_breakdown': facility_breakdown,
            'critical_alerts': critical_alerts[:10],  # Limit to top 10 alerts
            'alerts_count': len(critical_alerts),
            'average_health_score': round(health_stats['avg_health'] or 0, 1)
        })