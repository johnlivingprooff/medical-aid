from django.contrib.auth.models import AbstractUser
from django.db import models
from core.encryption import EncryptedCharField
from django_otp.plugins.otp_totp.models import TOTPDevice
from django.contrib.sessions.models import Session
from django.utils import timezone
from schemes.models import SchemeCategory
from django.utils import timezone as djtz


class User(AbstractUser):
	class Roles(models.TextChoices):
		ADMIN = 'ADMIN', 'Admin'
		PROVIDER = 'PROVIDER', 'Provider'
		PATIENT = 'PATIENT', 'Patient'

	role = models.CharField(
		max_length=20,
		choices=Roles.choices,
		default=Roles.PATIENT,
		help_text="Role determines access level in the system.",
	)

	# MFA Settings
	mfa_enabled = models.BooleanField(default=False, help_text="Whether MFA is enabled for this user")
	mfa_required = models.BooleanField(default=False, help_text="Whether MFA is required for this user role")
	backup_codes = models.JSONField(default=list, blank=True, help_text="Encrypted backup codes for MFA recovery")

	def __str__(self) -> str:
		return f"{self.username} ({self.role})"

	@property
	def is_mfa_required(self):
		"""Check if MFA is required for this user."""
		# Require MFA for admin and provider roles
		if self.role in [self.Roles.ADMIN, self.Roles.PROVIDER]:
			return True
		return self.mfa_required

	def has_mfa_device(self):
		"""Check if user has an MFA device configured."""
		return TOTPDevice.objects.filter(user=self, confirmed=True).exists()

	def get_totp_device(self):
		"""Get the user's TOTP device."""
		try:
			return TOTPDevice.objects.get(user=self, confirmed=True)
		except TOTPDevice.DoesNotExist:
			return None


class ProviderProfile(models.Model):
	class FacilityType(models.TextChoices):
		HOSPITAL = 'HOSPITAL', 'Hospital'
		CLINIC = 'CLINIC', 'Clinic'
		PHARMACY = 'PHARMACY', 'Pharmacy'
		LAB = 'LAB', 'Laboratory'
		IMAGING = 'IMAGING', 'Imaging Center'

	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='provider_profile')
	facility_name = models.CharField(max_length=150)
	facility_type = models.CharField(max_length=20, choices=FacilityType.choices)
	phone = EncryptedCharField(max_length=50, blank=True, help_text='Facility phone number (encrypted)')
	address = models.CharField(max_length=255, blank=True)
	city = models.CharField(max_length=100, blank=True)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.facility_name} ({self.get_facility_type_display()})"


def provider_doc_path(instance, filename: str) -> str:
	"""Upload path for provider credentialing documents."""
	prov_id = instance.membership.provider_id if getattr(instance, 'membership_id', None) else (getattr(instance, 'uploaded_by_id', None) or 'unknown')
	return f"provider_docs/provider_{prov_id}/{filename}"


class ProviderNetworkMembership(models.Model):
	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		ACTIVE = 'ACTIVE', 'Active'
		SUSPENDED = 'SUSPENDED', 'Suspended'

	class CredentialStatus(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		APPROVED = 'APPROVED', 'Approved'
		REJECTED = 'REJECTED', 'Rejected'

	provider = models.ForeignKey(User, on_delete=models.CASCADE, related_name='network_memberships')
	scheme = models.ForeignKey(SchemeCategory, on_delete=models.CASCADE, related_name='provider_memberships')
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	effective_from = models.DateField(default=djtz.now)
	effective_to = models.DateField(null=True, blank=True)
	credential_status = models.CharField(max_length=20, choices=CredentialStatus.choices, default=CredentialStatus.PENDING)
	credentialed_at = models.DateTimeField(null=True, blank=True)
	notes = models.TextField(blank=True)
	meta = models.JSONField(default=dict, blank=True)

	class Meta:
		unique_together = ('provider', 'scheme')
		indexes = [
			models.Index(fields=['scheme', 'status']),
			models.Index(fields=['provider', 'status']),
		]

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.provider.username} in {self.scheme.name} ({self.status})"


class CredentialingDocument(models.Model):
	class DocType(models.TextChoices):
		LICENSE = 'LICENSE', 'License'
		CONTRACT = 'CONTRACT', 'Contract'
		INSURANCE = 'INSURANCE', 'Insurance'
		OTHER = 'OTHER', 'Other'

	class ReviewStatus(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		REVIEWED = 'REVIEWED', 'Reviewed'
		REJECTED = 'REJECTED', 'Rejected'

	membership = models.ForeignKey('accounts.ProviderNetworkMembership', on_delete=models.CASCADE, related_name='documents')
	uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='credentialing_uploads')
	file = models.FileField(upload_to=provider_doc_path)
	doc_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.OTHER)
	notes = models.CharField(max_length=255, blank=True)
	status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['membership', 'created_at']),
		]


# Import session models from separate file
from .models_sessions import UserSession, SessionSettings, cleanup_expired_sessions

