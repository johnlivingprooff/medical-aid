"""
Provider directory views for comprehensive provider search and management.
"""

from django.db.models import Q, Count, Avg, F
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from drf_spectacular.utils import extend_schema, OpenApiParameter

from accounts.models import ProviderProfile, ProviderNetworkMembership, User
from claims.models import Claim, Invoice
from .serializers import ProviderDirectorySerializer, ProviderDetailSerializer


class ProviderDirectoryView(generics.ListAPIView):
    """
    Comprehensive provider directory with advanced filtering and search.
    """

    serializer_class = ProviderDirectorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['facility_name', 'city', 'user__username', 'user__email']
    ordering_fields = ['facility_name', 'city', 'created_at']
    ordering = ['facility_name']

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name='facility_type',
                type=str,
                description='Filter by facility type (HOSPITAL, CLINIC, PHARMACY, LAB, IMAGING)',
                required=False
            ),
            OpenApiParameter(
                name='city',
                type=str,
                description='Filter by city',
                required=False
            ),
            OpenApiParameter(
                name='scheme_id',
                type=int,
                description='Filter by scheme membership',
                required=False
            ),
            OpenApiParameter(
                name='network_status',
                type=str,
                description='Filter by network status (PENDING, ACTIVE, SUSPENDED)',
                required=False
            ),
            OpenApiParameter(
                name='has_active_contract',
                type=bool,
                description='Filter providers with active contracts',
                required=False
            ),
        ]
    )
    def get_queryset(self):
        """Get filtered queryset of providers with performance metrics."""
        queryset = ProviderProfile.objects.select_related(
            'user'
        ).prefetch_related(
            'user__network_memberships__scheme',
            'user__network_memberships__documents'
        )

        # Apply filters
        facility_type = self.request.query_params.get('facility_type')
        if facility_type:
            queryset = queryset.filter(facility_type=facility_type)

        city = self.request.query_params.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)

        scheme_id = self.request.query_params.get('scheme_id')
        if scheme_id:
            queryset = queryset.filter(
                user__network_memberships__scheme_id=scheme_id,
                user__network_memberships__status='ACTIVE'
            )

        network_status = self.request.query_params.get('network_status')
        if network_status:
            queryset = queryset.filter(
                user__network_memberships__status=network_status
            )

        has_active_contract = self.request.query_params.get('has_active_contract')
        if has_active_contract and has_active_contract.lower() == 'true':
            queryset = queryset.filter(
                user__network_memberships__credential_status='APPROVED',
                user__network_memberships__status='ACTIVE'
            )

        # Add performance metrics annotations
        queryset = queryset.annotate(
            total_claims=Count(
                'user__submitted_claims',
                filter=Q(
                    user__submitted_claims__created_at__gte=timezone.now() - timezone.timedelta(days=90)
                )
            ),
            approved_claims=Count(
                'user__submitted_claims',
                filter=Q(
                    user__submitted_claims__status='APPROVED',
                    user__submitted_claims__created_at__gte=timezone.now() - timezone.timedelta(days=90)
                )
            ),
            total_invoices=Count(
                'user__processed_claims',  # Use processed claims as proxy for invoices
                filter=Q(
                    user__processed_claims__created_at__gte=timezone.now() - timezone.timedelta(days=90)
                )
            ),
            active_network_memberships=Count(
                'user__network_memberships',
                filter=Q(user__network_memberships__status='ACTIVE')
            )
        )

        return queryset.distinct()

    def get_serializer_context(self):
        """Add request context for serializer."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ProviderDetailView(generics.RetrieveAPIView):
    """
    Detailed provider information with performance metrics and network status.
    """

    serializer_class = ProviderDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'user__username'
    lookup_url_kwarg = 'username'

    def get_queryset(self):
        """Get provider with related data."""
        return ProviderProfile.objects.select_related(
            'user'
        ).prefetch_related(
            'user__network_memberships__scheme',
            'user__network_memberships__documents',
            'user__claims_made__patient__scheme',
            'user__invoices__claim'
        )

    def get_serializer_context(self):
        """Add request context for serializer."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ProviderDirectoryStatsView(APIView):
    """
    Provider directory statistics and summary information.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'total_providers': {'type': 'integer'},
                    'active_providers': {'type': 'integer'},
                    'facility_type_breakdown': {
                        'type': 'object',
                        'additionalProperties': {'type': 'integer'}
                    },
                    'city_breakdown': {
                        'type': 'object',
                        'additionalProperties': {'type': 'integer'}
                    },
                    'network_status_breakdown': {
                        'type': 'object',
                        'additionalProperties': {'type': 'integer'}
                    },
                    'top_performing_providers': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'facility_name': {'type': 'string'},
                                'approval_rate': {'type': 'number'},
                                'total_claims': {'type': 'integer'}
                            }
                        }
                    }
                }
            }
        }
    )
    def get(self, request):
        """Get provider directory statistics."""
        # Basic counts
        total_providers = ProviderProfile.objects.count()
        active_providers = ProviderProfile.objects.filter(
            user__network_memberships__status='ACTIVE'
        ).distinct().count()

        # Facility type breakdown
        facility_breakdown = dict(
            ProviderProfile.objects.values('facility_type')
            .annotate(count=Count('id'))
            .values_list('facility_type', 'count')
        )

        # City breakdown (top 10 cities)
        city_breakdown = dict(
            ProviderProfile.objects.values('city')
            .exclude(city='')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
            .values_list('city', 'count')
        )

        # Network status breakdown
        network_breakdown = dict(
            ProviderNetworkMembership.objects.values('status')
            .annotate(count=Count('id'))
            .values_list('status', 'count')
        )

        # Top performing providers (by approval rate, last 90 days)
        ninety_days_ago = timezone.now() - timezone.timedelta(days=90)

        top_providers = ProviderProfile.objects.annotate(
            total_claims=Count(
                'user__claims_made',
                filter=Q(user__claims_made__created_at__gte=ninety_days_ago)
            ),
            approved_claims=Count(
                'user__claims_made',
                filter=Q(
                    user__claims_made__status='APPROVED',
                    user__claims_made__created_at__gte=ninety_days_ago
                )
            )
        ).filter(total_claims__gt=0).annotate(
            approval_rate=F('approved_claims') * 100.0 / F('total_claims')
        ).order_by('-approval_rate', '-total_claims')[:10]

        top_performing = [
            {
                'facility_name': provider.facility_name,
                'approval_rate': round(provider.approval_rate, 2),
                'total_claims': provider.total_claims
            }
            for provider in top_providers
        ]

        return Response({
            'total_providers': total_providers,
            'active_providers': active_providers,
            'facility_type_breakdown': facility_breakdown,
            'city_breakdown': city_breakdown,
            'network_status_breakdown': network_breakdown,
            'top_performing_providers': top_performing
        })


class ProviderNetworkStatusView(APIView):
    """
    Real-time provider network status monitoring.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        """Get network status for a specific provider."""
        try:
            provider_profile = ProviderProfile.objects.select_related('user').get(
                user__username=username
            )
        except ProviderProfile.DoesNotExist:
            return Response(
                {'detail': 'Provider not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all network memberships
        memberships = ProviderNetworkMembership.objects.filter(
            provider=provider_profile.user
        ).select_related('scheme')

        network_status = {
            'provider': {
                'username': provider_profile.user.username,
                'facility_name': provider_profile.facility_name,
                'facility_type': provider_profile.facility_type
            },
            'network_memberships': []
        }

        for membership in memberships:
            # Calculate recent performance metrics
            ninety_days_ago = timezone.now() - timezone.timedelta(days=90)

            recent_claims = Claim.objects.filter(
                provider=provider_profile.user,
                created_at__gte=ninety_days_ago
            )

            approved_claims = recent_claims.filter(status='APPROVED').count()
            total_claims = recent_claims.count()
            approval_rate = (approved_claims / total_claims * 100) if total_claims > 0 else 0

            membership_data = {
                'scheme_name': membership.scheme.name,
                'status': membership.status,
                'credential_status': membership.credential_status,
                'effective_from': membership.effective_from,
                'effective_to': membership.effective_to,
                'documents_count': membership.documents.count(),
                'recent_performance': {
                    'total_claims': total_claims,
                    'approved_claims': approved_claims,
                    'approval_rate': round(approval_rate, 2)
                }
            }
            network_status['network_memberships'].append(membership_data)

        return Response(network_status)