from datetime import timedelta

from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions

from schemes.models import SchemeCategory
from claims.models import Claim, Patient


class SchemesOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        window_start = now - timedelta(days=30)

        schemes = list(SchemeCategory.objects.all().values('id', 'name', 'description'))

        # Members per scheme
        members = (
            Patient.objects.values('scheme').annotate(count=Count('id'))
        )
        members_map = {m['scheme']: m['count'] for m in members}

        # Totals per scheme last 30d
        totals = (
            Claim.objects.filter(date_submitted__gte=window_start)
            .values('patient__scheme', 'patient__scheme__name')
            .annotate(total_amount=Sum('cost'), total_claims=Count('id'))
        )
        totals_map = {t['patient__scheme']: t for t in totals}

        # Breakdown by service type per scheme last 30d
        breakdown = (
            Claim.objects.filter(date_submitted__gte=window_start)
            .values('patient__scheme', 'service_type__name')
            .annotate(amount=Sum('cost'))
        )
        breakdown_map: dict[int, dict[str, float]] = {}
        for row in breakdown:
            sid = row['patient__scheme']
            bt = row['service_type__name'] or 'OTHER'
            breakdown_map.setdefault(sid, {})[bt] = float(row['amount'] or 0.0)

        # Compute utilization share per scheme (share of total amount across schemes)
        grand_total = sum(float(v.get('total_amount') or 0.0) for v in totals_map.values()) or 0.0

        results = []
        for s in schemes:
            sid = s['id']
            tot = totals_map.get(sid, {})
            total_amount = float(tot.get('total_amount') or 0.0)
            total_claims = int(tot.get('total_claims') or 0)
            members_count = int(members_map.get(sid, 0))
            # utilization% as share of total amount
            utilization = (total_amount / grand_total * 100.0) if grand_total > 0 else 0.0
            # breakdown percentages within scheme
            bmap = breakdown_map.get(sid, {})
            scheme_total = sum(bmap.values()) or 0.0
            breakdown_list = []
            for name, amount in sorted(bmap.items(), key=lambda x: -x[1])[:4]:
                pct = (amount / scheme_total * 100.0) if scheme_total > 0 else 0.0
                breakdown_list.append({'name': name, 'percent': pct})

            results.append({
                'id': sid,
                'name': s['name'],
                'description': s.get('description') or '',
                'members_count': members_count,
                'total_amount_30d': total_amount,
                'total_claims_30d': total_claims,
                'utilization_percent': utilization,
                'breakdown': breakdown_list,
            })

        return Response(results)
