"""
Seed six realistic coverage scenarios for demos and QA.

Scenarios created:
1) Coverage limit exhausted (benefit used up, new claim pending/partial)
2) Remaining balance (benefit with remaining amount; claim fully approved)
3) Deductible + copay (invoice shows member responsibility)
4) Waiting period not met (claim rejected with reason)
5) Subscription inactive/expired (claim rejected)
6) Pre-authorization required (claim left pending until preauth)

Idempotent: running multiple times will reuse or update existing demo records.

Usage:
  python manage.py seed_demo_scenarios
  python manage.py seed_demo_scenarios --reset  # purge demo users/claims first
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Tuple

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone as djtz

from accounts.models import User
from claims.models import Claim, Patient
from claims.services import validate_and_process_claim_enhanced
from schemes.models import (
    SchemeCategory,
    BenefitType,
    SchemeBenefit,
    SubscriptionTier,
    MemberSubscription,
)


DEMO_SCHEME_NAME = "Demo Medical Scheme"
PROVIDER_USERNAME = "demo_provider"


class Command(BaseCommand):
    help = "Seed demo coverage scenarios (idempotent). Use --reset to purge demo data first."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo data before seeding",
        )

    def handle(self, *args, **options):
        reset = options.get("reset", False)
        self.stdout.write(self.style.SUCCESS("Seeding coverage scenarios (demo)"))

        if reset:
            self._reset_demo_data()

        with transaction.atomic():
            scheme = self._ensure_scheme()
            types = self._ensure_benefit_types()
            self._ensure_scheme_benefits(scheme, types)
            tiers = self._ensure_tiers(scheme)
            provider = self._ensure_provider()

            # Seed patients + subscriptions per scenario
            results = []
            results.append(self._scenario_limit_exhausted(provider, scheme, types, tiers))
            results.append(self._scenario_remaining_balance(provider, scheme, types, tiers))
            results.append(self._scenario_deductible_copay(provider, scheme, types, tiers))
            results.append(self._scenario_waiting_period(provider, scheme, types, tiers))
            results.append(self._scenario_subscription_inactive(provider, scheme, types, tiers))
            results.append(self._scenario_preauth_required(provider, scheme, types, tiers))

        # Print summary
        self.stdout.write("")
        for name, claim, msg in results:
            claim_id = getattr(claim, "id", None)
            self.stdout.write(
                self.style.SUCCESS(f"✔ {name}: claim #{claim_id} – {msg}")
            )

        self.stdout.write(self.style.SUCCESS("Done."))

    # ----- helpers -----

    def _reset_demo_data(self):
        self.stdout.write("Resetting demo data…")
        # Delete demo claims first (FK constraints)
        Claim.objects.filter(provider__username=PROVIDER_USERNAME).delete()
        # Delete demo patients (usernames prefixed)
        demo_usernames = [
            "demo_member_limit",
            "demo_member_balance",
            "demo_member_copay",
            "demo_member_wait",
            "demo_member_inactive",
            "demo_member_preauth",
        ]
        User = get_user_model()
        for uname in demo_usernames + [PROVIDER_USERNAME]:
            User.objects.filter(username=uname).delete()
        # Keep scheme and types to avoid breaking other data; they are reused idempotently
        self.stdout.write(self.style.WARNING("Demo users/claims removed. Scheme/types retained."))

    def _ensure_scheme(self) -> SchemeCategory:
        scheme, _ = SchemeCategory.objects.get_or_create(
            name=DEMO_SCHEME_NAME,
            defaults={"description": "Demo scheme for coverage scenarios", "price": Decimal("0.00")},
        )
        return scheme

    def _ensure_benefit_types(self):
        names = [
            "GP Consultation",
            "Laboratory Test",
            "Surgery",
            "Maternity Care",
            "Pediatric Care",
        ]
        mapping = {}
        for n in names:
            bt, _ = BenefitType.objects.get_or_create(name=n)
            mapping[n] = bt
        return mapping

    def _ensure_scheme_benefits(self, scheme: SchemeCategory, types: dict[str, BenefitType]):
        # 1) GP Consultation – yearly cap, small deductible and copay
        SchemeBenefit.objects.get_or_create(
            scheme=scheme,
            benefit_type=types["GP Consultation"],
            defaults={
                "coverage_amount": Decimal("2000.00"),
                "coverage_limit_count": 12,
                "coverage_period": SchemeBenefit.CoveragePeriod.YEARLY,
                "deductible_amount": Decimal("100.00"),
                "copayment_percentage": Decimal("10.00"),
                "copayment_fixed": Decimal("0.00"),
                "waiting_period_days": 0,
                "requires_preauth": False,
            },
        )

        # 2) Laboratory Test – modest cap, demonstrates remaining/exhausted
        SchemeBenefit.objects.get_or_create(
            scheme=scheme,
            benefit_type=types["Laboratory Test"],
            defaults={
                "coverage_amount": Decimal("1000.00"),
                "coverage_limit_count": 6,
                "coverage_period": SchemeBenefit.CoveragePeriod.YEARLY,
                "deductible_amount": Decimal("0.00"),
                "copayment_percentage": Decimal("0.00"),
                "copayment_fixed": Decimal("0.00"),
                "waiting_period_days": 0,
                "requires_preauth": False,
            },
        )

        # 3) Surgery – high cost, requires preauth
        SchemeBenefit.objects.get_or_create(
            scheme=scheme,
            benefit_type=types["Surgery"],
            defaults={
                "coverage_amount": Decimal("50000.00"),
                "coverage_limit_count": 2,
                "coverage_period": SchemeBenefit.CoveragePeriod.BENEFIT_YEAR,
                "deductible_amount": Decimal("0.00"),
                "copayment_percentage": Decimal("10.00"),
                "copayment_fixed": Decimal("500.00"),
                "waiting_period_days": 0,
                "requires_preauth": True,
                "preauth_limit": Decimal("2000.00"),
            },
        )

        # 4) Maternity Care – lifetime with long waiting period
        SchemeBenefit.objects.get_or_create(
            scheme=scheme,
            benefit_type=types["Maternity Care"],
            defaults={
                "coverage_amount": Decimal("15000.00"),
                "coverage_limit_count": 1,
                "coverage_period": SchemeBenefit.CoveragePeriod.LIFETIME,
                "deductible_amount": Decimal("0.00"),
                "copayment_percentage": Decimal("0.00"),
                "copayment_fixed": Decimal("0.00"),
                "waiting_period_days": 365,
                "requires_preauth": True,
                "preauth_limit": Decimal("1000.00"),
            },
        )

        # 5) Pediatric Care – for age rule demonstration
        SchemeBenefit.objects.get_or_create(
            scheme=scheme,
            benefit_type=types["Pediatric Care"],
            defaults={
                "coverage_amount": Decimal("3000.00"),
                "coverage_limit_count": 6,
                "coverage_period": SchemeBenefit.CoveragePeriod.YEARLY,
                "waiting_period_days": 0,
                "requires_preauth": False,
            },
        )

    def _ensure_tiers(self, scheme: SchemeCategory):
        # Simple two tiers; prices follow model validation (yearly >= 10x monthly)
        basic, _ = SubscriptionTier.objects.get_or_create(
            scheme=scheme,
            tier_type=SubscriptionTier.TierType.BASIC,
            defaults={
                "name": "Basic",
                "description": "Entry tier",
                "monthly_price": Decimal("100.00"),
                "yearly_price": Decimal("1200.00"),
                "max_dependents": 2,
                "max_claims_per_month": 5,
                "max_coverage_per_year": Decimal("20000.00"),
                "is_active": True,
            },
        )
        standard, _ = SubscriptionTier.objects.get_or_create(
            scheme=scheme,
            tier_type=SubscriptionTier.TierType.STANDARD,
            defaults={
                "name": "Standard",
                "description": "Standard tier",
                "monthly_price": Decimal("200.00"),
                "yearly_price": Decimal("2400.00"),
                "max_dependents": 4,
                "max_claims_per_month": 10,
                "max_coverage_per_year": Decimal("50000.00"),
                "is_active": True,
            },
        )
        return {"basic": basic, "standard": standard}

    def _ensure_provider(self) -> User:
        UserModel = get_user_model()
        provider, created = UserModel.objects.get_or_create(
            username=PROVIDER_USERNAME,
            defaults={
                "email": "provider.demo@example.com",
                "first_name": "Demo",
                "last_name": "Provider",
                "role": "PROVIDER",
            },
        )
        if created:
            provider.set_password("provider123!")
            provider.save(update_fields=["password"])
        elif provider.role != "PROVIDER":
            provider.role = "PROVIDER"
            provider.save(update_fields=["role"])
        return provider

    def _ensure_patient_with_subscription(
        self,
        username: str,
        scheme: SchemeCategory,
        tier: SubscriptionTier,
        enrollment_days_ago: int = 400,
        active_subscription: bool = True,
        expired: bool = False,
    ) -> Patient:
        UserModel = get_user_model()
        user, created = UserModel.objects.get_or_create(
            username=username,
            defaults={
                "email": f"{username}@example.com",
                "first_name": username.replace("_", " ").title(),
                "last_name": "Demo",
                "role": "PATIENT",
            },
        )
        if created:
            user.set_password("member123!")
            user.save(update_fields=["password"])
        else:
            if user.role != "PATIENT":
                user.role = "PATIENT"
                user.save(update_fields=["role"])

        # Patient
        dob = date(1990, 1, 1)
        enrollment_date = djtz.now().date() - timedelta(days=enrollment_days_ago)
        patient, _ = Patient.objects.get_or_create(
            user=user,
            defaults={
                "date_of_birth": dob,
                "gender": "M",
                "scheme": scheme,
                "status": Patient.Status.ACTIVE,
                "enrollment_date": enrollment_date,
            },
        )
        # Ensure scheme and enrollment if reused
        updated = False
        if patient.scheme_id != scheme.id:
            patient.scheme = scheme
            updated = True
        if not patient.enrollment_date:
            patient.enrollment_date = enrollment_date
            updated = True
        if updated:
            patient.save(update_fields=["scheme", "enrollment_date"])  # triggers member_id generation if needed

        # Subscription
        start = djtz.now().date() - timedelta(days=90)
        end = djtz.now().date() + timedelta(days=275)
        if expired:
            start = djtz.now().date() - timedelta(days=400)
            end = djtz.now().date() - timedelta(days=5)
        status = (
            MemberSubscription.SubscriptionStatus.ACTIVE
            if active_subscription and not expired
            else MemberSubscription.SubscriptionStatus.INACTIVE
        )
        sub, created = MemberSubscription.objects.get_or_create(
            patient=patient,
            defaults={
                "tier": tier,
                "subscription_type": MemberSubscription.BillingPeriod.MONTHLY,
                "status": status,
                "start_date": start,
                "end_date": end,
                "auto_renew": True,
            },
        )
        if not created:
            changed = []
            if sub.tier_id != tier.id:
                sub.tier = tier
                changed.append("tier")
            if sub.status != status:
                sub.status = status
                changed.append("status")
            if expired and sub.end_date >= djtz.now().date():
                sub.end_date = end
                changed.append("end_date")
            if changed:
                sub.save(update_fields=changed)

        return patient

    # ----- scenarios -----

    def _create_and_process_claim(self, *, patient: Patient, provider: User, service: BenefitType, cost: Decimal, date_of_service: date | None = None) -> Tuple[Claim, str]:
        claim = Claim.objects.create(
            patient=patient,
            provider=provider,
            service_type=service,
            cost=Decimal(str(cost)),
            date_of_service=date_of_service or djtz.now().date(),
        )
        approved, payable, reason, _details = validate_and_process_claim_enhanced(claim)
        if approved:
            claim.status = Claim.Status.APPROVED
            claim.coverage_checked = True
            claim.processed_date = djtz.now()
            claim.processed_by = provider
            claim.save(update_fields=["status", "coverage_checked", "processed_date", "processed_by"])
            msg = f"APPROVED (scheme pays {payable:.2f})"
        else:
            # Mark PENDING if preauth required; otherwise REJECTED with reason
            if "Pre-authorization required" in str(reason):
                claim.status = Claim.Status.PENDING
                claim.coverage_checked = False
                msg = "PENDING (pre-authorization required)"
                claim.save(update_fields=["status", "coverage_checked"])
            else:
                claim.status = Claim.Status.REJECTED
                claim.coverage_checked = True
                claim.rejection_reason = str(reason)[:1024]
                claim.rejection_date = djtz.now()
                claim.processed_by = provider
                claim.save(update_fields=["status", "coverage_checked", "rejection_reason", "rejection_date", "processed_by"])
                msg = f"REJECTED ({reason})"
        return claim, msg

    def _scenario_limit_exhausted(self, provider, scheme, types, tiers):
        # Lab Test: coverage 1000; pre-use 950, then claim 200 -> partial or capped
        patient = self._ensure_patient_with_subscription("demo_member_limit", scheme, tiers["basic"], enrollment_days_ago=400)

        # Pre-use coverage with approved claims
        past1, _ = Claim.objects.get_or_create(
            patient=patient,
            provider=provider,
            service_type=types["Laboratory Test"],
            cost=Decimal("500.00"),
            defaults={"status": Claim.Status.APPROVED, "date_submitted": djtz.now() - timedelta(days=30)},
        )
        if past1.status != Claim.Status.APPROVED:
            past1.status = Claim.Status.APPROVED
            past1.save(update_fields=["status"]) 
        past2, _ = Claim.objects.get_or_create(
            patient=patient,
            provider=provider,
            service_type=types["Laboratory Test"],
            cost=Decimal("450.00"),
            defaults={"status": Claim.Status.APPROVED, "date_submitted": djtz.now() - timedelta(days=15)},
        )
        if past2.status != Claim.Status.APPROVED:
            past2.status = Claim.Status.APPROVED
            past2.save(update_fields=["status"]) 

        claim, msg = self._create_and_process_claim(
            patient=patient,
            provider=provider,
            service=types["Laboratory Test"],
            cost=Decimal("200.00"),
        )
        return ("Coverage limit exhausted", claim, msg)

    def _scenario_remaining_balance(self, provider, scheme, types, tiers):
        patient = self._ensure_patient_with_subscription("demo_member_balance", scheme, tiers["basic"], enrollment_days_ago=400)
        # Use 300 of 2000 for GP; new claim 400 fully approved
        pre, _ = Claim.objects.get_or_create(
            patient=patient,
            provider=provider,
            service_type=types["GP Consultation"],
            cost=Decimal("300.00"),
            defaults={"status": Claim.Status.APPROVED, "date_submitted": djtz.now() - timedelta(days=10)},
        )
        if pre.status != Claim.Status.APPROVED:
            pre.status = Claim.Status.APPROVED
            pre.save(update_fields=["status"]) 
        claim, msg = self._create_and_process_claim(
            patient=patient,
            provider=provider,
            service=types["GP Consultation"],
            cost=Decimal("400.00"),
        )
        return ("Remaining balance", claim, msg)

    def _scenario_deductible_copay(self, provider, scheme, types, tiers):
        patient = self._ensure_patient_with_subscription("demo_member_copay", scheme, tiers["standard"], enrollment_days_ago=400)
        claim, msg = self._create_and_process_claim(
            patient=patient,
            provider=provider,
            service=types["GP Consultation"],
            cost=Decimal("800.00"),
        )
        return ("Deductible and copay applied", claim, msg)

    def _scenario_waiting_period(self, provider, scheme, types, tiers):
        # Maternity has 365 waiting days; enroll 30 days ago to fail
        patient = self._ensure_patient_with_subscription("demo_member_wait", scheme, tiers["standard"], enrollment_days_ago=30)
        claim, msg = self._create_and_process_claim(
            patient=patient,
            provider=provider,
            service=types["Maternity Care"],
            cost=Decimal("5000.00"),
        )
        return ("Waiting period not met", claim, msg)

    def _scenario_subscription_inactive(self, provider, scheme, types, tiers):
        patient = self._ensure_patient_with_subscription("demo_member_inactive", scheme, tiers["basic"], enrollment_days_ago=400, active_subscription=False)
        claim, msg = self._create_and_process_claim(
            patient=patient,
            provider=provider,
            service=types["GP Consultation"],
            cost=Decimal("300.00"),
        )
        return ("Subscription inactive", claim, msg)

    def _scenario_preauth_required(self, provider, scheme, types, tiers):
        patient = self._ensure_patient_with_subscription("demo_member_preauth", scheme, tiers["standard"], enrollment_days_ago=400)
        # Surgery requires preauth; no preauth number -> pending
        claim, msg = self._create_and_process_claim(
            patient=patient,
            provider=provider,
            service=types["Surgery"],
            cost=Decimal("10000.00"),
        )
        return ("Pre-authorization required", claim, msg)
