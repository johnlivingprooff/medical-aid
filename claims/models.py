from django.conf import settings
from django.db import models
from django.utils import timezone
from schemes.models import SchemeCategory, SchemeBenefit, BenefitType, MemberSubscription
from core.encryption import EncryptedCharField, EncryptedTextField, EncryptedDateField


class Patient(models.Model):
	class Gender(models.TextChoices):
		MALE = 'M', 'Male'
		FEMALE = 'F', 'Female'
		OTHER = 'O', 'Other'

	class Status(models.TextChoices):
		ACTIVE = 'ACTIVE', 'Active'
		INACTIVE = 'INACTIVE', 'Inactive'
		SUSPENDED = 'SUSPENDED', 'Suspended'
		TERMINATED = 'TERMINATED', 'Terminated'

	class Relationship(models.TextChoices):
		PRINCIPAL = 'PRINCIPAL', 'Principal Member'
		SPOUSE = 'SPOUSE', 'Spouse'
		CHILD = 'CHILD', 'Child'
		DEPENDENT = 'DEPENDENT', 'Other Dependent'

	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_profile')
	# Human-friendly sequential member identifier (e.g., MBR-0001)
	member_id = models.CharField(max_length=20, unique=True, blank=True, editable=False)
	date_of_birth = EncryptedDateField(help_text="Patient's date of birth (encrypted for privacy)")
	gender = models.CharField(max_length=1, choices=Gender.choices)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
	scheme = models.ForeignKey(SchemeCategory, on_delete=models.PROTECT, related_name='patients')
	
	# Medical Aid specific fields
	enrollment_date = models.DateField(null=True, blank=True, help_text="Date of enrollment in the scheme")
	benefit_year_start = models.DateField(null=True, blank=True, help_text="Custom benefit year start (if different from enrollment)")
	principal_member = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='dependents')
	relationship = models.CharField(max_length=20, choices=Relationship.choices, default=Relationship.PRINCIPAL)
	
	# Medical history (encrypted PHI)
	diagnoses = EncryptedTextField(blank=True, help_text="Patient diagnoses (encrypted PHI)")
	investigations = EncryptedTextField(blank=True, help_text="Medical investigations (encrypted PHI)")
	treatments = EncryptedTextField(blank=True, help_text="Medical treatments (encrypted PHI)")
	
	# Contact information (encrypted personal data)
	phone = EncryptedCharField(max_length=150, blank=True, help_text="Patient phone number (encrypted)")
	emergency_contact = EncryptedCharField(max_length=150, blank=True, help_text="Emergency contact name (encrypted)")
	emergency_phone = EncryptedCharField(max_length=150, blank=True, help_text="Emergency contact phone (encrypted)")

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.user.username} - {self.scheme.name}"

	def save(self, *args, **kwargs):
		# Ensure member_id is assigned after first save (when ID exists)
		if not self.member_id:
			# Save to obtain an ID if new instance
			is_new = self.pk is None
			super().save(*args, **kwargs)
			if is_new and not self.member_id and self.pk:
				# Generate member ID with proper padding
				if self.relationship == self.Relationship.PRINCIPAL:
					self.member_id = f"MBR-{self.pk:05d}"
				else:
					# For dependents, use principal's member ID with suffix
					principal_id = self.principal_member.member_id if self.principal_member else f"MBR-{self.pk:05d}"
					dependent_count = Patient.objects.filter(principal_member=self.principal_member).count()
					self.member_id = f"{principal_id}-D{dependent_count:02d}"
				# Use update_fields to avoid recursion
				super().save(update_fields=['member_id'])
			return
		super().save(*args, **kwargs)
	
	@property
	def benefit_year_start_date(self):
		"""Calculate the start of the current benefit year"""
		if self.benefit_year_start:
			return self.benefit_year_start
		return self.enrollment_date
	
	@property
	def age(self):
		"""Calculate current age"""
		if self.date_of_birth is None:
			return None
		from django.utils import timezone
		today = timezone.now().date()
		return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
	
	@property
	def is_dependent(self):
		"""Check if this is a dependent member"""
		return self.relationship != self.Relationship.PRINCIPAL

	class Meta:
		indexes = [
			# Status and relationship - common filters
			models.Index(fields=['status']),
			models.Index(fields=['relationship']),
			models.Index(fields=['status', 'relationship']),
			
			# Foreign key indexes
			models.Index(fields=['scheme']),
			models.Index(fields=['user']),
			models.Index(fields=['principal_member']),
			
			# Search and filter indexes
			models.Index(fields=['member_id']),
			models.Index(fields=['gender']),
			
			# Date-based indexes
			models.Index(fields=['enrollment_date']),
			models.Index(fields=['benefit_year_start']),
			
			# Composite indexes for common queries
			models.Index(fields=['scheme', 'status']),
			models.Index(fields=['user', 'status']),
		]
		ordering = ['-enrollment_date']


class Claim(models.Model):
	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		APPROVED = 'APPROVED', 'Approved'
		REJECTED = 'REJECTED', 'Rejected'
		REQUIRES_PREAUTH = 'REQUIRES_PREAUTH', 'Requires Pre-authorization'
		INVESTIGATING = 'INVESTIGATING', 'Under Investigation'

	class Priority(models.TextChoices):
		LOW = 'LOW', 'Low'
		NORMAL = 'NORMAL', 'Normal'
		HIGH = 'HIGH', 'High'
		URGENT = 'URGENT', 'Urgent'

	patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='claims')
	provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='submitted_claims')
	service_type = models.ForeignKey(BenefitType, on_delete=models.PROTECT, related_name='claims')
	
	# Claim details
	cost = models.DecimalField(max_digits=12, decimal_places=2)
	date_submitted = models.DateTimeField(default=timezone.now)
	date_of_service = models.DateField(null=True, blank=True, help_text='Date when the service was provided')
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
	
	# Processing information
	coverage_checked = models.BooleanField(default=False)
	processed_date = models.DateTimeField(null=True, blank=True)
	processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='processed_claims')
	
	# Rejection details
	rejection_reason = EncryptedTextField(blank=True, help_text='Reason for claim rejection (encrypted)')
	rejection_date = models.DateTimeField(null=True, blank=True)
	
	# Clinical information (encrypted PHI)
	diagnosis_code = EncryptedCharField(max_length=150, blank=True, help_text='ICD-10 or other diagnosis code (encrypted)')
	procedure_code = EncryptedCharField(max_length=150, blank=True, help_text='CPT or other procedure code (encrypted)')
	notes = EncryptedTextField(blank=True, help_text='Clinical notes (encrypted PHI)')
	
	# Pre-authorization
	preauth_number = models.CharField(max_length=50, blank=True)
	preauth_expiry = models.DateField(null=True, blank=True)

	class Meta:
		indexes = [
			# Status and priority - most common filters
			models.Index(fields=['status']),
			models.Index(fields=['priority']),
			models.Index(fields=['status', 'priority']),
			
			# Date-based indexes for filtering and ordering
			models.Index(fields=['date_submitted']),
			models.Index(fields=['date_of_service']),
			models.Index(fields=['processed_date']),
			
			# Foreign key indexes for joins
			models.Index(fields=['patient']),
			models.Index(fields=['provider']),
			models.Index(fields=['service_type']),
			models.Index(fields=['processed_by']),
			
			# Composite indexes for common query patterns
			models.Index(fields=['patient', 'status']),
			models.Index(fields=['patient', 'date_submitted']),
			models.Index(fields=['provider', 'status']),
			models.Index(fields=['service_type', 'status']),
			models.Index(fields=['status', 'date_submitted']),
			
			# Coverage and processing indexes
			models.Index(fields=['coverage_checked']),
			models.Index(fields=['coverage_checked', 'status']),
		]
		ordering = ['-date_submitted']


class PreAuthorizationRequest(models.Model):
	"""Pre-authorization request for medical services requiring approval"""

	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending Review'
		APPROVED = 'APPROVED', 'Approved'
		REJECTED = 'REJECTED', 'Rejected'
		EXPIRED = 'EXPIRED', 'Expired'
		CANCELLED = 'CANCELLED', 'Cancelled'

	class Priority(models.TextChoices):
		ROUTINE = 'ROUTINE', 'Routine'
		URGENT = 'URGENT', 'Urgent'
		EMERGENCY = 'EMERGENCY', 'Emergency'

	class RequestType(models.TextChoices):
		INPATIENT = 'INPATIENT', 'Inpatient Admission'
		OUTPATIENT = 'OUTPATIENT', 'Outpatient Procedure'
		SURGERY = 'SURGERY', 'Surgical Procedure'
		SPECIALIST = 'SPECIALIST', 'Specialist Consultation'
		DIAGNOSTIC = 'DIAGNOSTIC', 'Diagnostic Procedure'
		MEDICATION = 'MEDICATION', 'High-Cost Medication'
		OTHER = 'OTHER', 'Other'

	# Request details
	request_number = models.CharField(max_length=20, unique=True, editable=False)
	patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='preauth_requests')
	provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='preauth_requests')
	service_type = models.ForeignKey(BenefitType, on_delete=models.PROTECT, related_name='preauth_requests')

	# Clinical information
	request_type = models.CharField(max_length=20, choices=RequestType.choices)
	priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.ROUTINE)
	estimated_cost = models.DecimalField(max_digits=12, decimal_places=2)

	# Dates
	date_requested = models.DateTimeField(default=timezone.now)
	date_of_service = models.DateField(help_text='Proposed date of service')
	requested_validity_days = models.PositiveIntegerField(default=30, help_text='How many days approval should be valid')

	# Clinical details (encrypted PHI)
	diagnosis = EncryptedTextField(help_text='Diagnosis requiring treatment (encrypted PHI)')
	proposed_treatment = EncryptedTextField(help_text='Proposed treatment/procedure (encrypted PHI)')
	clinical_notes = EncryptedTextField(blank=True, help_text='Additional clinical notes (encrypted PHI)')

	# Supporting documents
	supporting_documents = models.JSONField(default=dict, blank=True, help_text='URLs or references to supporting documents')

	# Processing
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	processed_date = models.DateTimeField(null=True, blank=True)
	processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='processed_preauths')

	# Approval details
	approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
	approval_notes = EncryptedTextField(blank=True, help_text='Approval conditions/notes (encrypted)')
	approval_expiry = models.DateField(null=True, blank=True)

	# Rejection details
	rejection_reason = EncryptedTextField(blank=True, help_text='Rejection reason (encrypted)')
	rejection_date = models.DateTimeField(null=True, blank=True)

	# Auto-approval tracking
	auto_approved = models.BooleanField(default=False)
	approval_rule_applied = models.CharField(max_length=100, blank=True, help_text='Name of auto-approval rule applied')

	class Meta:
		indexes = [
			models.Index(fields=['patient', 'status', 'date_requested']),
			models.Index(fields=['provider', 'status', 'date_requested']),
			models.Index(fields=['request_number']),
			models.Index(fields=['status', 'priority', 'date_requested']),
		]
		ordering = ['-date_requested']

	def __str__(self):
		return f"PreAuth {self.request_number} - {self.patient.user.username} - {self.status}"

	def save(self, *args, **kwargs):
		if not self.request_number:
			# Generate request number: PA-YYYY-NNNNNN
			from django.utils import timezone
			year = timezone.now().year
			# Get next sequence number for this year
			last_request = PreAuthorizationRequest.objects.filter(
				request_number__startswith=f'PA-{year}-'
			).order_by('-request_number').first()

			if last_request:
				last_num = int(last_request.request_number.split('-')[-1])
				next_num = last_num + 1
			else:
				next_num = 1

			self.request_number = f'PA-{year}-{next_num:06d}'

		super().save(*args, **kwargs)

	@property
	def is_expired(self):
		"""Check if the request has expired without decision"""
		if self.status in [self.Status.APPROVED, self.Status.REJECTED]:
			return False
		days_pending = (timezone.now() - self.date_requested).days
		return days_pending > 30  # Auto-expire after 30 days

	@property
	def days_pending(self):
		"""Number of days the request has been pending"""
		if self.status != self.Status.PENDING:
			return 0
		return (timezone.now() - self.date_requested).days

	@property
	def can_be_auto_approved(self):
		"""Check if this request qualifies for auto-approval"""
		from .services import PreAuthorizationService
		service = PreAuthorizationService()
		return service.check_auto_approval_eligibility(self)


class PreAuthorizationApproval(models.Model):
	"""Tracks approval decisions and conditions for pre-authorization requests"""

	class ApprovalType(models.TextChoices):
		FULL = 'FULL', 'Full Approval'
		PARTIAL = 'PARTIAL', 'Partial Approval'
		CONDITIONAL = 'CONDITIONAL', 'Conditional Approval'

	preauth_request = models.OneToOneField(PreAuthorizationRequest, on_delete=models.CASCADE, related_name='approval_details')
	approval_type = models.CharField(max_length=20, choices=ApprovalType.choices, default=ApprovalType.FULL)

	# Approval limits
	approved_amount = models.DecimalField(max_digits=12, decimal_places=2)
	max_visits = models.PositiveIntegerField(null=True, blank=True, help_text='Maximum number of visits allowed')
	validity_period_days = models.PositiveIntegerField(default=30, help_text='How many days approval is valid')

	# Conditions and limitations
	conditions = models.JSONField(default=dict, blank=True, help_text='Specific conditions for approval')
	exclusions = models.JSONField(default=dict, blank=True, help_text='Services/procedures excluded from approval')

	# Follow-up requirements
	requires_followup = models.BooleanField(default=False)
	followup_notes = EncryptedTextField(blank=True, help_text='Follow-up requirements (encrypted)')

	# Administrative
	approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='preauth_approvals')
	approved_date = models.DateTimeField(default=timezone.now)
	approval_reference = models.CharField(max_length=50, unique=True, editable=False)

	def save(self, *args, **kwargs):
		if not self.approval_reference:
			# Generate approval reference: APR-YYYY-NNNNNN
			from django.utils import timezone
			year = timezone.now().year
			last_approval = PreAuthorizationApproval.objects.filter(
				approval_reference__startswith=f'APR-{year}-'
			).order_by('-approval_reference').first()

			if last_approval:
				last_num = int(last_approval.approval_reference.split('-')[-1])
				next_num = last_num + 1
			else:
				next_num = 1

			self.approval_reference = f'APR-{year}-{next_num:06d}'

		super().save(*args, **kwargs)

	def __str__(self):
		return f"Approval {self.approval_reference} for {self.preauth_request.request_number}"


class PreAuthorizationRule(models.Model):
	"""Automated approval rules for pre-authorization requests"""

	class RuleType(models.TextChoices):
		COST_THRESHOLD = 'COST_THRESHOLD', 'Cost Threshold'
		SERVICE_TYPE = 'SERVICE_TYPE', 'Service Type'
		PROVIDER_TIER = 'PROVIDER_TIER', 'Provider Tier'
		PATIENT_HISTORY = 'PATIENT_HISTORY', 'Patient History'
		DIAGNOSIS_BASED = 'DIAGNOSIS_BASED', 'Diagnosis Based'
		COMPOSITE = 'COMPOSITE', 'Composite Rule'

	class Action(models.TextChoices):
		AUTO_APPROVE = 'AUTO_APPROVE', 'Auto Approve'
		AUTO_REJECT = 'AUTO_REJECT', 'Auto Reject'
		ESCALATE = 'ESCALATE', 'Escalate for Review'
		REQUIRE_DOCUMENTATION = 'REQUIRE_DOCUMENTATION', 'Require Additional Documentation'

	name = models.CharField(max_length=100, unique=True)
	description = models.TextField(blank=True)
	rule_type = models.CharField(max_length=20, choices=RuleType.choices)
	action = models.CharField(max_length=25, choices=Action.choices, default=Action.ESCALATE)

	# Rule conditions
	conditions = models.JSONField(default=dict, help_text='Rule conditions in JSON format')
	is_active = models.BooleanField(default=True)
	priority = models.PositiveIntegerField(default=100, help_text='Lower number = higher priority')

	# Audit
	created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='preauth_rules')
	created_date = models.DateTimeField(default=timezone.now)
	last_modified = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['priority', 'name']

	def __str__(self):
		return f"{self.name} ({self.rule_type})"

	def evaluate(self, preauth_request: PreAuthorizationRequest) -> bool:
		"""Evaluate if this rule applies to the pre-authorization request"""
		# This will be implemented in the service layer
		from .services import PreAuthorizationService
		service = PreAuthorizationService()
		return service.evaluate_rule(self, preauth_request)


class Invoice(models.Model):
	class PaymentStatus(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		PAID = 'PAID', 'Paid'
		PARTIAL = 'PARTIAL', 'Partially Paid'
		CANCELLED = 'CANCELLED', 'Cancelled'
		DISPUTED = 'DISPUTED', 'Disputed'

	claim = models.OneToOneField(Claim, on_delete=models.CASCADE, related_name='invoice')
	amount = models.DecimalField(max_digits=12, decimal_places=2, help_text='Amount approved for payment')
	
	# Payment tracking
	payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
	amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	payment_date = models.DateTimeField(null=True, blank=True)
	payment_reference = models.CharField(max_length=100, blank=True)
	
	# Patient responsibility
	patient_deductible = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	patient_copay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	patient_coinsurance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	
	# Timestamps
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	
	# Banking details for provider payments (encrypted financial data)
	provider_bank_account = EncryptedCharField(max_length=150, blank=True, help_text='Provider bank account number (encrypted)')
	provider_bank_name = EncryptedCharField(max_length=150, blank=True, help_text='Provider bank name (encrypted)')

	def __str__(self) -> str:  # pragma: no cover
		return f"Invoice #{self.id} - Claim #{self.claim.id} - {self.payment_status}"
	
	@property
	def total_patient_responsibility(self):
		"""Calculate total amount patient is responsible for"""
		return self.patient_deductible + self.patient_copay + self.patient_coinsurance
	
	@property
	def amount_outstanding(self):
		"""Calculate outstanding amount to be paid"""
		return max(self.amount - self.amount_paid, 0)


class FraudAlert(models.Model):
	"""Advanced fraud detection alert system"""

	class AlertType(models.TextChoices):
		DUPLICATE_CLAIM = 'DUPLICATE_CLAIM', 'Duplicate Claim'
		UNUSUAL_FREQUENCY = 'UNUSUAL_FREQUENCY', 'Unusual Frequency'
		AMOUNT_ANOMALY = 'AMOUNT_ANOMALY', 'Amount Anomaly'
		PROVIDER_PATTERN = 'PROVIDER_PATTERN', 'Provider Pattern'
		PATIENT_PATTERN = 'PATIENT_PATTERN', 'Patient Pattern'
		SERVICE_MISMATCH = 'SERVICE_MISMATCH', 'Service Mismatch'
		TEMPORAL_ANOMALY = 'TEMPORAL_ANOMALY', 'Temporal Anomaly'
		NETWORK_VIOLATION = 'NETWORK_VIOLATION', 'Network Violation'

	class Severity(models.TextChoices):
		LOW = 'LOW', 'Low'
		MEDIUM = 'MEDIUM', 'Medium'
		HIGH = 'HIGH', 'High'
		CRITICAL = 'CRITICAL', 'Critical'

	class Status(models.TextChoices):
		ACTIVE = 'ACTIVE', 'Active'
		REVIEWED = 'REVIEWED', 'Reviewed'
		DISMISSED = 'DISMISSED', 'Dismissed'
		ESCALATED = 'ESCALATED', 'Escalated'

	# Core alert information
	alert_type = models.CharField(max_length=20, choices=AlertType.choices)
	severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
	status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

	# Related entities
	claim = models.ForeignKey(Claim, on_delete=models.CASCADE, related_name='fraud_alerts')
	patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='fraud_alerts')
	provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='fraud_alerts')

	# Alert details
	title = models.CharField(max_length=200, help_text='Brief description of the alert')
	description = models.TextField(help_text='Detailed explanation of the fraud pattern detected')
	fraud_score = models.DecimalField(max_digits=5, decimal_places=3, help_text='Calculated fraud risk score (0.000-1.000)')

	# Detection metadata
	detection_rule = models.CharField(max_length=100, help_text='Name of the rule that triggered this alert')
	detection_data = models.JSONField(default=dict, help_text='Additional data from the detection algorithm')

	# Review and resolution
	reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_fraud_alerts')
	reviewed_at = models.DateTimeField(null=True, blank=True)
	review_notes = models.TextField(blank=True, help_text='Notes from the review process')
	resolution_action = models.CharField(max_length=100, blank=True, help_text='Action taken to resolve the alert')

	# Timestamps
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['alert_type', 'severity', 'status']),
			models.Index(fields=['claim', 'status']),
			models.Index(fields=['patient', 'created_at']),
			models.Index(fields=['provider', 'created_at']),
			models.Index(fields=['fraud_score', 'status']),
		]

	def __str__(self) -> str:
		return f"{self.alert_type} - {self.severity} - Claim #{self.claim.id}"

	@property
	def is_active(self):
		"""Check if alert is still active"""
		return self.status == self.Status.ACTIVE

	@property
	def days_since_creation(self):
		"""Calculate days since alert was created"""
		return (timezone.now() - self.created_at).days

	def mark_reviewed(self, reviewer, notes='', action=''):
		"""Mark alert as reviewed"""
		self.status = self.Status.REVIEWED
		self.reviewed_by = reviewer
		self.reviewed_at = timezone.now()
		self.review_notes = notes
		self.resolution_action = action
		self.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes', 'resolution_action'])

	def escalate(self, reviewer, notes=''):
		"""Escalate alert to higher severity"""
		self.status = self.Status.ESCALATED
		self.severity = self.Severity.CRITICAL
		self.reviewed_by = reviewer
		self.reviewed_at = timezone.now()
		self.review_notes = notes
		self.save(update_fields=['status', 'severity', 'reviewed_by', 'reviewed_at', 'review_notes'])

	def dismiss(self, reviewer, notes=''):
		"""Dismiss alert as false positive"""
		self.status = self.Status.DISMISSED
		self.reviewed_by = reviewer
		self.reviewed_at = timezone.now()
		self.review_notes = notes
		self.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes'])


# Module-level aliases for inner TextChoices to provide stable import paths
ClaimStatus = Claim.Status
PaymentStatus = Invoice.PaymentStatus
Gender = Patient.Gender
PreAuthStatus = PreAuthorizationRequest.Status

