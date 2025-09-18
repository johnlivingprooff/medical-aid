"""
Billing models for subscription payments and invoicing.
"""

from django.db import models
from django.conf import settings
from decimal import Decimal
from django.utils import timezone
from schemes.models import MemberSubscription


class PaymentMethod(models.Model):
    """Payment method for subscriptions"""

    class PaymentType(models.TextChoices):
        CREDIT_CARD = 'CREDIT_CARD', 'Credit Card'
        DEBIT_CARD = 'DEBIT_CARD', 'Debit Card'
        BANK_ACCOUNT = 'BANK_ACCOUNT', 'Bank Account'
        DIGITAL_WALLET = 'DIGITAL_WALLET', 'Digital Wallet'

    subscription = models.ForeignKey(
        MemberSubscription,
        on_delete=models.CASCADE,
        related_name='billing_payment_methods'
    )
    payment_type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        default=PaymentType.CREDIT_CARD
    )
    is_default = models.BooleanField(default=False)

    # Card/Bank details (would be encrypted in production)
    card_number_masked = models.CharField(max_length=20, blank=True)  # Last 4 digits
    card_holder_name = models.CharField(max_length=100, blank=True)
    expiry_month = models.IntegerField(null=True, blank=True)
    expiry_year = models.IntegerField(null=True, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    account_number_masked = models.CharField(max_length=20, blank=True)  # Last 4 digits

    # Digital wallet
    wallet_provider = models.CharField(max_length=50, blank=True)  # PayPal, Apple Pay, etc.
    wallet_email = models.EmailField(blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Billing Payment Method'
        verbose_name_plural = 'Billing Payment Methods'
        app_label = 'billing'
        unique_together = ['subscription', 'is_default']  # Only one default per subscription

    def __str__(self):
        return f"{self.payment_type} - {self.subscription.patient.user.get_full_name()}"


class Invoice(models.Model):
    """Invoice for subscription payments"""

    class InvoiceStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SENT = 'SENT', 'Sent'
        PAID = 'PAID', 'Paid'
        OVERDUE = 'OVERDUE', 'Overdue'
        CANCELLED = 'CANCELLED', 'Cancelled'
        REFUNDED = 'REFUNDED', 'Refunded'

    invoice_number = models.CharField(max_length=50, unique=True)
    subscription = models.ForeignKey(
        MemberSubscription,
        on_delete=models.CASCADE,
        related_name='billing_invoices'
    )
    billing_period_start = models.DateField()
    billing_period_end = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT
    )

    # Invoice details
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    # Payment tracking
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices'
    )
    payment_date = models.DateTimeField(null=True, blank=True)
    transaction_id = models.CharField(max_length=100, blank=True)

    # Audit fields
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_invoices'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Billing Invoice'
        verbose_name_plural = 'Billing Invoices'
        ordering = ['-created_at']
        app_label = 'billing'

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.subscription.patient.user.get_full_name()}"

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            # Generate invoice number
            self.invoice_number = f"INV-{timezone.now().strftime('%Y%m%d')}-{self.subscription.id:04d}"
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        return (
            self.status in [self.InvoiceStatus.SENT, self.InvoiceStatus.OVERDUE] and
            timezone.now().date() > self.due_date
        )

    @property
    def days_overdue(self):
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days


class Payment(models.Model):
    """Payment transaction record"""

    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        REFUNDED = 'REFUNDED', 'Refunded'

    class PaymentType(models.TextChoices):
        SUBSCRIPTION = 'SUBSCRIPTION', 'Subscription Payment'
        UPGRADE = 'UPGRADE', 'Plan Upgrade'
        ONE_TIME = 'ONE_TIME', 'One-time Payment'
        REFUND = 'REFUND', 'Refund'

    payment_id = models.CharField(max_length=100, unique=True)
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        default=PaymentType.SUBSCRIPTION
    )
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments'
    )

    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING
    )

    # Payment processor details
    processor = models.CharField(max_length=50, default='stripe')  # stripe, paypal, etc.
    processor_transaction_id = models.CharField(max_length=100, blank=True)
    processor_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Error handling
    error_message = models.TextField(blank=True)
    error_code = models.CharField(max_length=50, blank=True)

    # Audit fields
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Billing Payment'
        verbose_name_plural = 'Billing Payments'
        ordering = ['-created_at']
        app_label = 'billing'

    def __str__(self):
        return f"Payment {self.payment_id} - {self.amount}"


class BillingCycle(models.Model):
    """Tracks billing cycles for subscriptions"""

    class CycleStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    subscription = models.ForeignKey(
        MemberSubscription,
        on_delete=models.CASCADE,
        related_name='billing_cycles'
    )
    cycle_start = models.DateField()
    cycle_end = models.DateField()
    billing_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=20,
        choices=CycleStatus.choices,
        default=CycleStatus.ACTIVE
    )

    invoice = models.OneToOneField(
        Invoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_cycle'
    )

    # Retry logic
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    next_retry_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Billing Cycle'
        verbose_name_plural = 'Billing Cycles'
        ordering = ['-billing_date']
        app_label = 'billing'

    def __str__(self):
        return f"Billing Cycle {self.cycle_start} - {self.cycle_end}"


class BillingSettings(models.Model):
    """Global billing settings"""

    # Tax settings
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Tax rate as percentage (e.g., 15.00 for 15%)"
    )
    tax_inclusive = models.BooleanField(
        default=False,
        help_text="Whether tax is included in the displayed price"
    )

    # Payment settings
    currency = models.CharField(max_length=3, default='ZAR')
    payment_processor = models.CharField(max_length=50, default='stripe')

    # Billing cycle settings
    billing_day_of_month = models.IntegerField(
        default=1,
        help_text="Day of month when subscriptions are billed"
    )
    grace_period_days = models.IntegerField(
        default=7,
        help_text="Days after due date before subscription is suspended"
    )

    # Retry settings
    max_payment_retries = models.IntegerField(default=3)
    retry_interval_days = models.IntegerField(default=3)

    # Late payment settings
    late_fee_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Late fee as percentage of invoice amount"
    )
    late_fee_fixed = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Fixed late fee amount"
    )

    class Meta:
        verbose_name = 'Billing Setting'
        verbose_name_plural = 'Billing Settings'
        app_label = 'billing'

    def __str__(self):
        return f"Billing Settings ({self.currency})"