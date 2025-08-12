from django.conf import settings
from django.db import models
from django.utils import timezone
from schemes.models import SchemeCategory, SchemeBenefit, BenefitType


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
	date_of_birth = models.DateField()
	gender = models.CharField(max_length=1, choices=Gender.choices)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
	scheme = models.ForeignKey(SchemeCategory, on_delete=models.PROTECT, related_name='patients')
	
	# Medical Aid specific fields
	enrollment_date = models.DateField(auto_now_add=True, help_text="Date of enrollment in the scheme")
	benefit_year_start = models.DateField(null=True, blank=True, help_text="Custom benefit year start (if different from enrollment)")
	principal_member = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='dependents')
	relationship = models.CharField(max_length=20, choices=Relationship.choices, default=Relationship.PRINCIPAL)
	
	# Medical history
	diagnoses = models.TextField(blank=True)
	investigations = models.TextField(blank=True)
	treatments = models.TextField(blank=True)
	
	# Contact information
	phone = models.CharField(max_length=20, blank=True)
	emergency_contact = models.CharField(max_length=100, blank=True)
	emergency_phone = models.CharField(max_length=20, blank=True)

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
		from django.utils import timezone
		today = timezone.now().date()
		return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
	
	@property
	def is_dependent(self):
		"""Check if this is a dependent member"""
		return self.relationship != self.Relationship.PRINCIPAL


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
	date_of_service = models.DateField(help_text='Date when the service was provided')
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
	
	# Processing information
	coverage_checked = models.BooleanField(default=False)
	processed_date = models.DateTimeField(null=True, blank=True)
	processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='processed_claims')
	
	# Clinical information
	diagnosis_code = models.CharField(max_length=20, blank=True, help_text='ICD-10 or other diagnosis code')
	procedure_code = models.CharField(max_length=20, blank=True, help_text='CPT or other procedure code')
	notes = models.TextField(blank=True)
	
	# Pre-authorization
	preauth_number = models.CharField(max_length=50, blank=True)
	preauth_expiry = models.DateField(null=True, blank=True)
	
	# Rejection details
	rejection_reason = models.TextField(blank=True)
	rejection_date = models.DateTimeField(null=True, blank=True)

	class Meta:
		indexes = [
			models.Index(fields=["patient", "service_type", "status", "date_submitted"]),
			models.Index(fields=["provider", "status", "date_submitted"]),
			models.Index(fields=["date_of_service", "status"]),
		]

	def __str__(self) -> str:  # pragma: no cover
		return f"Claim #{self.id} - {self.patient.user.username} - {self.status}"


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
	
	# Banking details for provider payments
	provider_bank_account = models.CharField(max_length=50, blank=True)
	provider_bank_name = models.CharField(max_length=100, blank=True)

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

class PreAuthorization(models.Model):
	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		APPROVED = 'APPROVED', 'Approved'
		REJECTED = 'REJECTED', 'Rejected'
		EXPIRED = 'EXPIRED', 'Expired'

	patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='preauthorizations')
	provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='submitted_preauths')
	service_type = models.ForeignKey(BenefitType, on_delete=models.PROTECT, related_name='preauthorizations')
	
	# Pre-auth details
	estimated_cost = models.DecimalField(max_digits=12, decimal_places=2)
	approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
	authorization_number = models.CharField(max_length=50, unique=True, blank=True)
	
	# Dates
	requested_date = models.DateTimeField(auto_now_add=True)
	approved_date = models.DateTimeField(null=True, blank=True)
	expiry_date = models.DateField(null=True, blank=True)
	
	# Clinical information
	diagnosis_code = models.CharField(max_length=20, help_text='ICD-10 or other diagnosis code')
	procedure_code = models.CharField(max_length=20, help_text='CPT or other procedure code')
	clinical_notes = models.TextField()
	
	# Status and processing
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='reviewed_preauths')
	rejection_reason = models.TextField(blank=True)

	def save(self, *args, **kwargs):
		if not self.authorization_number and self.status == self.Status.APPROVED:
			# Generate authorization number
			import uuid
			self.authorization_number = f"PA-{uuid.uuid4().hex[:8].upper()}"
		super().save(*args, **kwargs)

	def __str__(self) -> str:
		return f"PreAuth #{self.id} - {self.patient.user.username} - {self.status}"


# Module-level aliases for inner TextChoices to provide stable import paths
ClaimStatus = Claim.Status
PaymentStatus = Invoice.PaymentStatus
Gender = Patient.Gender
PreAuthStatus = PreAuthorization.Status

