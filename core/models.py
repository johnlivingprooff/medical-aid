from django.conf import settings
from django.db import models


class Alert(models.Model):
	class Type(models.TextChoices):
		LOW_BALANCE = 'LOW_BALANCE', 'Low Balance'
		FRAUD_SUSPECT = 'FRAUD_SUSPECT', 'Fraud Suspect'
		SCHEME_ABUSE = 'SCHEME_ABUSE', 'Scheme Abuse'

	class Severity(models.TextChoices):
		INFO = 'INFO', 'Info'
		WARNING = 'WARNING', 'Warning'
		CRITICAL = 'CRITICAL', 'Critical'

	type = models.CharField(max_length=32, choices=Type.choices)
	message = models.TextField()
	severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.WARNING)
	patient = models.ForeignKey('claims.Patient', on_delete=models.CASCADE, null=True, blank=True, related_name='alerts')
	created_at = models.DateTimeField(auto_now_add=True)
	is_read = models.BooleanField(default=False)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.type} - {self.severity} - {self.created_at:%Y-%m-%d}"

