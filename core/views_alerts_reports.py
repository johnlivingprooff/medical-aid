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


class AlertsListView(APIView):
    permission_classes = [IsAdminOnly]

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
        # naive disease stats from diagnoses text (placeholder)
        qs = (
            Claim.objects.values('service_type')
            .annotate(total=Count('id'))
            .order_by('-total')
        )
        return Response({'results': list(qs)})
