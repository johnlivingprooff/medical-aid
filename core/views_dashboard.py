from datetime import datetime, timedelta

from django.db.models import Count, Sum, Avg, F, ExpressionWrapper, DurationField
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiResponse

from claims.models import Claim, Invoice, Patient


class IsAdminOnly(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and getattr(request.user, 'role', None) == 'ADMIN'


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description='Dashboard KPIs and snapshots')})
    def get(self, request):
        since = datetime.utcnow() - timedelta(days=30)
        role = getattr(request.user, 'role', None)
        # Scope queryset based on role
        if role == 'PATIENT':
            claims_period = Claim.objects.filter(date_submitted__gte=since, patient__user=request.user)
        elif role == 'PROVIDER':
            claims_period = Claim.objects.filter(date_submitted__gte=since, provider=request.user)
        else:
            # ADMIN and others default to all
            claims_period = Claim.objects.filter(date_submitted__gte=since)

        total_claims = claims_period.count()
        approved_amount = claims_period.filter(status=Claim.Status.APPROVED).aggregate(a=Sum('cost'))['a'] or 0
        pending_amount = claims_period.filter(status=Claim.Status.PENDING).aggregate(a=Sum('cost'))['a'] or 0
        total_amount = claims_period.aggregate(a=Sum('cost'))['a'] or 0

        utilization_rate = float(approved_amount) / float(total_amount) if total_amount else 0.0

        approved_with_invoice = Invoice.objects.filter(
            claim__status=Claim.Status.APPROVED,
            claim__date_submitted__gte=since,
        ).annotate(
            processing_time=ExpressionWrapper(
                F('created_at') - F('claim__date_submitted'), output_field=DurationField()
            )
        )
        avg_processing = approved_with_invoice.aggregate(a=Avg('processing_time'))['a']
        avg_processing_days = (avg_processing.total_seconds() / 86400.0) if avg_processing else 0.0

        status_counts = (
            claims_period.values('status').annotate(count=Count('id'), amount=Sum('cost')).order_by()
        )
        status_map = {row['status']: {'count': row['count'], 'amount': float(row['amount'] or 0)} for row in status_counts}

        # Active members depends on role
        if role == 'PATIENT':
            active_members = 1
        else:
            active_members = Patient.objects.filter(user__is_active=True).count()

        scheme_utilization = list(
            claims_period.filter(status=Claim.Status.APPROVED)
            .values('patient__scheme__name')
            .annotate(total_amount=Sum('cost'), total_claims=Count('id'))
            .order_by('-total_amount')[:10]
        )

        return Response({
            'kpis': {
                'active_members': active_members,
                'total_claims_period': total_claims,
                'claim_value_approved': float(approved_amount),
                'pending_claim_value': float(pending_amount),
                'utilization_rate': utilization_rate,
                'avg_processing_days': round(avg_processing_days, 2),
            },
            'status_snapshot': status_map,
            'scheme_utilization': scheme_utilization,
        })


class ActivityFeedView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description='Recent activity feed')})
    def get(self, request):
        role = getattr(request.user, 'role', None)
        qs = Claim.objects.order_by('-date_submitted')
        if role == 'PATIENT':
            qs = qs.filter(patient__user=request.user)
        elif role == 'PROVIDER':
            qs = qs.filter(provider=request.user)
        recent_claims = list(
            qs[:20].values('id', 'patient__user__username', 'provider__username', 'status', 'cost', 'date_submitted')
        )
        claim_events = [
            {
                'type': 'CLAIM_SUBMITTED',
                'title': 'Claim submitted',
                'member': rc['patient__user__username'],
                'provider': rc['provider__username'],
                'status': rc['status'],
                'amount': float(rc['cost']),
                'timestamp': rc['date_submitted'],
                'id': rc['id'],
            }
            for rc in recent_claims
        ]

        inv_qs = Invoice.objects.order_by('-created_at')
        if role == 'PATIENT':
            inv_qs = inv_qs.filter(claim__patient__user=request.user)
        elif role == 'PROVIDER':
            inv_qs = inv_qs.filter(claim__provider=request.user)
        recent_invoices = list(
            inv_qs[:20].values('claim_id', 'created_at', 'amount', 'claim__patient__user__username', 'claim__provider__username')
        )
        approval_events = [
            {
                'type': 'CLAIM_APPROVED',
                'title': 'Claim approved',
                'member': ri['claim__patient__user__username'],
                'provider': ri['claim__provider__username'],
                'amount': float(ri['amount']),
                'timestamp': ri['created_at'],
                'id': ri['claim_id'],
            }
            for ri in recent_invoices
        ]

        events = claim_events + approval_events
        events.sort(key=lambda e: e['timestamp'], reverse=True)
        return Response({'results': events[:30]})
