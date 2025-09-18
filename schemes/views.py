from rest_framework import viewsets, permissions
from .models import SchemeCategory, SchemeBenefit, BenefitType, BenefitCategory, SubscriptionTier, MemberSubscription
from .serializers import (
    SchemeCategorySerializer, SchemeBenefitSerializer, BenefitTypeSerializer,
    BenefitCategorySerializer, SubscriptionTierSerializer, MemberSubscriptionSerializer,
    SubscriptionCreateSerializer
)
from .subscription_service import SubscriptionService
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, F
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from claims.models import Patient, Claim
from backend.pagination import OptimizedPagination


class IsAdmin(permissions.BasePermission):
	def has_permission(self, request, view):
		return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class IsProviderOrReadOnlyForAuthenticated(permissions.BasePermission):
    """Allow providers to read, admins to write"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class BenefitCategoryViewSet(viewsets.ModelViewSet):
    queryset = BenefitCategory.objects.all()
    serializer_class = BenefitCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['name', 'subscription_required']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'id']
    pagination_class = OptimizedPagination

    @method_decorator(cache_page(600))  # Cache for 10 minutes
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @method_decorator(cache_page(600))  # Cache for 10 minutes
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return super().get_permissions()


class SubscriptionTierViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionTier.objects.select_related('scheme').all()
    serializer_class = SubscriptionTierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['scheme', 'tier_type', 'is_active']
    search_fields = ['name', 'description', 'scheme__name']
    pagination_class = OptimizedPagination

    @method_decorator(cache_page(600))  # Cache for 10 minutes
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @method_decorator(cache_page(600))  # Cache for 10 minutes
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)
    ordering_fields = ['sort_order', 'monthly_price', 'name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return super().get_permissions()

    @action(detail=False, methods=['get'])
    def available(self, request):
        """Get available subscription tiers for a scheme"""
        scheme_id = request.query_params.get('scheme_id')
        if not scheme_id:
            return Response(
                {'error': 'scheme_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tiers = SubscriptionService.get_available_tiers(int(scheme_id))
        serializer = self.get_serializer(tiers, many=True)
        return Response(serializer.data)


class MemberSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = MemberSubscription.objects.select_related('patient__user', 'tier__scheme').all()
    serializer_class = MemberSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'subscription_type', 'tier', 'patient']
    search_fields = ['patient__member_id', 'patient__user__username', 'tier__name']
    ordering_fields = ['created_at', 'start_date', 'end_date']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [IsProviderOrReadOnlyForAuthenticated()]

    def get_queryset(self):
        """Filter subscriptions based on user role"""
        queryset = super().get_queryset()
        user = self.request.user

        if user.role == 'PATIENT':
            # Patients can only see their own subscription
            try:
                patient = user.patient_profile
                return queryset.filter(patient=patient)
            except:
                return queryset.none()
        elif user.role == 'PROVIDER':
            # Providers can see subscriptions for patients they serve
            # For now, return all (this could be filtered by provider's patients)
            return queryset

        return queryset  # Admin sees all

    @action(detail=False, methods=['post'])
    def create_subscription(self, request):
        """Create a new subscription for a patient"""
        serializer = SubscriptionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            patient = Patient.objects.get(id=serializer.validated_data['patient_id'])
            tier = serializer.validated_data['tier_id']
            subscription_type = serializer.validated_data['subscription_type']
            start_date = serializer.validated_data.get('start_date')

            subscription = SubscriptionService.create_subscription(
                patient=patient,
                tier=tier,
                subscription_type=subscription_type,
                start_date=start_date
            )

            response_serializer = self.get_serializer(subscription)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except Patient.DoesNotExist:
            return Response(
                {'error': 'Patient not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def upgrade(self, request, pk=None):
        """Upgrade a subscription to a new tier"""
        subscription = self.get_object()
        new_tier_id = request.data.get('new_tier_id')

        if not new_tier_id:
            return Response(
                {'error': 'new_tier_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_tier = SubscriptionTier.objects.get(id=new_tier_id, is_active=True)
            updated_subscription = SubscriptionService.upgrade_subscription(subscription, new_tier)
            serializer = self.get_serializer(updated_subscription)
            return Response(serializer.data)
        except SubscriptionTier.DoesNotExist:
            return Response(
                {'error': 'Subscription tier not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        """Get usage statistics for a subscription"""
        subscription = self.get_object()
        usage_stats = SubscriptionService.get_subscription_usage(subscription)
        return Response(usage_stats)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get subscription analytics"""
        from .subscription_service import SubscriptionAnalytics
        scheme_id = request.query_params.get('scheme_id')
        metrics = SubscriptionAnalytics.get_subscription_metrics(
            scheme_id=int(scheme_id) if scheme_id else None
        )
        return Response(metrics)


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
