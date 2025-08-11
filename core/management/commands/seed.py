from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from schemes.models import SchemeCategory, SchemeBenefit
from claims.models import Patient


class Command(BaseCommand):
    help = "Seed sample data for development"

    def handle(self, *args, **options):
        User = get_user_model()
        admin, _ = User.objects.get_or_create(username='admin', defaults={'role': 'ADMIN'})
        if not admin.password:
            admin.set_password('Password123!')
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

        SchemeBenefit.objects.get_or_create(scheme=vip, benefit_type='CONSULTATION', defaults={'coverage_amount': 500.0, 'coverage_period': 'YEARLY'})
        SchemeBenefit.objects.get_or_create(scheme=vip, benefit_type='PHARMACY', defaults={'coverage_amount': 300.0, 'coverage_period': 'MONTHLY'})
        SchemeBenefit.objects.get_or_create(scheme=std, benefit_type='CONSULTATION', defaults={'coverage_amount': 200.0, 'coverage_period': 'YEARLY'})

        Patient.objects.get_or_create(user=patient_user, defaults={'date_of_birth': '1990-01-01', 'gender': 'M', 'scheme': vip})

        self.stdout.write(self.style.SUCCESS('Seed data created.'))
