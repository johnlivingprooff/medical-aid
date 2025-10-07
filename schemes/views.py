from rest_framework import viewsets, permissions
from .models import (
    SchemeCategory, SchemeBenefit, BenefitType, BenefitCategory,
    SubscriptionTier, MemberSubscription, PaymentMethod, Invoice,
    Payment, BillingHistory
)
from .serializers import (
    SchemeCategorySerializer, SchemeBenefitSerializer, BenefitTypeSerializer,
    BenefitCategorySerializer, SubscriptionTierSerializer, MemberSubscriptionSerializer,
    SubscriptionCreateSerializer, PaymentMethodSerializer, InvoiceSerializer,
    PaymentSerializer, BillingHistorySerializer, PaymentProcessingSerializer,
    BillingSummarySerializer
)
from .subscription_service import SubscriptionService
from .billing_service import BillingService
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, F
from django.core.exceptions import ValidationError
from .services_deletion import SchemeDeletionService
from .models_audit import SchemeAuditLog
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


	@action(detail=True, methods=['get'], url_path='deletion-impact')
	def deletion_impact(self, request, pk=None):
		"""Get deletion impact assessment for a scheme"""
		scheme = self.get_object()
		# Only admins can check deletion impact
		if not (request.user and request.user.is_authenticated and request.user.role == 'ADMIN'):
			return Response(
				{'error': 'Admin access required'},
				status=status.HTTP_403_FORBIDDEN
			)
		try:
			deletion_service = SchemeDeletionService(user=request.user, request=request)
			impact_data = deletion_service.validate_deletion_eligibility(scheme)
			return Response({
				'scheme': {
					'id': scheme.id,
					'name': scheme.name,
					'description': scheme.description
				},
				'impact': impact_data
			})
		except Exception as e:
			return Response(
				{'error': f'Failed to assess deletion impact: {str(e)}'},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)

	@action(detail=True, methods=['post'], url_path='delete-scheme')
	def delete_scheme(self, request, pk=None):
		"""Securely delete a scheme with confirmation"""
		scheme = self.get_object()
		# Only admins can delete schemes
		if not (request.user and request.user.is_authenticated and request.user.role == 'ADMIN'):
			return Response(
				{'error': 'Admin access required'},
				status=status.HTTP_403_FORBIDDEN
			)
		# Get confirmation text from request
		confirmation_text = request.data.get('confirmation_text', '').strip()
		if not confirmation_text:
			return Response(
				{'error': 'confirmation_text is required'},
				status=status.HTTP_400_BAD_REQUEST
			)
		try:
			deletion_service = SchemeDeletionService(user=request.user, request=request)
			result = deletion_service.perform_safe_deletion(scheme, confirmation_text)
			return Response(result, status=status.HTTP_200_OK)
		except ValidationError as e:
			return Response(
				{'error': str(e)},
				status=status.HTTP_400_BAD_REQUEST
			)
		except Exception as e:
			return Response(
				{'error': f'Deletion failed: {str(e)}'},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)
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


# Billing ViewSets

class PaymentMethodViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payment methods"""

    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['payment_type', 'is_default', 'is_active']
    ordering_fields = ['-is_default', '-created_at']

    def get_queryset(self):
        """Return payment methods for the current user"""
        return PaymentMethod.objects.filter(member=self.request.user.patient_profile)

    def perform_create(self, serializer):
        """Set the member to the current user's patient profile"""
        serializer.save(member=self.request.user.patient_profile)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this payment method as the default"""
        payment_method = self.get_object()
        payment_method.is_default = True
        payment_method.save()

        # Ensure only one default payment method
        PaymentMethod.objects.filter(
            member=payment_method.member
        ).exclude(pk=payment_method.pk).update(is_default=False)

        return Response({'message': 'Payment method set as default'})


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing invoices"""

    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'issued_date', 'due_date', 'paid_date']
    search_fields = ['invoice_number']
    ordering_fields = ['-issued_date', 'due_date']

    def get_queryset(self):
        """Filter invoices based on user role"""
        user = self.request.user

        if user.role == 'ADMIN':
            return Invoice.objects.all().select_related(
                'subscription', 'subscription__member', 'payment_method'
            )
        elif hasattr(user, 'patient_profile'):
            return Invoice.objects.filter(
                subscription__member=user.patient_profile
            ).select_related('subscription', 'payment_method')
        else:
            return Invoice.objects.none()

    @action(detail=True, methods=['post'])
    def send_invoice(self, request, pk=None):
        """Mark invoice as sent"""
        invoice = self.get_object()
        if invoice.status == 'DRAFT':
            invoice.status = 'SENT'
            invoice.save()
            return Response({'message': 'Invoice marked as sent'})
        return Response(
            {'error': 'Invoice is not in draft status'},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue invoices"""
        overdue_invoices = BillingService.check_overdue_invoices()
        serializer = self.get_serializer(overdue_invoices, many=True)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payments"""

    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'payment_method', 'payment_date']
    search_fields = ['payment_id', 'transaction_id']
    ordering_fields = ['-payment_date', '-created_at']

    def get_queryset(self):
        """Filter payments based on user role"""
        user = self.request.user

        if user.role == 'ADMIN':
            return Payment.objects.all().select_related('invoice', 'invoice__subscription')
        elif hasattr(user, 'patient_profile'):
            return Payment.objects.filter(
                invoice__subscription__member=user.patient_profile
            ).select_related('invoice', 'invoice__subscription')
        else:
            return Payment.objects.none()

    @action(detail=True, methods=['post'])
    def process_refund(self, request, pk=None):
        """Process a refund for a payment"""
        payment = self.get_object()
        refund_amount = request.data.get('amount')

        if not refund_amount:
            return Response(
                {'error': 'Refund amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not payment.can_refund:
            return Response(
                {'error': 'Payment cannot be refunded'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refund_amount = float(refund_amount)
            if refund_amount > (payment.amount - payment.refund_amount):
                return Response(
                    {'error': 'Refund amount exceeds available amount'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {'error': 'Invalid refund amount'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process refund (in real implementation, integrate with payment gateway)
        payment.refund_amount += refund_amount
        payment.refund_date = timezone.now()
        payment.refund_reason = request.data.get('reason', '')
        payment.save()

        return Response({'message': 'Refund processed successfully'})


class BillingHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing billing history"""

    serializer_class = BillingHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['action', 'timestamp']
    ordering_fields = ['-timestamp']

    def get_queryset(self):
        """Filter billing history based on user role"""
        user = self.request.user

        if user.role == 'ADMIN':
            return BillingHistory.objects.all().select_related(
                'subscription', 'invoice', 'payment', 'performed_by'
            )
        elif hasattr(user, 'patient_profile'):
            return BillingHistory.objects.filter(
                subscription__member=user.patient_profile
            ).select_related('subscription', 'invoice', 'payment', 'performed_by')
        else:
            return BillingHistory.objects.none()


class BillingManagementViewSet(viewsets.ViewSet):
    """ViewSet for billing management operations"""

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def process_payment(self, request):
        """Process a payment for an invoice"""
        serializer = PaymentProcessingSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        invoice = serializer.validated_data['invoice_id']
        payment_method = serializer.validated_data['payment_method_id']
        payment_data = serializer.validated_data.get('payment_data', {})

        success, message, payment = BillingService.process_payment(
            invoice, payment_method, payment_data
        )

        if success:
            payment_serializer = PaymentSerializer(payment)
            return Response({
                'message': message,
                'payment': payment_serializer.data
            })
        else:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def generate_invoice(self, request):
        """Generate an invoice for a subscription"""
        subscription_id = request.data.get('subscription_id')
        billing_start_date = request.data.get('billing_start_date')
        billing_end_date = request.data.get('billing_end_date')
        notes = request.data.get('notes', '')

        if not subscription_id:
            return Response(
                {'error': 'subscription_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            subscription = MemberSubscription.objects.get(id=subscription_id)
        except MemberSubscription.DoesNotExist:
            return Response(
                {'error': 'Subscription not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permissions
        if (not request.user.role == 'ADMIN' and
            subscription.member != request.user.patient_profile):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        invoice = BillingService.generate_invoice(
            subscription, billing_start_date, billing_end_date, notes
        )

        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def billing_summary(self, request):
        """Get billing summary for current user"""
        if not hasattr(request.user, 'patient_profile'):
            return Response(
                {'error': 'Patient profile not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get active subscription
        subscription = MemberSubscription.objects.filter(
            member=request.user.patient_profile,
            status='ACTIVE'
        ).first()

        if not subscription:
            return Response({'error': 'No active subscription found'})

        summary = BillingService.get_subscription_billing_summary(subscription)
        serializer = BillingSummarySerializer(summary)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def cancel_subscription(self, request):
        """Cancel a subscription"""
        subscription_id = request.data.get('subscription_id')
        cancel_date = request.data.get('cancel_date')
        refund_prorated = request.data.get('refund_prorated', True)

        if not subscription_id:
            return Response(
                {'error': 'subscription_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            subscription = MemberSubscription.objects.get(id=subscription_id)
        except MemberSubscription.DoesNotExist:
            return Response(
                {'error': 'Subscription not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permissions
        if (not request.user.role == 'ADMIN' and
            subscription.member != request.user.patient_profile):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        success, message = BillingService.cancel_subscription(
            subscription, cancel_date, refund_prorated
        )

        if success:
            return Response({'message': message})
        else:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], permission_classes=[IsAdmin])
    def process_bulk_renewals(self, request):
        """Process bulk renewals (admin only)"""
        results = BillingService.process_bulk_renewals()
        return Response(results)
