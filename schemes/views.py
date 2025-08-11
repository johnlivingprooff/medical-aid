from rest_framework import viewsets, permissions
from .models import SchemeCategory, SchemeBenefit
from .serializers import SchemeCategorySerializer, SchemeBenefitSerializer


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
