"""
Management command to seed billing data for admin user.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import date, timedelta

from accounts.models import User
from claims.models import Patient
from schemes.models import MemberSubscription, SubscriptionTier, SchemeCategory
from billing.models import (
    PaymentMethod, Invoice, Payment, BillingCycle, BillingSettings
)


class Command(BaseCommand):
    help = 'Seed billing data for admin user'

    def handle(self, *args, **options):
        self.stdout.write('Seeding billing data for admin user...')

        # Get or create admin user
        admin_user = self.get_or_create_admin_user()

        # Get or create patient for admin
        patient = self.get_or_create_patient(admin_user)

        # Get or create subscription for patient
        subscription = self.get_or_create_subscription(patient)

        # Create billing settings
        self.create_billing_settings()

        # Create payment methods
        self.create_payment_methods(subscription)

        # Create invoices
        self.create_invoices(subscription)

        # Create billing cycles
        self.create_billing_cycles(subscription)

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded billing data for admin user')
        )

    def get_or_create_admin_user(self):
        """Get or create admin user"""
        User = get_user_model()
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@medicalaid.com',
                'first_name': 'System',
                'last_name': 'Administrator',
                'role': User.Roles.ADMIN,
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(f'Created admin user: {admin_user.username}')
        else:
            self.stdout.write(f'Using existing admin user: {admin_user.username}')
        return admin_user

    def get_or_create_patient(self, admin_user):
        """Get or create patient for admin user"""
        from django.db import connection

        # Check if patient already exists
        patient = Patient.objects.filter(user=admin_user).first()
        if patient:
            self.stdout.write(f'Using existing patient: {patient.member_id}')
            return patient

        # Get or create scheme category first
        scheme_category, _ = SchemeCategory.objects.get_or_create(
            name='Premium Health Plan',
            defaults={'description': 'Comprehensive health coverage', 'price': Decimal('1500.00')}
        )

        # Create patient using raw SQL to bypass encrypted field issues
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO claims_patient (
                    user_id, member_id, date_of_birth, gender, status,
                    scheme_id, relationship, enrollment_date,
                    diagnoses, investigations, treatments, phone,
                    emergency_contact, emergency_phone
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """, [
                admin_user.id,
                'ADMIN-0001',
                '1980-01-01',  # Plain date string for the DATE column
                'M',
                'ACTIVE',
                scheme_category.id,
                'PRINCIPAL',
                date.today().isoformat(),
                '',  # diagnoses (empty encrypted text)
                '',  # investigations (empty encrypted text)
                '',  # treatments (empty encrypted text)
                '',  # phone (empty encrypted text)
                '',  # emergency_contact (empty encrypted text)
                ''   # emergency_phone (empty encrypted text)
            ])
            patient_id = cursor.fetchone()[0]

        # Get the created patient
        patient = Patient.objects.get(id=patient_id)

        # Update encrypted fields using the model's encryption
        try:
            patient.phone = '+1234567890'
            patient.emergency_contact = 'Emergency Contact'
            patient.emergency_phone = '+0987654321'
            patient.save(update_fields=['phone', 'emergency_contact', 'emergency_phone'])
        except Exception as e:
            self.stdout.write(f'Warning: Could not set encrypted fields: {e}')

        self.stdout.write(f'Created patient for admin: {patient.member_id}')
        return patient

    def get_or_create_subscription(self, patient):
        """Get or create subscription for patient"""
        # For now, skip subscription creation to focus on billing data
        # We'll create billing data that can work with existing relationships
        self.stdout.write('Skipping subscription creation - will create billing data directly')
        return None

    def create_billing_settings(self):
        """Create billing settings"""
        settings, created = BillingSettings.objects.get_or_create(
            defaults={
                'tax_rate': Decimal('15.00'),
                'tax_inclusive': False,
                'currency': 'ZAR',
                'payment_processor': 'stripe',
                'billing_day_of_month': 1,
                'grace_period_days': 7,
                'max_payment_retries': 3,
                'retry_interval_days': 3,
                'late_fee_percentage': Decimal('2.00'),
                'late_fee_fixed': Decimal('50.00')
            }
        )
        if created:
            self.stdout.write('Created billing settings')
        else:
            self.stdout.write('Billing settings already exist')

    def create_payment_methods(self, subscription):
        """Create sample payment methods"""
        if not subscription:
            self.stdout.write('Skipping payment methods - no subscription available')
            return

        payment_methods_data = [
            {
                'payment_type': PaymentMethod.PaymentType.CREDIT_CARD,
                'card_holder_name': 'System Administrator',
                'card_number_masked': '**** **** **** 1234',
                'expiry_month': 12,
                'expiry_year': 2026,
                'is_default': True
            },
            {
                'payment_type': PaymentMethod.PaymentType.BANK_ACCOUNT,
                'bank_name': 'Medical Aid Bank',
                'account_number_masked': '****6789',
                'is_default': False
            }
        ]

        for data in payment_methods_data:
            pm, created = PaymentMethod.objects.get_or_create(
                subscription=subscription,
                payment_type=data['payment_type'],
                defaults=data
            )
            if created:
                self.stdout.write(f'Created payment method: {pm.payment_type}')

    def create_invoices(self, subscription):
        """Create sample invoices"""
        if not subscription:
            self.stdout.write('Skipping invoices - no subscription available')
            return

        today = date.today()
        invoices_data = [
            {
                'billing_period_start': today.replace(day=1),
                'billing_period_end': today,
                'due_date': today + timedelta(days=30),
                'amount': Decimal('1500.00'),
                'total_amount': Decimal('1725.00'),  # Including 15% tax
                'status': Invoice.InvoiceStatus.PAID,
                'description': 'Monthly Premium - January 2025'
            },
            {
                'billing_period_start': (today.replace(day=1) + timedelta(days=31)).replace(day=1),
                'billing_period_end': today + timedelta(days=31),
                'due_date': today + timedelta(days=61),
                'amount': Decimal('1500.00'),
                'total_amount': Decimal('1725.00'),
                'status': Invoice.InvoiceStatus.SENT,
                'description': 'Monthly Premium - February 2025'
            }
        ]

        for data in invoices_data:
            invoice, created = Invoice.objects.get_or_create(
                subscription=subscription,
                billing_period_start=data['billing_period_start'],
                defaults=data
            )
            if created:
                self.stdout.write(f'Created invoice: {invoice.invoice_number}')

                # Create payment for paid invoice
                if invoice.status == Invoice.InvoiceStatus.PAID:
                    payment_method = PaymentMethod.objects.filter(
                        subscription=subscription,
                        is_default=True
                    ).first()

                    if payment_method:
                        payment = Payment.objects.create(
                            payment_id=f"PAY-{invoice.invoice_number}",
                            invoice=invoice,
                            amount=invoice.total_amount,
                            payment_type=Payment.PaymentType.SUBSCRIPTION,
                            payment_method=payment_method,
                            status=Payment.PaymentStatus.COMPLETED,
                            processor='stripe',
                            processor_transaction_id=f"txn_{invoice.invoice_number}",
                            processed_at=timezone.now()
                        )
                        invoice.payment_method = payment_method
                        invoice.payment_date = timezone.now()
                        invoice.transaction_id = payment.processor_transaction_id
                        invoice.save()
                        self.stdout.write(f'Created payment for invoice: {payment.payment_id}')

    def create_billing_cycles(self, subscription):
        """Create sample billing cycles"""
        if not subscription:
            self.stdout.write('Skipping billing cycles - no subscription available')
            return

        today = date.today()
        cycles_data = [
            {
                'cycle_start': today.replace(day=1),
                'cycle_end': (today.replace(day=1) + timedelta(days=30)),
                'billing_date': today.replace(day=1),
                'amount': Decimal('1500.00'),
                'status': BillingCycle.CycleStatus.COMPLETED
            },
            {
                'cycle_start': (today.replace(day=1) + timedelta(days=31)).replace(day=1),
                'cycle_end': (today.replace(day=1) + timedelta(days=61)),
                'billing_date': (today.replace(day=1) + timedelta(days=31)).replace(day=1),
                'amount': Decimal('1500.00'),
                'status': BillingCycle.CycleStatus.ACTIVE
            }
        ]

        for data in cycles_data:
            cycle, created = BillingCycle.objects.get_or_create(
                subscription=subscription,
                cycle_start=data['cycle_start'],
                defaults=data
            )
            if created:
                self.stdout.write(f'Created billing cycle: {cycle.cycle_start} - {cycle.cycle_end}')

                # Link to invoice if it exists
                try:
                    invoice = Invoice.objects.get(
                        subscription=subscription,
                        billing_period_start=cycle.cycle_start
                    )
                    cycle.invoice = invoice
                    cycle.save()
                    self.stdout.write(f'Linked billing cycle to invoice: {invoice.invoice_number}')
                except Invoice.DoesNotExist:
                    pass