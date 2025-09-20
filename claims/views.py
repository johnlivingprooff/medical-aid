from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from .models import Patient, Claim, Invoice
from .models import PreAuthorizationRequest, PreAuthorizationApproval, PreAuthorizationRule, FraudAlert
from .serializers import PatientSerializer, ClaimSerializer, InvoiceSerializer
from .serializers import PreAuthorizationRequestSerializer, PreAuthorizationApprovalSerializer, PreAuthorizationRuleSerializer, FraudAlertSerializer
from .services import validate_and_process_claim_enhanced, validate_and_process_claim_for_approval, emit_low_balance_alerts, emit_fraud_alert_if_needed
from schemes.models import SchemeBenefit, BenefitType
from core.models import MemberMessage, MemberDocument
from backend.pagination import OptimizedPagination


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
	queryset = Patient.objects.select_related(
		'user',
		'scheme',
		'principal_member'
	).prefetch_related(
		'dependents'
	).all()
	serializer_class = PatientSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['scheme', 'gender']
	search_fields = ['user__username']
	pagination_class = OptimizedPagination

	@method_decorator(cache_page(300))  # Cache for 5 minutes
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@method_decorator(cache_page(300))  # Cache for 5 minutes
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)

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
		
		# Get all active benefits for the patient's scheme with related data
		benefits = SchemeBenefit.objects.filter(
			scheme=patient.scheme, 
			is_active=True
		).select_related('benefit_type')
		
		from django.db.models import Sum, Count, Q
		from django.utils import timezone as djtz
		from .services import _period_start
		
		data = []
		current_time = djtz.now()
		
		# Get usage data for all benefit types in a single query
		usage_data = {}
		for benefit in benefits:
			start_date = _period_start(benefit.coverage_period, current_time, patient)
			
			# Get approved claims for this benefit type within the period
			claims_data = Claim.objects.filter(
				patient=patient,
				service_type=benefit.benefit_type,
				status=Claim.Status.APPROVED,
				date_submitted__gte=start_date,
			).aggregate(
				total_cost=Sum('cost'),
				claim_count=Count('id')
			)
			
			usage_data[benefit.id] = {
				'used_amount': float(claims_data['total_cost'] or 0.0),
				'used_count': claims_data['claim_count'] or 0,
				'start_date': start_date
			}
		
		# Build response data
		for benefit in benefits:
			usage = usage_data[benefit.id]
			remaining_amount = float(benefit.coverage_amount) - usage['used_amount'] if benefit.coverage_amount is not None else None
			remaining_count = None
			if benefit.coverage_limit_count is not None:
				remaining_count = max(benefit.coverage_limit_count - usage['used_count'], 0)
				
			data.append({
				'benefit_type': benefit.benefit_type.id,
				'benefit_type_name': benefit.benefit_type.name,
				'coverage_amount': float(benefit.coverage_amount) if benefit.coverage_amount is not None else None,
				'used_amount': usage['used_amount'],
				'remaining_amount': remaining_amount,
				'coverage_limit_count': benefit.coverage_limit_count,
				'remaining_count': remaining_count,
				'coverage_period': benefit.coverage_period,
				'deductible_amount': float(benefit.deductible_amount),
				'copayment_percentage': float(benefit.copayment_percentage),
				'copayment_fixed': float(benefit.copayment_fixed),
				'requires_preauth': benefit.requires_preauth,
				'waiting_period_days': benefit.waiting_period_days,
				'network_only': benefit.network_only,
			})
		
		return Response({'scheme': patient.scheme.name, 'balances': data})

	@action(detail=True, methods=['get', 'post'], url_path='messages')
	def messages(self, request, pk=None):
		patient = self.get_object()
		if request.method == 'GET':
			qs = MemberMessage.objects.filter(patient=patient).order_by('-created_at')[:100]
			return Response([
				{
					'id': m.id,
					'subject': m.subject,
					'body': m.body,
					'direction': m.direction,
					'sender': getattr(m.sender, 'username', None),
					'created_at': m.created_at,
					'read_at': m.read_at,
				}
				for m in qs
			])
		# POST - send a message to member
		if getattr(request.user, 'role', None) not in ['ADMIN', 'PROVIDER']:
			return Response({'detail': 'Only staff can message a member'}, status=status.HTTP_403_FORBIDDEN)
		subject = request.data.get('subject', '')
		body = request.data.get('message') or request.data.get('body')
		if not body:
			return Response({'detail': 'Message body is required'}, status=status.HTTP_400_BAD_REQUEST)
		msg = MemberMessage.objects.create(
			patient=patient,
			sender=request.user,
			subject=subject,
			body=body,
			direction=MemberMessage.Direction.TO_MEMBER,
		)
		return Response({'id': msg.id, 'created_at': msg.created_at}, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=['get', 'post'], url_path='documents')
	def documents(self, request, pk=None):
		patient = self.get_object()
		if request.method == 'GET':
			qs = MemberDocument.objects.filter(patient=patient).order_by('-created_at')
			return Response([
				{
					'id': d.id,
					'doc_type': d.doc_type,
					'notes': d.notes,
					'file': getattr(d.file, 'url', ''),
					'created_at': d.created_at,
				}
				for d in qs
			])
		# POST - upload a document (multipart/form-data)
		file = request.FILES.get('document') or request.FILES.get('file')
		if not file:
			return Response({'detail': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
		doc_type = request.data.get('doc_type', MemberDocument.DocType.OTHER)
		notes = request.data.get('notes', '')
		doc = MemberDocument.objects.create(
			patient=patient,
			uploaded_by=request.user if request.user.is_authenticated else None,
			file=file,
			doc_type=doc_type,
			notes=notes,
		)
		return Response({'id': doc.id, 'file': getattr(doc.file, 'url', '')}, status=status.HTTP_201_CREATED)


class ClaimViewSet(viewsets.ModelViewSet):
	queryset = Claim.objects.select_related(
		'patient__user',
		'patient__scheme',
		'provider',
		'service_type',
		'processed_by'
	).all()  # Removed heavy prefetch_related for better pagination performance
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
	pagination_class = OptimizedPagination

	@method_decorator(cache_page(300))  # Cache for 5 minutes
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@method_decorator(cache_page(300))  # Cache for 5 minutes
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)

	def perform_create(self, serializer):
		claim = serializer.save(provider=self.request.user)
		
		# Set date_of_service if not provided (default to submission date)
		if not claim.date_of_service:
			claim.date_of_service = claim.date_submitted.date()
			claim.save(update_fields=['date_of_service'])
		
		approved, payable, reason, validation_details = validate_and_process_claim_enhanced(claim)
		if approved:
			claim.status = Claim.Status.APPROVED
			claim.coverage_checked = True
			claim.processed_date = claim.date_submitted
			claim.processed_by = self.request.user
			claim.save(update_fields=['status', 'coverage_checked', 'processed_date', 'processed_by'])
			
			# Get benefit data once for both invoice and alerts
			try:
				benefit = SchemeBenefit.objects.select_related('benefit_type').get(
					scheme=claim.patient.scheme, 
					benefit_type=claim.service_type
				)
			except SchemeBenefit.DoesNotExist:
				benefit = None
			
			# Create invoice with detailed breakdown
			from decimal import Decimal
			if benefit:
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
			else:
				Invoice.objects.create(claim=claim, amount=payable)
			
			# emit alerts for low balance and fraud checks
			if benefit and benefit.coverage_amount is not None:
				# Get usage data efficiently
				from django.db.models import Sum, Count
				from .services import _period_start
				from django.utils import timezone as djtz
				
				start_date = _period_start(benefit.coverage_period, djtz.now(), claim.patient)
				usage_data = Claim.objects.filter(
					patient=claim.patient,
					service_type=claim.service_type,
					status=Claim.Status.APPROVED,
					date_submitted__gte=start_date,
				).aggregate(
					total_cost=Sum('cost'),
					claim_count=Count('id')
				)
				
				used_amount = float(usage_data['total_cost'] or 0.0)
				remaining_after = float(benefit.coverage_amount) - used_amount
				remaining_count = None
				if benefit.coverage_limit_count is not None:
					used_count = usage_data['claim_count'] or 0
					remaining_count = max(benefit.coverage_limit_count - used_count, 0)
				
				# Try to get subscription for additional checks
				subscription = getattr(claim.patient, 'member_subscription', None)
				emit_low_balance_alerts(claim, benefit, subscription, remaining_after, remaining_count)
			emit_fraud_alert_if_needed(claim)
		else:
			# Check if the validation failure is due to missing pre-authorization
			if "Pre-authorization required" in reason:
				claim.status = Claim.Status.PENDING
				claim.coverage_checked = False  # Not fully processed yet
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
			service_type_id = request.data['service_type']
			cost = request.data['cost']
		except KeyError:
			return Response({'detail': 'patient, service_type, cost required'}, status=status.HTTP_400_BAD_REQUEST)
		try:
			patient = Patient.objects.get(id=patient_id)
		except Patient.DoesNotExist:
			return Response({'detail': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)
		try:
			service_type = BenefitType.objects.get(id=service_type_id)
		except BenefitType.DoesNotExist:
			return Response({'detail': 'Service type not found'}, status=status.HTTP_404_NOT_FOUND)
		temp_claim = Claim(patient=patient, provider=request.user, service_type=service_type, cost=cost)
		approved, payable, reason, validation_details = validate_and_process_claim_enhanced(temp_claim)
		return Response({
			'approved': approved, 
			'payable': payable, 
			'reason': reason,
			'validation_details': validation_details
		})

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
		approved, payable, reason, validation_details = validate_and_process_claim_for_approval(claim)
		if not approved:
			return Response({
				'detail': 'Claim validation failed',
				'reason': reason,
				'approved': False,
				'validation_details': validation_details
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
			
			# Try to get subscription for additional checks
			subscription = getattr(claim.patient, 'member_subscription', None)
			emit_low_balance_alerts(claim, benefit, subscription, remaining_after, remaining_count)
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
	pagination_class = OptimizedPagination

	@method_decorator(cache_page(300))  # Cache for 5 minutes
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@method_decorator(cache_page(300))  # Cache for 5 minutes
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)

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


class PreAuthorizationRuleViewSet(viewsets.ModelViewSet):
	queryset = PreAuthorizationRule.objects.select_related('benefit_type', 'created_by', 'updated_by').all()
	serializer_class = PreAuthorizationRuleSerializer
	permission_classes = [IsAdmin]  # Only admins can manage rules
	filterset_fields = ['benefit_type', 'rule_type', 'is_active', 'priority']
	search_fields = ['name', 'description']

	def perform_create(self, serializer):
		serializer.save(created_by=self.request.user, updated_by=self.request.user)

	def perform_update(self, serializer):
		serializer.save(updated_by=self.request.user)


class PreAuthorizationRequestViewSet(viewsets.ModelViewSet):
	queryset = PreAuthorizationRequest.objects.select_related(
		'patient__user', 'provider', 'benefit_type', 'requested_by', 'reviewed_by'
	).all()
	serializer_class = PreAuthorizationRequestSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = {
		'status': ['exact', 'in'],
		'urgency_level': ['exact', 'in'],
		'priority': ['exact', 'in'],
		'patient': ['exact'],
		'provider': ['exact'],
		'benefit_type': ['exact'],
		'requested_date': ['gte', 'lte', 'date'],
		'expiry_date': ['gte', 'lte', 'date'],
	}
	search_fields = ['request_number', 'procedure_description', 'patient__user__username']

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

	def perform_create(self, serializer):
		request_obj = serializer.save(requested_by=self.request.user)
		
		# Auto-process based on rules if possible
		from .services import PreAuthorizationService
		service = PreAuthorizationService()
		auto_result = service.process_auto_approval(request_obj)
		
		if auto_result['auto_processed']:
			request_obj.status = auto_result['status']
			request_obj.review_notes = auto_result['reason']
			request_obj.reviewed_by = self.request.user
			request_obj.reviewed_date = timezone.now()
			if auto_result['approved_amount'] is not None:
				request_obj.approved_amount = auto_result['approved_amount']
			if auto_result['approved_conditions']:
				request_obj.approved_conditions = auto_result['approved_conditions']
			if auto_result['rejection_reason']:
				request_obj.rejection_reason = auto_result['rejection_reason']
			request_obj.save()

	@action(detail=True, methods=['post'], url_path='approve')
	def approve_request(self, request, pk=None):
		"""Approve a pre-authorization request"""
		preauth_request = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions
		if role == 'PROVIDER' and preauth_request.provider != user:
			return Response({'detail': 'You can only approve requests submitted to you'}, status=status.HTTP_403_FORBIDDEN)
		elif role not in ['PROVIDER', 'ADMIN']:
			return Response({'detail': 'Only providers and admins can approve requests'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if request can be approved
		if preauth_request.status != PreAuthorizationRequest.Status.PENDING:
			return Response({'detail': f'Cannot approve request with status: {preauth_request.status}'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Get approval data
		approved_amount = request.data.get('approved_amount')
		approved_conditions = request.data.get('approved_conditions', '')
		approval_notes = request.data.get('approval_notes', '')
		
		if not approved_amount:
			return Response({'detail': 'Approved amount is required'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Approve the request
		from django.utils import timezone
		preauth_request.status = PreAuthorizationRequest.Status.APPROVED
		preauth_request.approved_amount = approved_amount
		preauth_request.approved_conditions = approved_conditions
		preauth_request.review_notes = approval_notes
		preauth_request.reviewed_by = user
		preauth_request.reviewed_date = timezone.now()
		preauth_request.save()
		
		# Create approval record
		PreAuthorizationApproval.objects.create(
			request=preauth_request,
			benefit_type=preauth_request.benefit_type,
			approved_amount=approved_amount,
			approved_conditions=approved_conditions,
			approval_notes=approval_notes,
			approved_by=user
		)
		
		serializer = self.get_serializer(preauth_request)
		return Response({
			'detail': 'Pre-authorization request approved successfully',
			'request': serializer.data
		})

	@action(detail=True, methods=['post'], url_path='reject')
	def reject_request(self, request, pk=None):
		"""Reject a pre-authorization request"""
		preauth_request = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions
		if role == 'PROVIDER' and preauth_request.provider != user:
			return Response({'detail': 'You can only reject requests submitted to you'}, status=status.HTTP_403_FORBIDDEN)
		elif role not in ['PROVIDER', 'ADMIN']:
			return Response({'detail': 'Only providers and admins can reject requests'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if request can be rejected
		if preauth_request.status != PreAuthorizationRequest.Status.PENDING:
			return Response({'detail': f'Cannot reject request with status: {preauth_request.status}'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Get rejection data
		rejection_reason = request.data.get('reason', 'No reason provided')
		review_notes = request.data.get('review_notes', '')
		
		# Reject the request
		from django.utils import timezone
		preauth_request.status = PreAuthorizationRequest.Status.REJECTED
		preauth_request.rejection_reason = rejection_reason
		preauth_request.review_notes = review_notes
		preauth_request.reviewed_by = user
		preauth_request.reviewed_date = timezone.now()
		preauth_request.save()
		
		serializer = self.get_serializer(preauth_request)
		return Response({
			'detail': 'Pre-authorization request rejected successfully',
			'request': serializer.data
		})

	@action(detail=True, methods=['post'], url_path='extend')
	def extend_request(self, request, pk=None):
		"""Extend expiry date of a pre-authorization request"""
		preauth_request = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions
		if role == 'PROVIDER' and preauth_request.provider != user:
			return Response({'detail': 'You can only extend requests submitted to you'}, status=status.HTTP_403_FORBIDDEN)
		elif role not in ['PROVIDER', 'ADMIN']:
			return Response({'detail': 'Only providers and admins can extend requests'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if request can be extended
		if preauth_request.status not in [PreAuthorizationRequest.Status.PENDING, PreAuthorizationRequest.Status.APPROVED]:
			return Response({'detail': f'Cannot extend request with status: {preauth_request.status}'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Get extension data
		days_to_extend = request.data.get('days', 30)
		extension_reason = request.data.get('reason', 'Extension requested')
		
		if not isinstance(days_to_extend, int) or days_to_extend <= 0:
			return Response({'detail': 'Valid number of days to extend is required'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Extend the expiry date
		from django.utils import timezone
		from datetime import timedelta
		current_expiry = preauth_request.expiry_date or timezone.now().date()
		new_expiry = current_expiry + timedelta(days=days_to_extend)
		
		preauth_request.expiry_date = new_expiry
		preauth_request.review_notes = f"{preauth_request.review_notes}\n\n[Extension] {extension_reason} - Extended by {days_to_extend} days".strip()
		preauth_request.save(update_fields=['expiry_date', 'review_notes'])
		
		serializer = self.get_serializer(preauth_request)
		return Response({
			'detail': f'Pre-authorization request extended by {days_to_extend} days',
			'request': serializer.data
		})


class PreAuthorizationApprovalViewSet(viewsets.ReadOnlyModelViewSet):
	queryset = PreAuthorizationApproval.objects.select_related(
		'request__patient__user', 'request__provider', 'benefit_type', 'approved_by'
	).all()
	serializer_class = PreAuthorizationApprovalSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = {
		'request__patient': ['exact'],
		'request__provider': ['exact'],
		'benefit_type': ['exact'],
		'approved_date': ['gte', 'lte', 'date'],
		'is_active': ['exact'],
	}
	search_fields = ['request__request_number', 'request__procedure_description']

	def get_queryset(self):
		user = self.request.user
		qs = super().get_queryset()
		role = getattr(user, 'role', None)
		if role == 'ADMIN':
			return qs
		if role == 'PROVIDER':
			return qs.filter(request__provider=user)
		if role == 'PATIENT':
			return qs.filter(request__patient__user=user)
		return qs.none()

	@action(detail=True, methods=['post'], url_path='revoke')
	def revoke_approval(self, request, pk=None):
		"""Revoke a pre-authorization approval"""
		approval = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)
		
		# Check permissions - only admin or the approver can revoke
		if role not in ['ADMIN'] and approval.approved_by != user:
			return Response({'detail': 'Only admins or the original approver can revoke approvals'}, status=status.HTTP_403_FORBIDDEN)
		
		# Check if approval can be revoked
		if not approval.is_active:
			return Response({'detail': 'Approval is already inactive'}, status=status.HTTP_400_BAD_REQUEST)
		
		# Get revocation reason
		revocation_reason = request.data.get('reason', 'Revoked by user')
		
		# Revoke the approval
		from django.utils import timezone
		approval.is_active = False
		approval.expires_at = timezone.now()
		approval.approval_notes = f"{approval.approval_notes}\n\n[REVOKED] {revocation_reason}".strip()
		approval.save()
		
		# Update the original request status
		approval.request.status = PreAuthorizationRequest.Status.REVOKED
		approval.request.review_notes = f"{approval.request.review_notes}\n\n[REVOKED] {revocation_reason}".strip()
		approval.request.save()
		
		serializer = self.get_serializer(approval)
		return Response({
			'detail': 'Pre-authorization approval revoked successfully',
			'approval': serializer.data
		})


class FraudAlertViewSet(viewsets.ModelViewSet):
	queryset = FraudAlert.objects.select_related(
		'claim__patient__user', 'claim__provider', 'patient__user', 'provider', 'reviewed_by'
	).all()
	serializer_class = FraudAlertSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = {
		'alert_type': ['exact', 'in'],
		'severity': ['exact', 'in'],
		'status': ['exact', 'in'],
		'claim': ['exact'],
		'patient': ['exact'],
		'provider': ['exact'],
		'fraud_score': ['gte', 'lte'],
		'created_at': ['gte', 'lte', 'date'],
	}
	search_fields = ['title', 'description', 'detection_rule']

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

	@action(detail=True, methods=['post'], url_path='review')
	def review_alert(self, request, pk=None):
		"""Review and resolve a fraud alert"""
		alert = self.get_object()
		user = request.user
		role = getattr(user, 'role', None)

		# Check permissions - only admin can review alerts
		if role not in ['ADMIN']:
			return Response({'detail': 'Only administrators can review fraud alerts'}, status=status.HTTP_403_FORBIDDEN)

		# Get review data
		action = request.data.get('action', 'REVIEWED')  # REVIEWED, DISMISSED, ESCALATED
		notes = request.data.get('notes', '')
		resolution_action = request.data.get('resolution_action', '')

		if action == 'REVIEWED':
			alert.mark_reviewed(user, notes, resolution_action)
		elif action == 'DISMISSED':
			alert.dismiss(user, notes)
		elif action == 'ESCALATED':
			alert.escalate(user, notes)
		else:
			return Response({'detail': 'Invalid action. Must be REVIEWED, DISMISSED, or ESCALATED'}, status=status.HTTP_400_BAD_REQUEST)

		serializer = self.get_serializer(alert)
		return Response({
			'detail': f'Fraud alert {action.lower()} successfully',
			'alert': serializer.data
		})

	@action(detail=False, methods=['get'], url_path='stats')
	def get_alert_stats(self, request):
		"""Get fraud alert statistics"""
		user = request.user
		role = getattr(user, 'role', None)

		# Base queryset
		if role == 'ADMIN':
			qs = FraudAlert.objects.all()
		elif role == 'PROVIDER':
			qs = FraudAlert.objects.filter(provider=user)
		else:
			return Response({'detail': 'Insufficient permissions'}, status=status.HTTP_403_FORBIDDEN)

		# Calculate statistics
		stats = {
			'total_alerts': qs.count(),
			'active_alerts': qs.filter(status=FraudAlert.Status.ACTIVE).count(),
			'reviewed_alerts': qs.filter(status=FraudAlert.Status.REVIEWED).count(),
			'dismissed_alerts': qs.filter(status=FraudAlert.Status.DISMISSED).count(),
			'escalated_alerts': qs.filter(status=FraudAlert.Status.ESCALATED).count(),
			'by_severity': {
				'LOW': qs.filter(severity=FraudAlert.Severity.LOW).count(),
				'MEDIUM': qs.filter(severity=FraudAlert.Severity.MEDIUM).count(),
				'HIGH': qs.filter(severity=FraudAlert.Severity.HIGH).count(),
				'CRITICAL': qs.filter(severity=FraudAlert.Severity.CRITICAL).count(),
			},
			'by_type': {
				alert_type.value: qs.filter(alert_type=alert_type).count()
				for alert_type in FraudAlert.AlertType
			},
			'high_risk_alerts': qs.filter(fraud_score__gte=0.8).count(),
		}

		return Response(stats)
