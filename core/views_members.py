from django.db.models import Count, Sum, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiResponse

from claims.models import Claim


class MembersAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description='Members stats and KPIs')})
    def get(self, request):
        # Aggregate per member
        qs = (
            Claim.objects.select_related('patient__user', 'patient__scheme')
            .values('patient', 'patient__user__username', 'patient__scheme__name')
            .annotate(
                total_claims=Count('id'),
                approved_amount=Sum('cost', filter=Q(status=Claim.Status.APPROVED)),
            )
        )
        results = [
            {
                'member_id': row['patient'],
                'member': row['patient__user__username'],
                'scheme': row['patient__scheme__name'],
                'total_claims': row['total_claims'] or 0,
                'approved_amount': float(row['approved_amount'] or 0),
            }
            for row in qs
        ]
        return Response({'results': results})
