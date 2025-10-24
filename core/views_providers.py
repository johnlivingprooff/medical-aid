from datetime import timedelta

from django.db.models import Count, Sum, Avg, F, ExpressionWrapper, DurationField, Q
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiResponse

from claims.models import Claim, Invoice


class IsAdminOnly(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and getattr(request.user, 'role', None) == 'ADMIN'


User = get_user_model()


class ProvidersAnalyticsView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(responses={200: OpenApiResponse(description='Providers ranking and KPIs')})
    def get(self, request):
        # Aggregate per provider, including providers with zero claims
        claims = Claim.objects.select_related('provider')

        totals = (
            claims.values('provider_id')
            .annotate(
                total_claims=Count('id'),
                approved_claims=Count('id', filter=Q(status=Claim.Status.APPROVED)),
                rejected_claims=Count('id', filter=Q(status=Claim.Status.REJECTED)),
                pending_claims=Count('id', filter=Q(status=Claim.Status.PENDING)),
                total_amount=Sum('cost'),
                approved_amount=Sum('cost', filter=Q(status=Claim.Status.APPROVED)),
                pending_amount=Sum('cost', filter=Q(status=Claim.Status.PENDING)),
            )
        )
        totals_map = {row['provider_id']: row for row in totals}

        # All providers with facility name
        providers = list(
            User.objects.filter(role='PROVIDER')
            .select_related('provider_profile')
            .values('id', 'username', 'provider_profile__facility_name')
        )

        inv = (
            Invoice.objects.annotate(
                processing_time=ExpressionWrapper(
                    F('created_at') - F('claim__date_submitted'), output_field=DurationField()
                )
            )
            .values('claim__provider_id')
            .annotate(avg_proc=Avg('processing_time'))
        )
        avg_proc_map = {row['claim__provider_id']: row['avg_proc'] for row in inv}

        results = []
        for p in providers:
            prov_id = p['id']
            stats = totals_map.get(prov_id, {})
            total = stats.get('total_claims') or 0
            approved = stats.get('approved_claims') or 0
            approval_rate = (approved / total) if total else 0.0
            avg_proc = avg_proc_map.get(prov_id)
            avg_days = (avg_proc.total_seconds() / 86400.0) if avg_proc else 0.0
            results.append({
                'provider_id': prov_id,
                'provider': p['provider_profile__facility_name'] or p['username'],
                'total_claims': total,
                'approved_claims': approved,
                'rejected_claims': stats.get('rejected_claims') or 0,
                'pending_claims': stats.get('pending_claims') or 0,
                'total_amount': float(stats.get('total_amount') or 0),
                'approved_amount': float(stats.get('approved_amount') or 0),
                'pending_amount': float(stats.get('pending_amount') or 0),
                'approval_rate': approval_rate,
                'avg_processing_days': round(avg_days, 2),
            })

        results.sort(key=lambda r: r['approved_amount'], reverse=True)
        return Response({'results': results})


class ProviderDetailAnalyticsView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(responses={200: OpenApiResponse(description='Provider detail analytics')})
    def get(self, request, provider_id: int):
        try:
            provider = User.objects.select_related('provider_profile').get(id=provider_id)
        except User.DoesNotExist:
            return Response({'detail': 'Provider not found'}, status=404)

        # Get facility name or fallback to username
        provider_name = (
            provider.provider_profile.facility_name 
            if hasattr(provider, 'provider_profile') and provider.provider_profile 
            else provider.username
        )

        claims = Claim.objects.filter(provider=provider)
        totals = claims.aggregate(
            total_claims=Count('id'),
            approved_claims=Count('id', filter=Q(status=Claim.Status.APPROVED)),
            rejected_claims=Count('id', filter=Q(status=Claim.Status.REJECTED)),
            pending_claims=Count('id', filter=Q(status=Claim.Status.PENDING)),
            total_amount=Sum('cost'),
            approved_amount=Sum('cost', filter=Q(status=Claim.Status.APPROVED)),
            pending_amount=Sum('cost', filter=Q(status=Claim.Status.PENDING)),
        )
        total = totals.get('total_claims') or 0
        approved = totals.get('approved_claims') or 0
        approval_rate = (approved / total) if total else 0.0

        inv = (
            Invoice.objects.filter(claim__provider=provider)
            .annotate(processing_time=ExpressionWrapper(
                F('created_at') - F('claim__date_submitted'), output_field=DurationField()
            ))
            .aggregate(avg_proc=Avg('processing_time'))
        )
        avg_proc = inv.get('avg_proc')
        avg_days = (avg_proc.total_seconds() / 86400.0) if avg_proc else 0.0

        top_services = list(
            claims.values('service_type', 'service_type__name')
            .annotate(count=Count('id'), amount=Sum('cost'))
            .order_by('-amount')[:10]
        )

        recent_claims = list(
            claims.order_by('-date_submitted')[:20]
            .values('id', 'status', 'cost', 'date_submitted', 'patient__user__username')
        )

        return Response({
            'provider_id': provider.id,
            'provider': provider_name,
            'totals': {
                'total_claims': total,
                'approved_claims': approved,
                'rejected_claims': totals.get('rejected_claims') or 0,
                'pending_claims': totals.get('pending_claims') or 0,
                'total_amount': float(totals.get('total_amount') or 0),
                'approved_amount': float(totals.get('approved_amount') or 0),
                'pending_amount': float(totals.get('pending_amount') or 0),
                'approval_rate': approval_rate,
                'avg_processing_days': round(avg_days, 2),
            },
            'top_services': [
                {
                    'service_type': s['service_type'],
                    'service_type_name': s['service_type__name'],
                    'count': s['count'],
                    'amount': float(s['amount'] or 0),
                }
                for s in top_services
            ],
            'recent_claims': [
                {
                    'id': rc['id'],
                    'status': rc['status'],
                    'amount': float(rc['cost']),
                    'date': rc['date_submitted'],
                    'member': rc['patient__user__username'],
                }
                for rc in recent_claims
            ],
        })
