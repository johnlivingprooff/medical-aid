from datetime import datetime, timedelta, timezone
from typing import Tuple
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone as djtz

from .models import Claim, Patient
from schemes.models import SchemeBenefit, BenefitType
from core.models import Alert


def _period_start(period: str, now: datetime, patient: Patient = None) -> datetime:
    """Calculate period start for benefit coverage, considering medical aid specific rules"""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    
    if period == SchemeBenefit.CoveragePeriod.PER_VISIT:
        return now
    elif period == SchemeBenefit.CoveragePeriod.MONTHLY:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == SchemeBenefit.CoveragePeriod.QUARTERLY:
        quarter_start_month = ((now.month - 1) // 3) * 3 + 1
        return now.replace(month=quarter_start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == SchemeBenefit.CoveragePeriod.YEARLY:
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == SchemeBenefit.CoveragePeriod.BENEFIT_YEAR and patient:
        # Use patient's benefit year start date
        benefit_start = patient.benefit_year_start_date
        current_year = now.year
        # Find the most recent benefit year start
        benefit_year_start = benefit_start.replace(year=current_year)
        if benefit_year_start > now.date():
            benefit_year_start = benefit_start.replace(year=current_year - 1)
        return djtz.make_aware(datetime.combine(benefit_year_start, datetime.min.time()))
    elif period == SchemeBenefit.CoveragePeriod.LIFETIME:
        return datetime(1900, 1, 1, tzinfo=timezone.utc)
    else:
        # Default to yearly
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)


def validate_and_process_claim(claim: Claim) -> Tuple[bool, float, str]:
    """Enhanced claim validation with medical aid business logic"""
    patient: Patient = claim.patient
    service_type: BenefitType = claim.service_type
    
    try:
        benefit: SchemeBenefit = SchemeBenefit.objects.get(scheme=patient.scheme, benefit_type=service_type)
    except SchemeBenefit.DoesNotExist:
        return False, 0.0, "Service not covered by patient's scheme"

    # Check if benefit is active
    if not benefit.is_active:
        return False, 0.0, "Benefit is not currently active"
    
    # Check waiting period
    enrollment_date = patient.enrollment_date
    service_date = getattr(claim, 'date_of_service', claim.date_submitted.date())
    days_since_enrollment = (service_date - enrollment_date).days
    
    if days_since_enrollment < benefit.waiting_period_days:
        return False, 0.0, f"Waiting period not met. {benefit.waiting_period_days - days_since_enrollment} days remaining"

    # Check if pre-authorization is required
    if benefit.requires_preauth and not claim.preauth_number:
        if benefit.preauth_limit and float(claim.cost) >= float(benefit.preauth_limit):
            return False, 0.0, "Pre-authorization required for this service amount"
        elif benefit.requires_preauth:
            return False, 0.0, "Pre-authorization required for this service"

    now = claim.date_submitted
    start = _period_start(benefit.coverage_period, now, patient)

    approved_qs = Claim.objects.filter(
        patient=patient,
        service_type=service_type,
        status=Claim.Status.APPROVED,
        date_submitted__gte=start,
    )

    # Check usage count limits
    if benefit.coverage_limit_count is not None:
        used_count = approved_qs.count()
        if used_count >= benefit.coverage_limit_count:
            return False, 0.0, "Usage count exceeded for coverage period"

    # Calculate payable amount considering deductibles and copayments
    claim_amount = float(claim.cost)
    
    # Apply deductible (patient pays first X amount)
    deductible_amount = float(benefit.deductible_amount or 0)
    if deductible_amount > 0:
        # Check if deductible has been met in this period
        deductible_paid = float(approved_qs.aggregate(total=Sum('invoice__patient_deductible'))['total'] or 0)
        remaining_deductible = max(deductible_amount - deductible_paid, 0)
        patient_deductible = min(remaining_deductible, claim_amount)
        payable_after_deductible = claim_amount - patient_deductible
    else:
        patient_deductible = 0
        payable_after_deductible = claim_amount

    # Apply copayments
    copay_percentage = float(benefit.copayment_percentage or 0)
    copay_fixed = float(benefit.copayment_fixed or 0)
    
    patient_copay = copay_fixed + (payable_after_deductible * copay_percentage / 100)
    payable_after_copay = payable_after_deductible - patient_copay

    # Check coverage amount limits
    payable = max(payable_after_copay, 0)
    if benefit.coverage_amount is not None:
        used_amount = float(approved_qs.aggregate(total=Sum("cost"))['total'] or 0.0)
        remaining = float(benefit.coverage_amount) - used_amount
        if remaining <= 0:
            return False, 0.0, "No remaining coverage amount"
        payable = min(payable, remaining)

    return True, payable, "OK"


def emit_low_balance_alerts(claim: Claim, benefit: SchemeBenefit, remaining_after: float, remaining_count: int | None):
    threshold_amount = float(benefit.coverage_amount) * 0.1 if benefit.coverage_amount else None
    if threshold_amount is not None and remaining_after <= threshold_amount:
        Alert.objects.create(
            type=Alert.Type.LOW_BALANCE,
            patient=claim.patient,
            message=f"Low balance for {benefit.benefit_type.name}: remaining {remaining_after:.2f}",
        )
    if remaining_count is not None and remaining_count <= 1:
        Alert.objects.create(
            type=Alert.Type.LOW_BALANCE,
            patient=claim.patient,
            message=f"Usage nearly exhausted for {benefit.benefit_type.name} (only {remaining_count} left)",
        )


def emit_fraud_alert_if_needed(claim: Claim):
    window_start = claim.date_submitted - timedelta(hours=24)
    recent_count = Claim.objects.filter(
        provider=claim.provider,
        patient=claim.patient,
        service_type=claim.service_type,
        date_submitted__gte=window_start,
    ).count()
    if recent_count > 3:
        Alert.objects.create(
            type=Alert.Type.FRAUD_SUSPECT,
            message=(
                f"Provider {claim.provider.username} submitted {recent_count} {claim.service_type.name} "
                f"claims for patient {claim.patient.user.username} in 24h"
            ),
        )
