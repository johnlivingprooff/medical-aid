from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Patient, Claim, Invoice
from .serializers import PatientSerializer, ClaimSerializer, InvoiceSerializer
from .services import validate_and_process_claim, emit_low_balance_alerts, emit_fraud_alert_if_needed
from schemes.models import SchemeBenefit


class IsProviderOrReadOnlyForAuthenticated(permissions.BasePermission):
	def has_permission(self, request, view):
		user = request.user
		if not (user and user.is_authenticated):
			return False
		# Allow reads for any authenticated user
		if request.method in permissions.SAFE_METHODS:
			return True
		# Special-case viewset actions when available
		action = getattr(view, 'action', None)
		if action in ('list', 'retrieve'):
			return True
		if action == 'validate':
			return getattr(user, 'role', None) in ['PROVIDER', 'ADMIN']
		# Writes require provider or admin
		return getattr(user, 'role', None) in ['PROVIDER', 'ADMIN']


class IsAdmin(permissions.BasePermission):
	def has_permission(self, request, view):
		return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'ADMIN')


class PatientViewSet(viewsets.ModelViewSet):
	queryset = Patient.objects.select_related('user', 'scheme').all()
	serializer_class = PatientSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['scheme', 'gender']
	search_fields = ['user__username']

	def get_queryset(self):
		user = self.request.user
		qs = super().get_queryset()
		if getattr(user, 'role', None) == 'PATIENT':
			return qs.filter(user=user)
		return qs

	def get_permissions(self):
		# Only admins can create/update/destroy
		if self.action in ['create', 'update', 'partial_update', 'destroy']:
			return [IsAdmin()]
		return super().get_permissions()

	# No extra actions needed: use PATCH /api/patients/:id/ with payload like { "status": "SUSPENDED" } or { "first_name": "…", "last_name": "…", "scheme": <id> }

	@action(detail=True, methods=['get'], url_path='coverage-balance')
	def coverage_balance(self, request, pk=None):
		patient = self.get_object()
		benefits = SchemeBenefit.objects.filter(scheme=patient.scheme, is_active=True)
		from django.db.models import Sum
		data = []
		for b in benefits:
			# compute period start using enhanced logic
			from .services import _period_start
			from django.utils import timezone as djtz
			start = _period_start(b.coverage_period, djtz.now(), patient)
			approved_qs = Claim.objects.filter(
				patient=patient,
				service_type=b.benefit_type,
				status=Claim.Status.APPROVED,
				date_submitted__gte=start,
			)
			used_amount = float(approved_qs.aggregate(total=Sum('cost'))['total'] or 0.0)
			remaining_amount = float(b.coverage_amount) - used_amount if b.coverage_amount is not None else None
			remaining_count = None
			if b.coverage_limit_count is not None:
				used_count = approved_qs.count()
				remaining_count = max(b.coverage_limit_count - used_count, 0)
			data.append({
				'benefit_type': b.benefit_type.id,
				'benefit_type_name': b.benefit_type.name,
				'coverage_amount': float(b.coverage_amount) if b.coverage_amount is not None else None,
				'used_amount': used_amount,
				'remaining_amount': remaining_amount,
				'coverage_limit_count': b.coverage_limit_count,
				'remaining_count': remaining_count,
				'coverage_period': b.coverage_period,
				'deductible_amount': float(b.deductible_amount),
				'copayment_percentage': float(b.copayment_percentage),
				'copayment_fixed': float(b.copayment_fixed),
				'requires_preauth': b.requires_preauth,
				'waiting_period_days': b.waiting_period_days,
				'network_only': b.network_only,
			})
		return Response({'scheme': patient.scheme.name, 'balances': data})


class ClaimViewSet(viewsets.ModelViewSet):
	queryset = Claim.objects.select_related('patient__user', 'provider').all()
	serializer_class = ClaimSerializer
	permission_classes = [IsProviderOrReadOnlyForAuthenticated]
	filterset_fields = {
		'status': ['exact', 'in'],
		'coverage_checked': ['exact'],
		'patient__scheme': ['exact'],
		'provider': ['exact'],
		'date_submitted': ['gte', 'lte', 'date', 'date__gte', 'date__lte'],
		'cost': ['gte', 'lte'],
		'service_type': ['exact', 'in'],
	}
	search_fields = ['service_type__name', 'patient__user__username', 'provider__username']

	def perform_create(self, serializer):
		claim = serializer.save(provider=self.request.user)
		
		# Set date_of_service if not provided (default to submission date)
		if not claim.date_of_service:
			claim.date_of_service = claim.date_submitted.date()
			claim.save(update_fields=['date_of_service'])
		
		approved, payable, reason = validate_and_process_claim(claim)
		if approved:
			claim.status = Claim.Status.APPROVED
			claim.coverage_checked = True
			claim.processed_date = claim.date_submitted
			claim.processed_by = self.request.user
			claim.save(update_fields=['status', 'coverage_checked', 'processed_date', 'processed_by'])
			
			# Create invoice with detailed breakdown
			from decimal import Decimal
			try:
				benefit = SchemeBenefit.objects.get(scheme=claim.patient.scheme, benefit_type=claim.service_type)
				
				# Calculate patient responsibility components
				claim_amount = Decimal(str(claim.cost))
				deductible = min(Decimal(str(benefit.deductible_amount or 0)), claim_amount)
				after_deductible = claim_amount - deductible
				
				copay_fixed = Decimal(str(benefit.copayment_fixed or 0))
				copay_percentage = Decimal(str(benefit.copayment_percentage or 0))
				copay_percent_amount = after_deductible * (copay_percentage / 100)
				total_copay = copay_fixed + copay_percent_amount
				
				Invoice.objects.create(
					claim=claim, 
					amount=payable,
					patient_deductible=deductible,
					patient_copay=total_copay,
					patient_coinsurance=0  # Could be enhanced later
				)
			except SchemeBenefit.DoesNotExist:
				Invoice.objects.create(claim=claim, amount=payable)
			
			# emit alerts for low balance and fraud checks
			try:
				benefit = SchemeBenefit.objects.get(scheme=claim.patient.scheme, benefit_type=claim.service_type)
			except SchemeBenefit.DoesNotExist:
				benefit = None
			if benefit and benefit.coverage_amount is not None:
				# naive remaining after approval
				from django.db.models import Sum
				approved_qs = Claim.objects.filter(
					patient=claim.patient,
					service_type=claim.service_type,
					status=Claim.Status.APPROVED,
				)
				used_amount = float(approved_qs.aggregate(total=Sum("cost"))['total'] or 0.0)
				remaining_after = float(benefit.coverage_amount) - used_amount
				remaining_count = None
				if benefit.coverage_limit_count is not None:
					remaining_count = max(benefit.coverage_limit_count - approved_qs.count(), 0)
				emit_low_balance_alerts(claim, benefit, remaining_after, remaining_count)
			emit_fraud_alert_if_needed(claim)
		else:
			claim.status = Claim.Status.REJECTED
			claim.coverage_checked = True
			claim.rejection_reason = reason
			claim.rejection_date = claim.date_submitted
			claim.processed_by = self.request.user
			claim.save(update_fields=['status', 'coverage_checked', 'rejection_reason', 'rejection_date', 'processed_by'])

	def create(self, request, *args, **kwargs):
		response = super().create(request, *args, **kwargs)
		# Include latest claim detail
		return response

	def get_queryset(self):
		user = self.request.user
		qs = super().get_queryset()
		role = getattr(user, 'role', None)
		if role == 'ADMIN':
			return qs
		if role == 'PROVIDER':
			return qs.filter(provider=user)
		if role == 'PATIENT':
			return qs.filter(patient__user=user)
		return qs.none()

	@action(detail=False, methods=['post'], url_path='validate')
	def validate_claim(self, request):
		# expects: patient, service_type, cost
		try:
			patient_id = request.data['patient']
			service_type = request.data['service_type']
			cost = request.data['cost']
		except KeyError:
			return Response({'detail': 'patient, service_type, cost required'}, status=status.HTTP_400_BAD_REQUEST)
		try:
			patient = Patient.objects.get(id=patient_id)
		except Patient.DoesNotExist:
			return Response({'detail': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)
		temp_claim = Claim(patient=patient, provider=request.user, service_type=service_type, cost=cost)
		approved, payable, reason = validate_and_process_claim(temp_claim)
		return Response({'approved': approved, 'payable': payable, 'reason': reason})

	@action(detail=True, methods=['post'], url_path='approve')
	def approve_claim(self, request, pk=None):
		"""Approve a claim - only providers and admins can do this"""
		claim = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions - only provider who received the claim or admin can approve
		if role == 'PROVIDER' and claim.provider != user:
			return Response({'detail': 'You can only approve claims submitted to you'}, status=status.HTTP_403_FORBIDDEN)
		elif role not in ['PROVIDER', 'ADMIN']:
			return Response({'detail': 'Only providers and admins can approve claims'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if claim can be approved
		if claim.status not in [Claim.Status.PENDING, Claim.Status.INVESTIGATING, Claim.Status.REQUIRES_PREAUTH]:
			return Response({'detail': f'Cannot approve claim with status: {claim.status}'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Validate claim coverage before approval
		approved, payable, reason = validate_and_process_claim(claim)
		if not approved:
			return Response({
				'detail': 'Claim validation failed',
				'reason': reason,
				'approved': False
			}, status=status.HTTP_400_BAD_REQUEST)
		
		# Approve the claim
		from django.utils import timezone
		claim.status = Claim.Status.APPROVED
		claim.coverage_checked = True
		claim.processed_date = timezone.now()
		claim.processed_by = user
		claim.save(update_fields=['status', 'coverage_checked', 'processed_date', 'processed_by'])
		
		# Create invoice if approved
		from decimal import Decimal
		try:
			benefit = SchemeBenefit.objects.get(scheme=claim.patient.scheme, benefit_type=claim.service_type)
			
			# Calculate patient responsibility components
			claim_amount = Decimal(str(claim.cost))
			deductible = min(Decimal(str(benefit.deductible_amount or 0)), claim_amount)
			after_deductible = claim_amount - deductible
			
			copay_fixed = Decimal(str(benefit.copayment_fixed or 0))
			copay_percentage = Decimal(str(benefit.copayment_percentage or 0))
			copay_percent_amount = after_deductible * (copay_percentage / 100)
			total_copay = copay_fixed + copay_percent_amount
			
			invoice, created = Invoice.objects.get_or_create(
				claim=claim,
				defaults={
					'amount': payable,
					'patient_deductible': deductible,
					'patient_copay': total_copay,
					'patient_coinsurance': 0
				}
			)
		except SchemeBenefit.DoesNotExist:
			invoice, created = Invoice.objects.get_or_create(
				claim=claim,
				defaults={'amount': payable}
			)
		
		# Emit alerts for low balance and fraud checks
		try:
			benefit = SchemeBenefit.objects.get(scheme=claim.patient.scheme, benefit_type=claim.service_type)
		except SchemeBenefit.DoesNotExist:
			benefit = None
		if benefit and benefit.coverage_amount is not None:
			from django.db.models import Sum
			approved_qs = Claim.objects.filter(
				patient=claim.patient,
				service_type=claim.service_type,
				status=Claim.Status.APPROVED,
			)
			used_amount = float(approved_qs.aggregate(total=Sum("cost"))['total'] or 0.0)
			remaining_after = float(benefit.coverage_amount) - used_amount
			remaining_count = None
			if benefit.coverage_limit_count is not None:
				remaining_count = max(benefit.coverage_limit_count - approved_qs.count(), 0)
			emit_low_balance_alerts(claim, benefit, remaining_after, remaining_count)
		emit_fraud_alert_if_needed(claim)
		
		serializer = self.get_serializer(claim)
		return Response({
			'detail': 'Claim approved successfully',
			'claim': serializer.data,
			'invoice_created': created if 'created' in locals() else False
		})

	@action(detail=True, methods=['post'], url_path='reject')
	def reject_claim(self, request, pk=None):
		"""Reject a claim - only providers and admins can do this"""
		claim = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions - only provider who received the claim or admin can reject
		if role == 'PROVIDER' and claim.provider != user:
			return Response({'detail': 'You can only reject claims submitted to you'}, status=status.HTTP_403_FORBIDDEN)
		elif role not in ['PROVIDER', 'ADMIN']:
			return Response({'detail': 'Only providers and admins can reject claims'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if claim can be rejected
		if claim.status in [Claim.Status.APPROVED, Claim.Status.REJECTED]:
			return Response({'detail': f'Cannot reject claim with status: {claim.status}'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Get rejection reason from request
		rejection_reason = request.data.get('reason', 'No reason provided')
		
		# Reject the claim
		from django.utils import timezone
		claim.status = Claim.Status.REJECTED
		claim.coverage_checked = True
		claim.rejection_reason = rejection_reason
		claim.rejection_date = timezone.now()
		claim.processed_by = user
		claim.save(update_fields=['status', 'coverage_checked', 'rejection_reason', 'rejection_date', 'processed_by'])
		
		serializer = self.get_serializer(claim)
		return Response({
			'detail': 'Claim rejected successfully',
			'claim': serializer.data
		})

	@action(detail=True, methods=['post'], url_path='investigate')
	def investigate_claim(self, request, pk=None):
		"""Mark claim for investigation - only providers and admins"""
		claim = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions
		if role == 'PROVIDER' and claim.provider != user:
			return Response({'detail': 'You can only investigate claims submitted to you'}, status=status.HTTP_403_FORBIDDEN)
		elif role not in ['PROVIDER', 'ADMIN']:
			return Response({'detail': 'Only providers and admins can investigate claims'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if claim can be investigated
		if claim.status not in [Claim.Status.PENDING, Claim.Status.REQUIRES_PREAUTH]:
			return Response({'detail': f'Cannot investigate claim with status: {claim.status}'}, status=status.HTTP_400_BAD_REQUEST)
		
		investigation_notes = request.data.get('notes', 'Under investigation')
		
		claim.status = Claim.Status.INVESTIGATING
		claim.notes = f"{claim.notes}\n\n[Investigation] {investigation_notes}".strip()
		claim.save(update_fields=['status', 'notes'])
		
		serializer = self.get_serializer(claim)
		return Response({
			'detail': 'Claim marked for investigation',
			'claim': serializer.data
		})


class InvoiceViewSet(viewsets.ModelViewSet):
	queryset = Invoice.objects.select_related('claim', 'claim__patient__user', 'claim__provider').all()
	serializer_class = InvoiceSerializer
	permission_classes = [IsProviderOrReadOnlyForAuthenticated]
	filterset_fields = ['payment_status']

	def get_queryset(self):
		user = self.request.user
		qs = super().get_queryset()
		role = getattr(user, 'role', None)
		if role == 'ADMIN':
			return qs
		if role == 'PROVIDER':
			return qs.filter(claim__provider=user)
		if role == 'PATIENT':
			return qs.filter(claim__patient__user=user)
		return qs.none()

	def update(self, request, *args, **kwargs):
		if getattr(request.user, 'role', None) != 'ADMIN':
			return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
		return super().update(request, *args, **kwargs)

	def partial_update(self, request, *args, **kwargs):
		if getattr(request.user, 'role', None) != 'ADMIN':
			return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
		return super().partial_update(request, *args, **kwargs)
