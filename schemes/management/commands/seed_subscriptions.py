"""
Management command to seed initial subscription data for development.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from schemes.models import SchemeCategory, BenefitCategory, SubscriptionTier
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seed initial subscription data for development'

    def handle(self, *args, **options):
        self.stdout.write('Seeding subscription data...')

        with transaction.atomic():
            # Create benefit categories
            self.create_benefit_categories()

            # Create subscription tiers for existing schemes
            self.create_subscription_tiers()

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded subscription data')
        )

    def create_benefit_categories(self):
        """Create basic benefit categories"""
        categories_data = [
            {
                'name': 'Core Medical',
                'description': 'Essential medical services including consultations and basic treatments',
                'subscription_required': True,
                'access_rules': {'priority': 'high', 'emergency_access': True}
            },
            {
                'name': 'Specialist Care',
                'description': 'Specialist consultations and treatments',
                'subscription_required': True,
                'access_rules': {'requires_referral': True, 'waiting_period_days': 7}
            },
            {
                'name': 'Hospitalization',
                'description': 'In-patient hospital treatment and surgery',
                'subscription_required': True,
                'access_rules': {'pre_auth_required': True, 'case_management': True}
            },
            {
                'name': 'Maternity Care',
                'description': 'Pregnancy, childbirth, and postnatal care',
                'subscription_required': True,
                'access_rules': {'waiting_period_months': 12, 'max_dependents': 4}
            },
            {
                'name': 'Dental Care',
                'description': 'Dental examinations, cleanings, and basic treatments',
                'subscription_required': False,
                'access_rules': {'annual_limit': 2000, 'preventive_focused': True}
            },
            {
                'name': 'Optical Care',
                'description': 'Eye examinations and corrective lenses',
                'subscription_required': False,
                'access_rules': {'annual_limit': 1500, 'preventive_focused': True}
            }
        ]

        for category_data in categories_data:
            category, created = BenefitCategory.objects.get_or_create(
                name=category_data['name'],
                defaults=category_data
            )
            if created:
                self.stdout.write(f'Created benefit category: {category.name}')

    def create_subscription_tiers(self):
        """Create subscription tiers for existing schemes"""
        schemes = SchemeCategory.objects.all()

        for scheme in schemes:
            # Skip if tiers already exist for this scheme
            if SubscriptionTier.objects.filter(scheme=scheme).exists():
                self.stdout.write(f'Skipping {scheme.name} - tiers already exist')
                continue

            # Get benefit categories for this scheme's benefits
            scheme_benefits = scheme.benefits.all()
            benefit_categories = BenefitCategory.objects.filter(
                name__in=[benefit.benefit_type.name for benefit in scheme_benefits]
            )

            # Create Basic tier
            basic_tier = SubscriptionTier.objects.create(
                name='Basic',
                scheme=scheme,
                tier_type='BASIC',
                description='Essential coverage for basic medical needs',
                monthly_price=Decimal('150.00'),
                yearly_price=Decimal('1800.00'),
                max_dependents=2,
                max_claims_per_month=10,
                max_coverage_per_year=Decimal('5000.00'),
                sort_order=1
            )
            basic_tier.benefit_categories.set(benefit_categories.filter(subscription_required=True))
            self.stdout.write(f'Created Basic tier for {scheme.name}')

            # Create Standard tier
            standard_tier = SubscriptionTier.objects.create(
                name='Standard',
                scheme=scheme,
                tier_type='STANDARD',
                description='Comprehensive coverage for most medical needs',
                monthly_price=Decimal('300.00'),
                yearly_price=Decimal('3600.00'),
                max_dependents=4,
                max_claims_per_month=25,
                max_coverage_per_year=Decimal('15000.00'),
                sort_order=2
            )
            standard_tier.benefit_categories.set(benefit_categories)
            self.stdout.write(f'Created Standard tier for {scheme.name}')

            # Create Premium tier
            premium_tier = SubscriptionTier.objects.create(
                name='Premium',
                scheme=scheme,
                tier_type='PREMIUM',
                description='Complete coverage with all available benefits',
                monthly_price=Decimal('500.00'),
                yearly_price=Decimal('6000.00'),
                max_dependents=6,
                max_claims_per_month=None,  # Unlimited
                max_coverage_per_year=Decimal('50000.00'),
                sort_order=3
            )
            premium_tier.benefit_categories.set(benefit_categories)
            self.stdout.write(f'Created Premium tier for {scheme.name}')

            self.stdout.write(f'Created 3 subscription tiers for {scheme.name}')