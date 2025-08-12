from django.db import models


class SchemeCategory(models.Model):
	name = models.CharField(max_length=100, unique=True)
	description = models.TextField(blank=True)
	price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

	def __str__(self) -> str:  # pragma: no cover - simple repr
		return self.name


class BenefitType(models.Model):
	name = models.CharField(max_length=50, unique=True)

	def __str__(self) -> str:  # pragma: no cover
		return self.name


class SchemeBenefit(models.Model):

	class CoveragePeriod(models.TextChoices):
		PER_VISIT = 'PER_VISIT', 'Per Visit'
		MONTHLY = 'MONTHLY', 'Monthly'
		QUARTERLY = 'QUARTERLY', 'Quarterly'
		YEARLY = 'YEARLY', 'Yearly'
		LIFETIME = 'LIFETIME', 'Lifetime'
		BENEFIT_YEAR = 'BENEFIT_YEAR', 'Benefit Year'

	scheme = models.ForeignKey(SchemeCategory, on_delete=models.CASCADE, related_name='benefits')
	benefit_type = models.ForeignKey(BenefitType, on_delete=models.CASCADE, related_name='scheme_benefits')
	coverage_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Maximum coverage amount')
	coverage_limit_count = models.PositiveIntegerField(null=True, blank=True, help_text='Max number of uses in period')
	coverage_period = models.CharField(max_length=20, choices=CoveragePeriod.choices, default=CoveragePeriod.BENEFIT_YEAR)
	
	# Medical Aid specific features
	deductible_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text='Amount patient pays before coverage kicks in')
	copayment_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='Percentage of cost patient must pay')
	copayment_fixed = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text='Fixed amount patient must pay per visit')
	
	# Pre-authorization requirements
	requires_preauth = models.BooleanField(default=False, help_text='Requires pre-authorization before treatment')
	preauth_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Amount above which pre-auth is required')
	
	# Waiting periods
	waiting_period_days = models.PositiveIntegerField(default=0, help_text='Days to wait before benefit is active')
	
	# Provider restrictions
	network_only = models.BooleanField(default=False, help_text='Only cover in-network providers')
	
	is_active = models.BooleanField(default=True)
	effective_date = models.DateField(auto_now_add=True)
	expiry_date = models.DateField(null=True, blank=True)

	class Meta:
		unique_together = ('scheme', 'benefit_type')

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.scheme.name} - {self.benefit_type}"

# Module-level alias for CoveragePeriod (helps tools like drf-spectacular reference it)
CoveragePeriod = SchemeBenefit.CoveragePeriod

