from django.conf import settings
from django.db import models
from django.utils import timezone
from schemes.models import SchemeCategory, SchemeBenefit


class Patient(models.Model):
	class Gender(models.TextChoices):
		MALE = 'M', 'Male'
		FEMALE = 'F', 'Female'
		OTHER = 'O', 'Other'

	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_profile')
	date_of_birth = models.DateField()
	gender = models.CharField(max_length=1, choices=Gender.choices)
	scheme = models.ForeignKey(SchemeCategory, on_delete=models.PROTECT, related_name='patients')
	diagnoses = models.TextField(blank=True)
	investigations = models.TextField(blank=True)
	treatments = models.TextField(blank=True)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.user.username} - {self.scheme.name}"


class Claim(models.Model):
	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		APPROVED = 'APPROVED', 'Approved'
		REJECTED = 'REJECTED', 'Rejected'

	patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='claims')
	provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='submitted_claims')
	service_type = models.CharField(max_length=50, choices=SchemeBenefit.BenefitType.choices)
	cost = models.DecimalField(max_digits=12, decimal_places=2)
	date_submitted = models.DateTimeField(default=timezone.now)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	coverage_checked = models.BooleanField(default=False)
	notes = models.TextField(blank=True)

	class Meta:
		indexes = [
			models.Index(fields=["patient", "service_type", "status", "date_submitted"]),
		]

	def __str__(self) -> str:  # pragma: no cover
		return f"Claim #{self.id} - {self.patient.user.username} - {self.status}"


class Invoice(models.Model):
	class PaymentStatus(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		PAID = 'PAID', 'Paid'

	claim = models.OneToOneField(Claim, on_delete=models.CASCADE, related_name='invoice')
	amount = models.DecimalField(max_digits=12, decimal_places=2)
	payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:  # pragma: no cover
		return f"Invoice for Claim #{self.claim_id} - {self.payment_status}"

# Module-level aliases for inner TextChoices to provide stable import paths
ClaimStatus = Claim.Status
PaymentStatus = Invoice.PaymentStatus
Gender = Patient.Gender

