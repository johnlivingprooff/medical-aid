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

