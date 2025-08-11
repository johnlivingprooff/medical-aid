from datetime import datetime, timedelta, timezone
from typing import Tuple

from django.db.models import Sum

from .models import Claim, Patient
from schemes.models import SchemeBenefit
from core.models import Alert


def _period_start(period: str, now: datetime) -> datetime:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if period == SchemeBenefit.CoveragePeriod.PER_VISIT:
        return now
    if period == SchemeBenefit.CoveragePeriod.MONTHLY:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)


def validate_and_process_claim(claim: Claim) -> Tuple[bool, float, str]:
    patient: Patient = claim.patient
    service_type = claim.service_type
    try:
        benefit: SchemeBenefit = SchemeBenefit.objects.get(scheme=patient.scheme, benefit_type=service_type)
    except SchemeBenefit.DoesNotExist:
        return False, 0.0, "Service not covered by patient's scheme"

    now = claim.date_submitted
    start = _period_start(benefit.coverage_period, now)

    approved_qs = Claim.objects.filter(
        patient=patient,
        service_type=service_type,
        status=Claim.Status.APPROVED,
        date_submitted__gte=start,
    )

    if benefit.coverage_limit_count is not None:
        used_count = approved_qs.count()
        if used_count >= benefit.coverage_limit_count:
            return False, 0.0, "Usage count exceeded for coverage period"

    payable = float(claim.cost)
    if benefit.coverage_amount is not None:
        used_amount = float(approved_qs.aggregate(total=Sum("cost"))['total'] or 0.0)
        remaining = float(benefit.coverage_amount) - used_amount
        if remaining <= 0:
            return False, 0.0, "No remaining coverage amount"
        payable = max(min(payable, remaining), 0.0)

    return True, payable, "OK"


def emit_low_balance_alerts(claim: Claim, benefit: SchemeBenefit, remaining_after: float, remaining_count: int | None):
    threshold_amount = float(benefit.coverage_amount) * 0.1 if benefit.coverage_amount else None
    if threshold_amount is not None and remaining_after <= threshold_amount:
        Alert.objects.create(
            type=Alert.Type.LOW_BALANCE,
            patient=claim.patient,
            message=f"Low balance for {benefit.get_benefit_type_display()}: remaining {remaining_after:.2f}",
        )
    if remaining_count is not None and remaining_count <= 1:
        Alert.objects.create(
            type=Alert.Type.LOW_BALANCE,
            patient=claim.patient,
            message=f"Usage nearly exhausted for {benefit.get_benefit_type_display()} (only {remaining_count} left)",
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
                f"Provider {claim.provider.username} submitted {recent_count} {claim.service_type} "
                f"claims for patient {claim.patient.user.username} in 24h"
            ),
        )
