from rest_framework import viewsets, permissions
from .models import SchemeCategory, SchemeBenefit, BenefitType
from .serializers import SchemeCategorySerializer, SchemeBenefitSerializer, BenefitTypeSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, F
from claims.models import Patient, Claim


class IsAdmin(permissions.BasePermission):
	def has_permission(self, request, view):
		return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class SchemeCategoryViewSet(viewsets.ModelViewSet):
	queryset = SchemeCategory.objects.all()
	serializer_class = SchemeCategorySerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['name']
	search_fields = ['name', 'description']
	ordering_fields = ['name', 'id']

	def get_permissions(self):
		if self.action in ['create', 'update', 'partial_update', 'destroy']:
			return [IsAdmin()]
		return super().get_permissions()

	@action(detail=True, methods=['get'])
	def details(self, request, pk=None):
		"""Return scheme details: members with join date (user.date_joined), spend last 12 months, next renewal (1 year from join)."""
		scheme = self.get_object()
		# Members list
		# Note: We don't have an explicit join date on Patient; use user.date_joined as proxy
		patients = (
			Patient.objects.select_related('user')
			.filter(scheme=scheme)
			.values('id', 'user__id', 'user__username', 'user__date_joined')
		)
		one_year_ago = timezone.now() - timedelta(days=365)
		# Claims spend per patient in last 12 months (approved only)
		spend_map = {
			row['patient']: float(row['amount'] or 0.0)
			for row in Claim.objects.filter(
				patient__scheme=scheme,
				status=Claim.Status.APPROVED,
				date_submitted__gte=one_year_ago,
			).values('patient').annotate(amount=Sum('cost'))
		}
		members = []
		for p in patients:
			joined = p['user__date_joined']
			# next renewal: 1 year from joined
			try:
				renewal = joined.replace(year=joined.year + 1)
			except Exception:
				from datetime import datetime
				renewal = joined + timedelta(days=365)
			amount_spent = spend_map.get(p['id'], 0.0)
			members.append({
				'id': p['id'],
				'username': p['user__username'],
				'joined': joined,
				'next_renewal': renewal,
				'amount_spent_12m': amount_spent,
			})

		data = SchemeCategorySerializer(scheme).data
		data['members'] = members
		return Response(data)


class SchemeBenefitViewSet(viewsets.ModelViewSet):
	queryset = SchemeBenefit.objects.select_related('scheme').all()
	serializer_class = SchemeBenefitSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['scheme', 'benefit_type', 'coverage_period']
	search_fields = ['scheme__name']
	ordering_fields = ['id', 'coverage_amount']

	def get_permissions(self):
		if self.action in ['create', 'update', 'partial_update', 'destroy']:
			return [IsAdmin()]
		return super().get_permissions()

	def perform_create(self, serializer):
		instance = serializer.save()
		self._recalc_scheme_price(instance.scheme_id)

	def perform_update(self, serializer):
		instance = serializer.save()
		self._recalc_scheme_price(instance.scheme_id)

	def perform_destroy(self, instance):
		scheme_id = instance.scheme_id
		instance.delete()
		self._recalc_scheme_price(scheme_id)

	def _recalc_scheme_price(self, scheme_id: int):
		from django.db.models import F, Sum, Value
		from django.db.models.functions import Coalesce
		total = (
			SchemeBenefit.objects.filter(scheme_id=scheme_id)
			.annotate(final=F('coverage_amount') * Coalesce(F('coverage_limit_count'), Value(1)))
			.aggregate(total=Sum('final'))['total']
			or 0
		)
		SchemeCategory.objects.filter(id=scheme_id).update(price=total)


class BenefitTypeViewSet(viewsets.ModelViewSet):
	queryset = BenefitType.objects.all()
	serializer_class = BenefitTypeSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['name']
	search_fields = ['name']
	ordering_fields = ['name', 'id']

	def get_permissions(self):
		if self.action in ['create', 'update', 'partial_update', 'destroy']:
			return [IsAdmin()]
		return super().get_permissions()
