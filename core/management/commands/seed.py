from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from schemes.models import SchemeCategory, SchemeBenefit, BenefitType
from claims.models import Patient, Claim, Invoice


class Command(BaseCommand):
    help = "Seed sample data for development"

    def handle(self, *args, **options):
        User = get_user_model()
        admin, _ = User.objects.get_or_create(username='admin', defaults={'role': 'ADMIN'})
        if not admin.password:
            admin.set_password('Password123!')
        # Ensure admin privileges for Django admin site
        changed = False
        if not getattr(admin, 'is_staff', False):
            admin.is_staff = True
            changed = True
        if not getattr(admin, 'is_superuser', False):
            admin.is_superuser = True
            changed = True
        if changed or not admin.password:
            admin.save()
        provider, _ = User.objects.get_or_create(username='provider', defaults={'role': 'PROVIDER'})
        if not provider.password:
            provider.set_password('Password123!')
            provider.save()
        patient_user, _ = User.objects.get_or_create(username='patient', defaults={'role': 'PATIENT'})
        if not patient_user.password:
            patient_user.set_password('Password123!')
            patient_user.save()

        vip, _ = SchemeCategory.objects.get_or_create(name='VIP', defaults={'description': 'VIP scheme'})
        std, _ = SchemeCategory.objects.get_or_create(name='Standard', defaults={'description': 'Standard scheme'})

        consult, _ = BenefitType.objects.get_or_create(name='CONSULTATION')
        lab, _ = BenefitType.objects.get_or_create(name='LAB')
        pharmacy, _ = BenefitType.objects.get_or_create(name='PHARMACY')
        imaging, _ = BenefitType.objects.get_or_create(name='IMAGING')

        SchemeBenefit.objects.get_or_create(
            scheme=vip,
            benefit_type=consult,
            defaults={'coverage_amount': Decimal('500.00'), 'coverage_limit_count': 1, 'coverage_period': SchemeBenefit.CoveragePeriod.YEARLY},
        )
        SchemeBenefit.objects.get_or_create(
            scheme=vip,
            benefit_type=pharmacy,
            defaults={'coverage_amount': Decimal('300.00'), 'coverage_limit_count': 12, 'coverage_period': SchemeBenefit.CoveragePeriod.MONTHLY},
        )
        SchemeBenefit.objects.get_or_create(
            scheme=std,
            benefit_type=consult,
            defaults={'coverage_amount': Decimal('200.00'), 'coverage_limit_count': 1, 'coverage_period': SchemeBenefit.CoveragePeriod.YEARLY},
        )

        patient, _ = Patient.objects.get_or_create(
            user=patient_user,
            defaults={'date_of_birth': '1990-01-01', 'gender': 'M', 'scheme': vip},
        )

        # Sample claims & invoices for analytics (idempotent: only create if none exist)
        if not Claim.objects.exists():
            now = timezone.now()
            # Approved consultation (with PAID invoice); submitted 5 days ago
            c1 = Claim.objects.create(
                patient=patient,
                provider=provider,
                service_type=consult,
                cost=Decimal('150.00'),
                date_submitted=now - timedelta(days=5),
                status=Claim.Status.APPROVED,
                coverage_checked=True,
            )
            inv1 = Invoice.objects.create(claim=c1, amount=c1.cost)
            inv1.payment_status = Invoice.PaymentStatus.PAID
            inv1.save(update_fields=["payment_status"])

            # Pending pharmacy claim; submitted 1 day ago
            Claim.objects.create(
                patient=patient,
                provider=provider,
                service_type=pharmacy,
                cost=Decimal('75.00'),
                date_submitted=now - timedelta(days=1),
                status=Claim.Status.PENDING,
                coverage_checked=False,
            )

            # Rejected lab claim; submitted 2 days ago
            Claim.objects.create(
                patient=patient,
                provider=provider,
                service_type=lab,
                cost=Decimal('300.00'),
                date_submitted=now - timedelta(days=2),
                status=Claim.Status.REJECTED,
                coverage_checked=True,
            )

            # Approved imaging with PENDING invoice; submitted 10 days ago
            c4 = Claim.objects.create(
                patient=patient,
                provider=provider,
                service_type=imaging,
                cost=Decimal('1200.00'),
                date_submitted=now - timedelta(days=10),
                status=Claim.Status.APPROVED,
                coverage_checked=True,
            )
            Invoice.objects.create(claim=c4, amount=c4.cost)  # defaults to PENDING

        self.stdout.write(self.style.SUCCESS('Seed data created/verified.'))
        # Recompute scheme prices after seeding benefits
        from django.db.models import F, Sum
        for scheme in SchemeCategory.objects.all():
            total = (
                SchemeBenefit.objects.filter(scheme=scheme)
                .annotate(final=F('coverage_amount') * F('coverage_limit_count'))
                .aggregate(total=Sum('final'))['total'] or 0
            )
            if scheme.price != total:
                scheme.price = total
                scheme.save(update_fields=['price'])
