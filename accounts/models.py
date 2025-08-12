from django.contrib.auth.models import AbstractUser
from django.db import models


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

	def __str__(self) -> str:
		return f"{self.username} ({self.role})"


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
	phone = models.CharField(max_length=50, blank=True)
	address = models.CharField(max_length=255, blank=True)
	city = models.CharField(max_length=100, blank=True)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.facility_name} ({self.get_facility_type_display()})"

