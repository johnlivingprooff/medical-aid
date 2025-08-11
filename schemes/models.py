from django.db import models


class SchemeCategory(models.Model):
	name = models.CharField(max_length=100, unique=True)
	description = models.TextField(blank=True)

	def __str__(self) -> str:  # pragma: no cover - simple repr
		return self.name


class SchemeBenefit(models.Model):
	class BenefitType(models.TextChoices):
		CONSULTATION = 'CONSULTATION', 'Consultation'
		LAB = 'LAB', 'Laboratory'
		PHARMACY = 'PHARMACY', 'Pharmacy'
		INPATIENT = 'INPATIENT', 'Inpatient'
		IMAGING = 'IMAGING', 'Imaging'

	class CoveragePeriod(models.TextChoices):
		PER_VISIT = 'PER_VISIT', 'Per Visit'
		MONTHLY = 'MONTHLY', 'Monthly'
		YEARLY = 'YEARLY', 'Yearly'

	scheme = models.ForeignKey(SchemeCategory, on_delete=models.CASCADE, related_name='benefits')
	benefit_type = models.CharField(max_length=50, choices=BenefitType.choices)
	coverage_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
	coverage_limit_count = models.PositiveIntegerField(null=True, blank=True, help_text='Max number of uses in period')
	coverage_period = models.CharField(max_length=20, choices=CoveragePeriod.choices, default=CoveragePeriod.YEARLY)

	class Meta:
		unique_together = ('scheme', 'benefit_type')

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.scheme.name} - {self.benefit_type}"

# Module-level aliases for inner TextChoices (helps tools like drf-spectacular reference them)
BenefitType = SchemeBenefit.BenefitType
CoveragePeriod = SchemeBenefit.CoveragePeriod

