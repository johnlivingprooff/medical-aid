from datetime import datetime, timedelta, timezone
from typing import Tuple, Dict, List, Optional
from decimal import Decimal
from django.db import models
from django.db.models import Sum, Q, Count, Case, When
from django.utils import timezone as djtz
from django.core.exceptions import ValidationError

from .models import Claim, Patient, PreAuthorizationRequest, PreAuthorizationApproval, FraudAlert
from schemes.models import SchemeBenefit, BenefitType, MemberSubscription
from core.models import Alert, SystemSettings


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

    def _check_provider_network_status(self, provider) -> bool:
        """Check if provider is in-network"""
        # Placeholder - in real implementation, this would check against provider network table
        # For now, assume all providers are in-network
        return True


class PreAuthorizationService:
    """Service for managing pre-authorization requests and automated approval rules"""

    def __init__(self):
        self.rules_cache = None
        self._load_rules()

    def _load_rules(self):
        """Load active approval rules into cache"""
        from .models import PreAuthorizationRule
        self.rules_cache = list(PreAuthorizationRule.objects.filter(is_active=True).order_by('priority'))

    def check_auto_approval_eligibility(self, preauth_request) -> bool:
        """Check if a pre-authorization request qualifies for auto-approval"""
        for rule in self.rules_cache:
            if self.evaluate_rule(rule, preauth_request):
                if rule.action == rule.Action.AUTO_APPROVE:
                    return True
                elif rule.action == rule.Action.AUTO_REJECT:
                    return False
        return False

    def evaluate_rule(self, rule, preauth_request) -> bool:
        """Evaluate if a rule applies to the pre-authorization request"""
        conditions = rule.conditions

        if rule.rule_type == rule.RuleType.COST_THRESHOLD:
            return self._evaluate_cost_threshold(conditions, preauth_request)

        elif rule.rule_type == rule.RuleType.SERVICE_TYPE:
            return self._evaluate_service_type(conditions, preauth_request)

        elif rule.rule_type == rule.RuleType.PROVIDER_TIER:
            return self._evaluate_provider_tier(conditions, preauth_request)

        elif rule.rule_type == rule.RuleType.PATIENT_HISTORY:
            return self._evaluate_patient_history(conditions, preauth_request)

        elif rule.rule_type == rule.RuleType.DIAGNOSIS_BASED:
            return self._evaluate_diagnosis_based(conditions, preauth_request)

        elif rule.rule_type == rule.RuleType.COMPOSITE:
            return self._evaluate_composite_rule(conditions, preauth_request)

        return False

    def _evaluate_cost_threshold(self, conditions, preauth_request) -> bool:
        """Evaluate cost threshold rule"""
        max_amount = conditions.get('max_amount', 0)
        min_amount = conditions.get('min_amount', 0)
        service_types = conditions.get('service_types', [])

        # Check amount range
        if preauth_request.estimated_cost < min_amount or preauth_request.estimated_cost > max_amount:
            return False

        # Check service type if specified
        if service_types and preauth_request.service_type.name not in service_types:
            return False

        return True

    def _evaluate_service_type(self, conditions, preauth_request) -> bool:
        """Evaluate service type rule"""
        allowed_types = conditions.get('allowed_request_types', [])
        excluded_types = conditions.get('excluded_request_types', [])

        if allowed_types and preauth_request.request_type not in allowed_types:
            return False

        if excluded_types and preauth_request.request_type in excluded_types:
            return False

        return True

    def _evaluate_provider_tier(self, conditions, preauth_request) -> bool:
        """Evaluate provider tier rule"""
        allowed_tiers = conditions.get('allowed_tiers', [])
        # For now, assume all providers are tier 1
        # In real implementation, this would check provider profile
        provider_tier = 1

        return provider_tier in allowed_tiers

    def _evaluate_patient_history(self, conditions, preauth_request) -> bool:
        """Evaluate patient history rule"""
        from .models import Claim

        # Check if patient has had similar services before
        previous_claims = Claim.objects.filter(
            patient=preauth_request.patient,
            service_type=preauth_request.service_type,
            status=Claim.Status.APPROVED
        ).count()

        min_previous_claims = conditions.get('min_previous_claims', 0)
        max_previous_claims = conditions.get('max_previous_claims', float('inf'))

        return min_previous_claims <= previous_claims <= max_previous_claims

    def _evaluate_diagnosis_based(self, conditions, preauth_request) -> bool:
        """Evaluate diagnosis-based rule"""
        allowed_diagnoses = conditions.get('allowed_diagnoses', [])
        excluded_diagnoses = conditions.get('excluded_diagnoses', [])

        # For now, check against diagnosis field
        # In real implementation, this would use ICD codes
        diagnosis = preauth_request.diagnosis.lower() if preauth_request.diagnosis else ""

        for allowed in allowed_diagnoses:
            if allowed.lower() in diagnosis:
                return True

        for excluded in excluded_diagnoses:
            if excluded.lower() in diagnosis:
                return False

        return len(allowed_diagnoses) == 0  # If no allowed diagnoses specified, allow all

    def _evaluate_composite_rule(self, conditions, preauth_request) -> bool:
        """Evaluate composite rule with multiple conditions"""
        operator = conditions.get('operator', 'AND')  # AND or OR
        sub_rules = conditions.get('rules', [])

        results = []
        for sub_rule_conditions in sub_rules:
            # Recursively evaluate sub-rules
            sub_rule = type('MockRule', (), {
                'rule_type': sub_rule_conditions.get('type'),
                'conditions': sub_rule_conditions
            })()
            results.append(self.evaluate_rule(sub_rule, preauth_request))

        if operator == 'AND':
            return all(results)
        elif operator == 'OR':
            return any(results)

        return False

    def process_auto_approval(self, preauth_request):
        """Process auto-approval for eligible requests"""
        from .models import PreAuthorizationApproval
        from django.utils import timezone
        from datetime import timedelta

        # Find applicable rule
        applicable_rule = None
        for rule in self.rules_cache:
            if self.evaluate_rule(rule, preauth_request) and rule.action == rule.Action.AUTO_APPROVE:
                applicable_rule = rule
                break

        if not applicable_rule:
            return False

        # Auto-approve the request
        preauth_request.status = preauth_request.Status.APPROVED
        preauth_request.processed_date = timezone.now()
        preauth_request.auto_approved = True
        preauth_request.approval_rule_applied = applicable_rule.name
        preauth_request.approved_amount = preauth_request.estimated_cost
        preauth_request.approval_expiry = timezone.now().date() + timedelta(days=preauth_request.requested_validity_days)
        preauth_request.save()

        # Create approval record
        approval = PreAuthorizationApproval.objects.create(
            preauth_request=preauth_request,
            approval_type=PreAuthorizationApproval.ApprovalType.FULL,
            approved_amount=preauth_request.estimated_cost,
            validity_period_days=preauth_request.requested_validity_days,
            approved_by=None,  # System auto-approval
        )

        return True

    def get_pending_requests_by_priority(self):
        """Get pending pre-authorization requests ordered by priority"""
        from .models import PreAuthorizationRequest

        priority_order = {
            PreAuthorizationRequest.Priority.EMERGENCY: 1,
            PreAuthorizationRequest.Priority.URGENT: 2,
            PreAuthorizationRequest.Priority.ROUTINE: 3,
        }

        return PreAuthorizationRequest.objects.filter(
            status=PreAuthorizationRequest.Status.PENDING
        ).order_by(
            Case(
                *[When(priority=priority, then=value) for priority, value in priority_order.items()]
            ),
            'date_requested'
        )

    def check_expired_requests(self):
        """Check for expired pre-authorization requests and update their status"""
        from .models import PreAuthorizationRequest
        from django.utils import timezone

        expired_requests = PreAuthorizationRequest.objects.filter(
            status=PreAuthorizationRequest.Status.PENDING,
            date_requested__lt=timezone.now() - timezone.timedelta(days=30)
        )

        for request in expired_requests:
            request.status = PreAuthorizationRequest.Status.EXPIRED
            request.save()

        return expired_requests.count()

    def generate_provider_notifications(self, preauth_request):
        """Generate notifications for providers about pre-authorization decisions"""
        from core.models import Alert

        if preauth_request.status == PreAuthorizationRequest.Status.APPROVED:
            message = f"Pre-authorization {preauth_request.request_number} approved for patient {preauth_request.patient.user.username}"
            alert_type = Alert.Type.INFO
        elif preauth_request.status == PreAuthorizationRequest.Status.REJECTED:
            message = f"Pre-authorization {preauth_request.request_number} rejected for patient {preauth_request.patient.user.username}"
            alert_type = Alert.Type.WARNING
        else:
            return

        Alert.objects.create(
            type=alert_type,
            provider=preauth_request.provider,
            message=message,
        )

    def get_request_statistics(self):
        """Get statistics about pre-authorization requests"""
        from .models import PreAuthorizationRequest
        from django.utils import timezone

        # Get requests from last 30 days
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)

        stats = PreAuthorizationRequest.objects.filter(
            date_requested__gte=thirty_days_ago
        ).aggregate(
            total_requests=Count('id'),
            approved_requests=Count('id', filter=Q(status=PreAuthorizationRequest.Status.APPROVED)),
            rejected_requests=Count('id', filter=Q(status=PreAuthorizationRequest.Status.REJECTED)),
            pending_requests=Count('id', filter=Q(status=PreAuthorizationRequest.Status.PENDING)),
            auto_approved=Count('id', filter=Q(auto_approved=True)),
        )

        return stats


# Enhanced validation function that uses the new engine
def validate_and_process_claim_enhanced(claim: Claim) -> Tuple[bool, float, str, Dict]:
    """Enhanced claim validation using the new validation engine"""
    engine = ClaimsValidationEngine()
    return engine.validate_claim_comprehensive(claim)


def validate_and_process_claim(claim: Claim) -> Tuple[bool, float, str]:
    """Enhanced claim validation with subscription-based benefit access"""
    patient: Patient = claim.patient
    service_type: BenefitType = claim.service_type

    # Check if patient has an active subscription
    if not hasattr(patient, 'subscription') or not patient.subscription:
        return False, 0.0, "Patient does not have an active subscription"

    subscription = patient.subscription
    if not subscription.is_active:
        return False, 0.0, f"Patient's subscription is {subscription.get_status_display().lower()}"

    # Check if the benefit type is included in the patient's subscription tier
    if not subscription.can_access_benefit(service_type):
        return False, 0.0, f"Benefit type '{service_type.name}' is not included in {subscription.tier.name} tier"

    # Check waiting period (using subscription start date)
    enrollment_date = subscription.start_date
    service_date = getattr(claim, 'date_of_service', None)
    if service_date is None:
        service_date = getattr(claim, 'date_submitted', None)
        if service_date is None:
            from django.utils import timezone
            service_date = timezone.now().date()
        else:
            service_date = service_date.date()

    days_since_subscription = (service_date - enrollment_date).days

    # Check if pre-authorization is required based on subscription rules
    # For now, use a simple rule: pre-auth required for claims over $1000
    preauth_threshold = 1000.00
    if float(claim.cost) >= preauth_threshold and not claim.preauth_number:
        return False, 0.0, f"Pre-authorization required for claims over ${preauth_threshold}"

    # Check subscription limits
    tier = subscription.tier

    # Check monthly claim limit
    if tier.max_claims_per_month:
        current_month_start = service_date.replace(day=1)
        monthly_claims = Claim.objects.filter(
            patient=patient,
            status__in=[Claim.Status.APPROVED, Claim.Status.PAID],
            date_submitted__gte=current_month_start,
            date_submitted__lte=service_date
        ).count()

        if monthly_claims >= tier.max_claims_per_month:
            return False, 0.0, f"Monthly claim limit ({tier.max_claims_per_month}) exceeded"

    # Check yearly coverage limit
    if tier.max_coverage_per_year:
        current_year_start = service_date.replace(month=1, day=1)
        yearly_usage = Claim.objects.filter(
            patient=patient,
            status__in=[Claim.Status.APPROVED, Claim.Status.PAID],
            date_submitted__gte=current_year_start,
            date_submitted__lte=service_date
        ).aggregate(total=Sum('approved_amount'))['total'] or Decimal('0.00')

        if yearly_usage >= tier.max_coverage_per_year:
            return False, 0.0, f"Yearly coverage limit (${tier.max_coverage_per_year}) exceeded"

    # Calculate payable amount based on subscription rules
    claim_amount = float(claim.cost)

    # For subscription-based model, we'll use a simplified approach:
    # - No deductibles (covered by subscription pricing)
    # - Fixed copayment of 10% or $50, whichever is greater
    copay_percentage = 10.0
    copay_minimum = 50.0

    patient_copay = max(copay_minimum, claim_amount * copay_percentage / 100)
    payable = claim_amount - patient_copay

    # Ensure payable amount doesn't exceed remaining yearly coverage
    if tier.max_coverage_per_year:
        remaining_coverage = tier.max_coverage_per_year - yearly_usage
        payable = min(payable, float(remaining_coverage))

    # Ensure payable is not negative
    payable = max(payable, 0)

    return True, payable, "OK"


def emit_low_balance_alerts(claim: Claim, subscription: MemberSubscription, remaining_after: float, remaining_count: int | None):
    """Emit alerts for low subscription balance or usage limits"""
    tier = subscription.tier

    # Check yearly coverage threshold (10% remaining)
    if tier.max_coverage_per_year:
        threshold_amount = float(tier.max_coverage_per_year) * 0.1
        if remaining_after <= threshold_amount:
            Alert.objects.create(
                type=Alert.Type.LOW_BALANCE,
                patient=claim.patient,
                message=f"Low balance for {tier.name} subscription: remaining ${remaining_after:.2f}",
            )

    # Check monthly claim limit threshold
    if remaining_count is not None and remaining_count <= 1 and tier.max_claims_per_month:
        Alert.objects.create(
            type=Alert.Type.LOW_BALANCE,
            patient=claim.patient,
            message=f"Monthly claim limit nearly exhausted for {tier.name} (only {remaining_count} left)",
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


class FraudDetectionEngine:
    """Advanced fraud detection engine with multiple detection algorithms"""

    def __init__(self):
        self.detection_rules = {
            'duplicate_claim': self._detect_duplicate_claims,
            'unusual_frequency': self._detect_unusual_frequency,
            'amount_anomaly': self._detect_amount_anomaly,
            'provider_pattern': self._detect_provider_pattern,
            'patient_pattern': self._detect_patient_pattern,
            'service_mismatch': self._detect_service_mismatch,
            'temporal_anomaly': self._detect_temporal_anomaly,
            'network_violation': self._detect_network_violation,
        }

    def detect_fraud_patterns(self, claim: Claim) -> List[Dict]:
        """
        Run all fraud detection algorithms on a claim
        Returns list of detected fraud patterns with scores and details
        """
        fraud_alerts = []

        for rule_name, detection_func in self.detection_rules.items():
            try:
                result = detection_func(claim)
                if result:
                    fraud_alerts.append(result)
            except Exception as e:
                # Log error but continue with other detections
                print(f"Error in fraud detection rule {rule_name}: {e}")
                continue

        return fraud_alerts

    def calculate_overall_fraud_score(self, claim: Claim) -> float:
        """
        Calculate overall fraud score based on all detection algorithms
        Returns score between 0.0 and 1.0
        """
        alerts = self.detect_fraud_patterns(claim)

        if not alerts:
            return 0.0

        # Weight alerts by severity
        total_weighted_score = 0.0
        total_weight = 0.0

        severity_weights = {
            'LOW': 0.2,
            'MEDIUM': 0.5,
            'HIGH': 0.8,
            'CRITICAL': 1.0
        }

        for alert in alerts:
            severity = alert.get('severity', 'MEDIUM')
            score = alert.get('score', 0.0)
            weight = severity_weights.get(severity, 0.5)

            total_weighted_score += score * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return min(total_weighted_score / total_weight, 1.0)

    def _detect_duplicate_claims(self, claim: Claim) -> Optional[Dict]:
        """Detect duplicate or near-duplicate claims"""
        from .models import FraudAlert

        # Check for identical claims in short time window
        window_start = claim.date_submitted - timedelta(hours=24)

        duplicate_claims = Claim.objects.filter(
            patient=claim.patient,
            service_type=claim.service_type,
            cost=claim.cost,
            date_submitted__gte=window_start,
            date_of_service=claim.date_of_service
        ).exclude(id=claim.id)

        if duplicate_claims.exists():
            duplicate = duplicate_claims.first()
            return {
                'alert_type': FraudAlert.AlertType.DUPLICATE_CLAIM,
                'severity': 'HIGH',
                'score': 0.9,
                'title': 'Duplicate Claim Detected',
                'description': f'Identical claim found within 24 hours (Claim #{duplicate.id})',
                'detection_rule': 'duplicate_claim',
                'detection_data': {
                    'duplicate_claim_id': duplicate.id,
                    'time_difference_hours': (claim.date_submitted - duplicate.date_submitted).total_seconds() / 3600
                }
            }

        # Check for similar claims (same patient, provider, service type, date)
        similar_claims = Claim.objects.filter(
            patient=claim.patient,
            provider=claim.provider,
            service_type=claim.service_type,
            date_of_service=claim.date_of_service
        ).exclude(id=claim.id)

        if similar_claims.count() > 1:
            return {
                'alert_type': FraudAlert.AlertType.DUPLICATE_CLAIM,
                'severity': 'MEDIUM',
                'score': 0.7,
                'title': 'Multiple Similar Claims',
                'description': f'Multiple claims for same service on same date ({similar_claims.count()} total)',
                'detection_rule': 'duplicate_claim',
                'detection_data': {
                    'similar_claims_count': similar_claims.count(),
                    'claim_ids': list(similar_claims.values_list('id', flat=True))
                }
            }

        return None

    def _detect_unusual_frequency(self, claim: Claim) -> Optional[Dict]:
        """Detect unusually frequent claims"""
        from .models import FraudAlert

        # Check claims in last 7 days
        week_start = claim.date_submitted - timedelta(days=7)

        recent_claims = Claim.objects.filter(
            patient=claim.patient,
            date_submitted__gte=week_start
        ).exclude(id=claim.id)

        if recent_claims.count() > 10:  # More than 10 claims in a week
            return {
                'alert_type': FraudAlert.AlertType.UNUSUAL_FREQUENCY,
                'severity': 'HIGH',
                'score': 0.8,
                'title': 'Unusual Claim Frequency',
                'description': f'Patient submitted {recent_claims.count() + 1} claims in 7 days',
                'detection_rule': 'unusual_frequency',
                'detection_data': {
                    'claims_in_week': recent_claims.count() + 1,
                    'average_daily': round((recent_claims.count() + 1) / 7, 2)
                }
            }

        # Check same service type frequency
        service_claims = recent_claims.filter(service_type=claim.service_type)
        if service_claims.count() > 3:  # More than 3 of same service type
            return {
                'alert_type': FraudAlert.AlertType.UNUSUAL_FREQUENCY,
                'severity': 'MEDIUM',
                'score': 0.6,
                'title': 'Frequent Same Service Claims',
                'description': f'Patient submitted {service_claims.count() + 1} {claim.service_type.name} claims in 7 days',
                'detection_rule': 'unusual_frequency',
                'detection_data': {
                    'service_type': claim.service_type.name,
                    'claims_of_type': service_claims.count() + 1
                }
            }

        return None

    def _detect_amount_anomaly(self, claim: Claim) -> Optional[Dict]:
        """Detect anomalous claim amounts"""
        from .models import FraudAlert

        # Get historical claims for this service type
        historical_claims = Claim.objects.filter(
            service_type=claim.service_type,
            status=Claim.Status.APPROVED
        ).exclude(id=claim.id)

        if historical_claims.count() < 5:  # Not enough data
            return None

        # Calculate statistics
        amounts = list(historical_claims.values_list('cost', flat=True))
        avg_amount = sum(amounts) / len(amounts)
        max_amount = max(amounts)
        min_amount = min(amounts)

        # Check if current claim is significantly higher than average
        if float(claim.cost) > avg_amount * 3:
            return {
                'alert_type': FraudAlert.AlertType.AMOUNT_ANOMALY,
                'severity': 'HIGH',
                'score': 0.85,
                'title': 'Amount Significantly Above Average',
                'description': f'Claim amount (${claim.cost}) is {claim.cost / avg_amount:.1f}x the average for {claim.service_type.name}',
                'detection_rule': 'amount_anomaly',
                'detection_data': {
                    'claim_amount': float(claim.cost),
                    'average_amount': avg_amount,
                    'max_historical': max_amount,
                    'multiplier': float(claim.cost / avg_amount)
                }
            }

        # Check if amount is unusually high compared to max historical
        if float(claim.cost) > max_amount * 1.5:
            return {
                'alert_type': FraudAlert.AlertType.AMOUNT_ANOMALY,
                'severity': 'MEDIUM',
                'score': 0.6,
                'title': 'Amount Above Historical Maximum',
                'description': f'Claim amount (${claim.cost}) exceeds maximum historical amount (${max_amount})',
                'detection_rule': 'amount_anomaly',
                'detection_data': {
                    'claim_amount': float(claim.cost),
                    'max_historical': max_amount,
                    'excess_percentage': ((float(claim.cost) - max_amount) / max_amount) * 100
                }
            }

        return None

    def _detect_provider_pattern(self, claim: Claim) -> Optional[Dict]:
        """Detect suspicious provider patterns"""
        from .models import FraudAlert

        # Check provider's claim volume in last 24 hours
        window_start = claim.date_submitted - timedelta(hours=24)

        provider_claims = Claim.objects.filter(
            provider=claim.provider,
            date_submitted__gte=window_start
        )

        if provider_claims.count() > 50:  # Very high volume
            return {
                'alert_type': FraudAlert.AlertType.PROVIDER_PATTERN,
                'severity': 'HIGH',
                'score': 0.75,
                'title': 'High Provider Claim Volume',
                'description': f'Provider submitted {provider_claims.count()} claims in 24 hours',
                'detection_rule': 'provider_pattern',
                'detection_data': {
                    'provider_claims_24h': provider_claims.count(),
                    'average_hourly': provider_claims.count() / 24
                }
            }

        # Check provider's rejection rate
        total_provider_claims = Claim.objects.filter(provider=claim.provider)
        rejected_claims = total_provider_claims.filter(status=Claim.Status.REJECTED)

        if total_provider_claims.count() > 10:
            rejection_rate = rejected_claims.count() / total_provider_claims.count()

            if rejection_rate > 0.5:  # High rejection rate
                return {
                    'alert_type': FraudAlert.AlertType.PROVIDER_PATTERN,
                    'severity': 'MEDIUM',
                    'score': 0.65,
                    'title': 'High Provider Rejection Rate',
                    'description': f'Provider has {rejection_rate:.1%} rejection rate ({rejected_claims.count()}/{total_provider_claims.count()})',
                    'detection_rule': 'provider_pattern',
                    'detection_data': {
                        'total_claims': total_provider_claims.count(),
                        'rejected_claims': rejected_claims.count(),
                        'rejection_rate': rejection_rate
                    }
                }

        return None

    def _detect_patient_pattern(self, claim: Claim) -> Optional[Dict]:
        """Detect suspicious patient patterns"""
        from .models import FraudAlert

        # Check if patient has claims with multiple providers on same day
        day_start = claim.date_of_service
        day_end = day_start + timedelta(days=1)

        same_day_claims = Claim.objects.filter(
            patient=claim.patient,
            date_of_service__gte=day_start,
            date_of_service__lt=day_end
        ).exclude(id=claim.id)

        providers_count = same_day_claims.values('provider').distinct().count()

        if providers_count > 2:  # Claims with more than 2 providers on same day
            return {
                'alert_type': FraudAlert.AlertType.PATIENT_PATTERN,
                'severity': 'MEDIUM',
                'score': 0.7,
                'title': 'Multiple Providers Same Day',
                'description': f'Patient has claims with {providers_count + 1} different providers on {day_start.date()}',
                'detection_rule': 'patient_pattern',
                'detection_data': {
                    'date': str(day_start.date()),
                    'providers_count': providers_count + 1,
                    'claim_ids': list(same_day_claims.values_list('id', flat=True)) + [claim.id]
                }
            }

        return None

    def _detect_service_mismatch(self, claim: Claim) -> Optional[Dict]:
        """Detect service type and amount mismatches"""
        from .models import FraudAlert

        # This is a placeholder for more sophisticated service matching
        # In a real implementation, this would check CPT codes, diagnosis codes, etc.

        # For now, just check for round number amounts (potential fraud indicator)
        if float(claim.cost) % 100 == 0 and float(claim.cost) >= 1000:
            return {
                'alert_type': FraudAlert.AlertType.SERVICE_MISMATCH,
                'severity': 'LOW',
                'score': 0.4,
                'title': 'Round Number Amount',
                'description': f'Claim amount (${claim.cost}) is a round number, which may indicate potential issues',
                'detection_rule': 'service_mismatch',
                'detection_data': {
                    'claim_amount': float(claim.cost),
                    'is_round_hundred': True
                }
            }

        return None

    def _detect_temporal_anomaly(self, claim: Claim) -> Optional[Dict]:
        """Detect temporal anomalies in claim patterns"""
        from .models import FraudAlert

        # Check for claims submitted at unusual hours
        submission_hour = claim.date_submitted.hour

        # More lenient business hours: 5 AM - 11 PM (allows early morning/late evening)
        if submission_hour < 5 or submission_hour > 23:  # Outside 5 AM - 11 PM
            return {
                'alert_type': FraudAlert.AlertType.TEMPORAL_ANOMALY,
                'severity': 'LOW',
                'score': 0.3,
                'title': 'Unusual Submission Time',
                'description': f'Claim submitted at {submission_hour}:00, outside normal business hours (5 AM - 11 PM)',
                'detection_rule': 'temporal_anomaly',
                'detection_data': {
                    'submission_hour': submission_hour,
                    'submission_time': str(claim.date_submitted.time())
                }
            }

        return None

    def _detect_network_violation(self, claim: Claim) -> Optional[Dict]:
        """Detect network violations (out-of-network providers)"""
        from .models import FraudAlert

        # Placeholder - in real implementation, this would check provider network status
        # For now, assume all providers are in-network
        return None


def create_fraud_alerts_from_patterns(claim: Claim, fraud_alerts: List[Dict]) -> List[FraudAlert]:
    """
    Create FraudAlert model instances from detected fraud patterns
    Returns list of created FraudAlert objects
    """
    created_alerts = []

    for alert_data in fraud_alerts:
        alert = FraudAlert.objects.create(
            claim=claim,
            patient=claim.patient,
            provider=claim.provider,
            alert_type=alert_data['alert_type'],
            severity=alert_data['severity'],
            title=alert_data['title'],
            description=alert_data['description'],
            fraud_score=Decimal(str(alert_data['score'])),
            detection_rule=alert_data['detection_rule'],
            detection_data=alert_data['detection_data']
        )
        created_alerts.append(alert)

    return created_alerts


# Enhanced Claims Validation Engine - Phase 2

class ClaimsValidationEngine:
    """Advanced claims validation engine with complex business rules"""

    def __init__(self):
        self.validation_errors = []
        self.warnings = []

    def validate_claim_comprehensive(self, claim: Claim) -> Tuple[bool, float, str, Dict]:
        """
        Comprehensive claim validation with detailed breakdown
        Returns: (is_valid, payable_amount, message, details_dict)
        """
        self.validation_errors = []
        self.warnings = []

        patient = claim.patient
        service_type = claim.service_type

        # Basic validations
        if not self._validate_patient_eligibility(patient):
            return False, 0.0, "; ".join(self.validation_errors), {}

        if not self._validate_service_coverage(claim):
            return False, 0.0, "; ".join(self.validation_errors), {}

        # Advanced validations
        if not self._validate_waiting_periods(claim):
            return False, 0.0, "; ".join(self.validation_errors), {}

        if not self._validate_pre_authorization(claim):
            return False, 0.0, "; ".join(self.validation_errors), {}

        if not self._validate_network_restrictions(claim):
            return False, 0.0, "; ".join(self.validation_errors), {}

        if not self._validate_age_restrictions(claim):
            return False, 0.0, "; ".join(self.validation_errors), {}

        # Calculate payable amount with detailed breakdown
        payable_details = self._calculate_payable_amount_detailed(claim)

        if payable_details['payable_amount'] <= 0:
            return False, 0.0, "No payable amount after applying all rules", payable_details

        # Fraud detection
        fraud_score = self._calculate_fraud_score(claim)
        fraud_engine = FraudDetectionEngine()
        fraud_alerts = fraud_engine.detect_fraud_patterns(claim)

        if fraud_score > 0.8:
            self.warnings.append(f"High fraud risk detected (score: {fraud_score:.2f})")

        payable_details['fraud_score'] = fraud_score
        payable_details['fraud_alerts'] = fraud_alerts
        payable_details['warnings'] = self.warnings

        return True, payable_details['payable_amount'], "Validation successful", payable_details

    def _validate_patient_eligibility(self, patient: Patient) -> bool:
        """Validate patient eligibility for claims"""
        if patient.status != Patient.Status.ACTIVE:
            self.validation_errors.append(f"Patient status is {patient.status}, not active")
            return False

        if not patient.enrollment_date:
            self.validation_errors.append("Patient enrollment date is missing")
            return False

        if not patient.scheme:
            self.validation_errors.append("Patient is not enrolled in any scheme")
            return False

        return True

    def _validate_service_coverage(self, claim: Claim) -> bool:
        """Validate that the service is covered by patient's scheme"""
        try:
            benefit = SchemeBenefit.objects.get(
                scheme=claim.patient.scheme,
                benefit_type=claim.service_type
            )
            claim._benefit = benefit  # Cache for later use
        except SchemeBenefit.DoesNotExist:
            self.validation_errors.append(
                f"Service '{claim.service_type.name}' is not covered by scheme '{claim.patient.scheme.name}'"
            )
            return False

        if not benefit.is_currently_active:
            self.validation_errors.append(f"Benefit for {claim.service_type.name} is not currently active")
            return False

        return True

    def _validate_waiting_periods(self, claim: Claim) -> bool:
        """Enhanced waiting period validation"""
        benefit = getattr(claim, '_benefit', None)
        if not benefit:
            return False

        patient = claim.patient
        service_date = claim.date_of_service or claim.date_submitted.date()

        # Calculate days since enrollment
        days_since_enrollment = (service_date - patient.enrollment_date).days

        # Check general waiting period
        if days_since_enrollment < benefit.waiting_period_days:
            remaining_days = benefit.waiting_period_days - days_since_enrollment
            self.validation_errors.append(
                f"General waiting period not met. {remaining_days} days remaining"
            )
            return False

        # Check age-specific waiting periods (for dependents)
        if patient.is_dependent and patient.age is not None and patient.age < 18:
            # Special waiting periods for children
            child_waiting_days = benefit.waiting_period_days * 2  # Example: double waiting period for minors
            if days_since_enrollment < child_waiting_days:
                remaining_days = child_waiting_days - days_since_enrollment
                self.validation_errors.append(
                    f"Child waiting period not met. {remaining_days} days remaining"
                )
                return False

        # Check maternity waiting period (if applicable)
        if self._is_maternity_related(claim) and patient.age is not None and patient.age >= 18:
            maternity_waiting_days = 365  # 1 year waiting period for maternity
            if days_since_enrollment < maternity_waiting_days:
                remaining_days = maternity_waiting_days - days_since_enrollment
                self.validation_errors.append(
                    f"Maternity waiting period not met. {remaining_days} days remaining"
                )
                return False

        return True

    def _validate_pre_authorization(self, claim: Claim) -> bool:
        """Enhanced pre-authorization validation"""
        benefit = getattr(claim, '_benefit', None)
        if not benefit:
            return False

        # Check if pre-auth is required
        requires_preauth = benefit.requires_preauth

        # Check amount-based pre-auth requirement
        preauth_limit = benefit.preauth_limit
        if not preauth_limit:
            preauth_limit = SystemSettings.get_setting('PREAUTH_THRESHOLD', Decimal('1000.00'))
        
        if preauth_limit and float(claim.cost) >= float(preauth_limit):
            requires_preauth = True

        if requires_preauth and not claim.preauth_number:
            self.validation_errors.append("Pre-authorization required for this service")
            return False

        # Validate pre-auth expiry if provided
        if claim.preauth_number and claim.preauth_expiry:
            if claim.date_of_service and claim.preauth_expiry < claim.date_of_service:
                self.validation_errors.append("Pre-authorization has expired")
                return False

        return True

    def _validate_network_restrictions(self, claim: Claim) -> bool:
        """Validate network provider restrictions"""
        benefit = getattr(claim, '_benefit', None)
        if not benefit:
            return False

        if benefit.network_only:
            # Check if provider is in-network (this would need provider network data)
            # For now, we'll assume all providers are in-network
            # In a real implementation, this would check against a provider network table
            provider_network_status = self._check_provider_network_status(claim.provider)
            if not provider_network_status:
                self.validation_errors.append("Provider is not in the approved network")
                return False

        return True

    def _validate_age_restrictions(self, claim: Claim) -> bool:
        """Validate age-based benefit restrictions"""
        patient = claim.patient

        # Age restrictions for certain services
        if claim.service_type.name.lower() in ['maternity', 'pregnancy care']:
            if patient.age is None or patient.age < 18 or patient.age > 45:
                self.validation_errors.append("Age restriction for maternity services")
                return False

        if claim.service_type.name.lower() in ['pediatric care', 'child vaccination']:
            if patient.age is None or patient.age >= 18:
                self.validation_errors.append("Service restricted to pediatric patients")
                return False

        if claim.service_type.name.lower() in ['geriatric care', 'senior care']:
            if patient.age is None or patient.age < 65:
                self.validation_errors.append("Service restricted to senior patients")
                return False

        return True

    def _calculate_payable_amount_detailed(self, claim: Claim) -> Dict:
        """Detailed payable amount calculation with breakdown"""
        benefit = getattr(claim, '_benefit', None)
        if not benefit:
            return {'payable_amount': 0.0, 'breakdown': {}}

        claim_amount = float(claim.cost)
        breakdown = {
            'original_amount': claim_amount,
            'deductible_applied': 0.0,
            'copayment_applied': 0.0,
            'coverage_limit_applied': 0.0,
            'payable_amount': 0.0
        }

        # Calculate period for usage tracking
        now = claim.date_submitted
        start = _period_start(benefit.coverage_period, now, claim.patient)

        approved_qs = Claim.objects.filter(
            patient=claim.patient,
            service_type=claim.service_type,
            status=Claim.Status.APPROVED,
            date_submitted__gte=start,
        )

        # Apply deductible
        deductible_amount = float(benefit.deductible_amount or 0)
        if deductible_amount > 0:
            deductible_paid = float(approved_qs.aggregate(total=Sum('cost'))['total'] or 0)
            remaining_deductible = max(deductible_amount - deductible_paid, 0)
            patient_deductible = min(remaining_deductible, claim_amount)
            claim_amount -= patient_deductible
            breakdown['deductible_applied'] = patient_deductible

        # Apply copayments
        copay_percentage = float(benefit.copayment_percentage or 0)
        copay_fixed = float(benefit.copayment_fixed or 0)

        patient_copay = copay_fixed + (claim_amount * copay_percentage / 100)
        claim_amount -= patient_copay
        breakdown['copayment_applied'] = patient_copay

        # Apply coverage limits
        payable = max(claim_amount, 0)
        if benefit.coverage_amount is not None:
            used_amount = float(approved_qs.aggregate(total=Sum("cost"))['total'] or 0.0)
            remaining = float(benefit.coverage_amount) - used_amount
            if remaining <= 0:
                payable = 0
                breakdown['coverage_limit_applied'] = claim_amount
            else:
                payable = min(payable, remaining)
                breakdown['coverage_limit_applied'] = max(claim_amount - remaining, 0)

        breakdown['payable_amount'] = payable
        return breakdown

    def _calculate_fraud_score(self, claim: Claim) -> float:
        """Calculate fraud risk score for the claim using advanced detection engine"""
        fraud_engine = FraudDetectionEngine()
        return fraud_engine.calculate_overall_fraud_score(claim)

    def _is_maternity_related(self, claim: Claim) -> bool:
        """Check if claim is maternity-related"""
        maternity_keywords = ['maternity', 'pregnancy', 'obstetric', 'gynecology', 'antenatal']
        service_name = claim.service_type.name.lower()
        return any(keyword in service_name for keyword in maternity_keywords)

    def _check_provider_network_status(self, provider) -> bool:
        """Check if provider is in-network"""
        # Placeholder - in real implementation, this would check against provider network table
        # For now, assume all providers are in-network
        return True


# Enhanced validation function that uses the new engine
def validate_and_process_claim_enhanced(claim: Claim) -> Tuple[bool, float, str, Dict]:
    """Enhanced claim validation using the new validation engine"""
    engine = ClaimsValidationEngine()
    return engine.validate_claim_comprehensive(claim)
