from datetime import datetime, timedelta

from django.db.models import Count, Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema, OpenApiResponse

from claims.models import Claim
from core.models import Alert


class IsAdminOnly(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and getattr(request.user, 'role', None) == 'ADMIN'


class IsAdminOrProvider(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and getattr(request.user, 'role', None) in ('ADMIN', 'PROVIDER')


class AlertsListView(APIView):
    # Allow both ADMIN and PROVIDER to view alerts stream
    permission_classes = [IsAdminOrProvider]

    @extend_schema(responses={200: OpenApiResponse(description='List alerts')})
    def get(self, request):
        qs = Alert.objects.order_by('-created_at')[:200]
        data = [
            {
                'id': a.id,
                'type': a.type,
                'severity': a.severity,
                'message': a.message,
                'patient_id': a.patient_id,
                'created_at': a.created_at,
                'is_read': a.is_read,
            }
            for a in qs
        ]
        return Response({'results': data})


class SchemeUsageReportView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(responses={200: OpenApiResponse(description='Scheme usage report or CSV')})
    def get(self, request):
        # aggregate total claims and amounts by scheme for last 30 days
        since = datetime.utcnow() - timedelta(days=30)
        qs = (
            Claim.objects.filter(date_submitted__gte=since)
            .values('patient__scheme__name')
            .annotate(total_claims=Count('id'), total_amount=Sum('cost'))
            .order_by('-total_amount')
        )
        if request.query_params.get('format') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="scheme_usage.csv"'
            response.write('scheme,total_claims,total_amount\n')
            for row in qs:
                response.write(f"{row['patient__scheme__name']},{row['total_claims']},{row['total_amount']}\n")
            return response
        return Response({'results': list(qs)})


class DiseaseStatsReportView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(responses={200: OpenApiResponse(description='Disease stats report')})
    def get(self, request):
        # Service type statistics
        qs = (
            Claim.objects.values('service_type', 'service_type__name')
            .annotate(total=Count('id'))
            .order_by('-total')
        )
        results = [
            {
                'service_type': row['service_type'],
                'service_type_name': row['service_type__name'],
                'total': row['total']
            }
            for row in qs
        ]
        
        # CSV export support
        if request.query_params.get('format') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="service_type_stats.csv"'
            response.write('service_type_id,service_type_name,total_claims\n')
            for row in results:
                service_name = (row['service_type_name'] or 'Unknown').replace(',', ' ')
                response.write(f"{row['service_type']},{service_name},{row['total']}\n")
            return response
            
        return Response({'results': results})


class DetailedClaimsReportView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(responses={200: OpenApiResponse(description='Detailed claims report with member, scheme, and provider info')})
    def get(self, request):
        # Get detailed claim information
        since = datetime.utcnow() - timedelta(days=30)
        claims = (
            Claim.objects.filter(date_submitted__gte=since)
            .select_related('patient__user', 'patient__scheme', 'provider', 'service_type')
            .order_by('-date_submitted')
        )
        
        # CSV export support
        if request.query_params.get('format') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="detailed_claims_report.csv"'
            response.write('claim_id,member_id,member_name,scheme,provider,service_type,cost,status,date_submitted\n')
            
            for claim in claims:
                # Get member name
                member_name = f"{claim.patient.user.first_name} {claim.patient.user.last_name}".strip()
                if not member_name:
                    member_name = claim.patient.user.username
                member_name = member_name.replace(',', ' ')
                
                # Get scheme name
                scheme_name = (claim.patient.scheme.name if claim.patient.scheme else 'Unknown').replace(',', ' ')
                
                # Get provider facility name or username
                provider_name = getattr(claim.provider, 'facility_name', None) or claim.provider.username
                provider_name = provider_name.replace(',', ' ')
                
                # Get service type name
                service_name = (claim.service_type.name if claim.service_type else 'Unknown').replace(',', ' ')
                
                # Format date
                date_str = claim.date_submitted.strftime('%Y-%m-%d %H:%M:%S') if claim.date_submitted else ''
                
                response.write(
                    f"{claim.id},"
                    f"{claim.patient.member_id},"
                    f"{member_name},"
                    f"{scheme_name},"
                    f"{provider_name},"
                    f"{service_name},"
                    f"{claim.cost},"
                    f"{claim.status},"
                    f"{date_str}\n"
                )
            
            return response
        
        # JSON response for API
        results = [
            {
                'claim_id': claim.id,
                'member_id': claim.patient.member_id,
                'member_name': f"{claim.patient.user.first_name} {claim.patient.user.last_name}".strip() or claim.patient.user.username,
                'scheme': claim.patient.scheme.name if claim.patient.scheme else 'Unknown',
                'provider': getattr(claim.provider, 'facility_name', None) or claim.provider.username,
                'service_type': claim.service_type.name if claim.service_type else 'Unknown',
                'cost': str(claim.cost),
                'status': claim.status,
                'date_submitted': claim.date_submitted
            }
            for claim in claims
        ]
        
        return Response({'results': results})
