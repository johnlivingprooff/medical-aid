from django.db import models
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta


class SchemeCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self) -> str:
        return self.name


class BenefitCategory(models.Model):
    """Categories of benefits that can be included in subscription tiers"""

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Name of the benefit category"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of what this category includes"
    )
    subscription_required = models.BooleanField(
        default=True,
        help_text="Whether this benefit requires an active subscription"
    )
    access_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Rules for accessing benefits in this category"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this category is active"
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Display order"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Benefit Category"
        verbose_name_plural = "Benefit Categories"
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class BenefitType(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:
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
    coverage_limit_count = models.PositiveIntegerField(default=1, null=True, blank=True, help_text='Max number of uses in period')
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
    effective_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('scheme', 'benefit_type')
        indexes = [
            models.Index(fields=['scheme']),
            models.Index(fields=['benefit_type']),
            models.Index(fields=['is_active']),
            models.Index(fields=['effective_date']),
            models.Index(fields=['expiry_date']),
            models.Index(fields=['requires_preauth']),
            models.Index(fields=['network_only']),
            models.Index(fields=['coverage_period']),
            models.Index(fields=['scheme', 'is_active']),
            models.Index(fields=['benefit_type', 'is_active']),
            models.Index(fields=['scheme', 'benefit_type', 'is_active']),
        ]

    def save(self, *args, **kwargs):
        if self.coverage_limit_count is None:
            self.coverage_limit_count = 1
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.scheme} - {self.benefit_type}"

    @property
    def is_currently_active(self):
        """Check if benefit is currently active based on dates"""
        from django.utils import timezone
        today = timezone.now().date()

        if not self.is_active:
            return False

        if self.effective_date and today < self.effective_date:
            return False

        if self.expiry_date and today > self.expiry_date:
            return False

        return True


class SubscriptionTier(models.Model):
    """Defines subscription tiers for schemes (Basic, Standard, Premium)"""
    class TierType(models.TextChoices):
        BASIC = 'BASIC', 'Basic'
        STANDARD = 'STANDARD', 'Standard'
        PREMIUM = 'PREMIUM', 'Premium'
        ENTERPRISE = 'ENTERPRISE', 'Enterprise'

    class BillingCycle(models.TextChoices):
        MONTHLY = 'MONTHLY', 'Monthly'
        YEARLY = 'YEARLY', 'Yearly'

    name = models.CharField(max_length=50, help_text="Tier name (e.g., Basic, Standard, Premium)")
    scheme = models.ForeignKey(SchemeCategory, on_delete=models.CASCADE, related_name='subscription_tiers')
    tier_type = models.CharField(max_length=20, choices=TierType.choices, default=TierType.STANDARD)
    description = models.TextField(blank=True, help_text="Description of what this tier includes")

    # Pricing
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Monthly subscription price")
    yearly_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Yearly subscription price")

    # Limits and features
    max_dependents = models.PositiveIntegerField(default=0, help_text="Maximum number of dependents allowed")
    max_claims_per_month = models.PositiveIntegerField(null=True, blank=True, help_text="Maximum claims per month")
    max_coverage_per_year = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Maximum coverage per year")

    # Benefit access
    benefit_categories = models.ManyToManyField(BenefitCategory, related_name='subscription_tiers', help_text="Benefit categories included in this tier")

    # Status
    is_active = models.BooleanField(default=True, help_text="Whether this tier is currently available")
    sort_order = models.PositiveIntegerField(default=0, help_text="Display order for tiers")

    class Meta:
        unique_together = ['scheme', 'tier_type']
        ordering = ['sort_order', 'monthly_price']

    def __str__(self) -> str:
        return f"{self.scheme.name} - {self.name}"

    def clean(self):
        """Validate subscription tier data"""
        from django.core.exceptions import ValidationError
        
        # Validate price consistency - yearly should be at least 10x monthly (allowing for discounts)
        if self.yearly_price < (self.monthly_price * 10):
            raise ValidationError({
                'yearly_price': 'Yearly price should be at least 10 times the monthly price (allowing for annual discounts).'
            })
        
        # Validate that yearly price is not less than monthly price
        if self.yearly_price < self.monthly_price:
            raise ValidationError({
                'yearly_price': 'Yearly price cannot be less than monthly price.'
            })
        
        # Validate max_coverage_per_year is reasonable
        if self.max_coverage_per_year and self.max_coverage_per_year < self.monthly_price:
            raise ValidationError({
                'max_coverage_per_year': 'Maximum annual coverage should be higher than monthly subscription cost.'
            })

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class MemberSubscription(models.Model):
    """Tracks individual member subscriptions"""
    class BillingPeriod(models.TextChoices):
        MONTHLY = 'MONTHLY', 'Monthly'
        YEARLY = 'YEARLY', 'Yearly'

    class SubscriptionStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'
        CANCELLED = 'CANCELLED', 'Cancelled'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        EXPIRED = 'EXPIRED', 'Expired'

    # Relationships
    patient = models.OneToOneField('claims.Patient', on_delete=models.CASCADE, related_name='member_subscription')
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT, related_name='subscriptions')

    # Subscription details
    subscription_type = models.CharField(max_length=20, choices=BillingPeriod.choices, default=BillingPeriod.MONTHLY)
    status = models.CharField(max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE)

    # Dates
    start_date = models.DateField(help_text="Subscription start date")
    end_date = models.DateField(help_text="Subscription end date")
    auto_renew = models.BooleanField(default=True, help_text="Whether subscription should auto-renew")

    # Payment tracking
    last_payment_date = models.DateField(null=True, blank=True, help_text="Date of last successful payment")
    next_payment_date = models.DateField(null=True, blank=True, help_text="Date of next payment due")

    # Usage tracking
    claims_this_month = models.PositiveIntegerField(default=0, help_text="Number of claims this month")
    coverage_used_this_year = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Coverage amount used this year")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.patient.member_id} - {self.tier.name}"

    def is_active(self):
        """Check if subscription is currently active"""
        return (
            self.status == self.SubscriptionStatus.ACTIVE
            and self.start_date <= timezone.now().date() <= self.end_date
        )

    def can_make_claim(self, claim_amount=None):
        """Check if member can make a claim based on subscription limits"""
        if not self.is_active():
            return False, "Subscription is not active"

        # Check monthly claim limit
        if self.tier.max_claims_per_month and self.claims_this_month >= self.tier.max_claims_per_month:
            return False, f"Monthly claim limit ({self.tier.max_claims_per_month}) exceeded"

        # Check yearly coverage limit
        if self.tier.max_coverage_per_year and claim_amount:
            remaining_coverage = self.tier.max_coverage_per_year - self.coverage_used_this_year
            if remaining_coverage < claim_amount:
                return False, f"Insufficient yearly coverage remaining (${remaining_coverage:.2f})"

        return True, "Claim allowed"

    def get_remaining_coverage(self):
        """Get remaining coverage for this year"""
        if not self.tier.max_coverage_per_year:
            return None
        return max(0, self.tier.max_coverage_per_year - self.coverage_used_this_year)

    def can_access_benefit(self, benefit_type):
        """Check if member can access a specific benefit type"""
        if not self.is_active():
            return False

        # Check if the benefit type is covered by the subscription's scheme
        return SchemeBenefit.objects.filter(
            scheme=self.tier.scheme,
            benefit_type=benefit_type,
            is_active=True
        ).exists()


class PaymentMethod(models.Model):
    """Payment method for subscriptions"""

    PAYMENT_TYPE_CHOICES = [
        ('CREDIT_CARD', 'Credit Card'),
        ('DEBIT_CARD', 'Debit Card'),
        ('BANK_ACCOUNT', 'Bank Account'),
        ('PAYPAL', 'PayPal'),
        ('APPLE_PAY', 'Apple Pay'),
        ('GOOGLE_PAY', 'Google Pay'),
    ]

    member = models.ForeignKey(
        'claims.Patient',
        on_delete=models.CASCADE,
        related_name='payment_methods'
    )

    payment_type = models.CharField(
        max_length=20,
        choices=PAYMENT_TYPE_CHOICES,
        default='CREDIT_CARD'
    )

    # Card/Account details (encrypted in production)
    card_number_masked = models.CharField(
        max_length=20,
        blank=True,
        help_text="Last 4 digits of card number"
    )
    card_holder_name = models.CharField(max_length=100, blank=True)
    expiry_month = models.IntegerField(null=True, blank=True)
    expiry_year = models.IntegerField(null=True, blank=True)

    # Bank account details
    account_number_masked = models.CharField(
        max_length=20,
        blank=True,
        help_text="Last 4 digits of account number"
    )
    routing_number = models.CharField(max_length=20, blank=True)

    # Third-party payment
    paypal_email = models.EmailField(blank=True)

    # Settings
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payment Method"
        verbose_name_plural = "Payment Methods"
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.member} - {self.get_payment_type_display()}"

    def save(self, *args, **kwargs):
        """Ensure only one default payment method per member"""
        if self.is_default:
            PaymentMethod.objects.filter(
                member=self.member,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class Invoice(models.Model):
    """Invoice for subscription payments"""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SENT', 'Sent'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('CANCELLED', 'Cancelled'),
    ]

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique invoice identifier"
    )

    subscription = models.ForeignKey(
        MemberSubscription,
        on_delete=models.CASCADE,
        related_name='invoices'
    )

    # Billing period
    billing_start_date = models.DateField()
    billing_end_date = models.DateField()

    # Amounts
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Amount before tax/discounts"
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Tax amount"
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Discount amount"
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Final amount due"
    )

    # Status and dates
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT'
    )
    issued_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)

    # Payment method used
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices'
    )

    # Notes
    notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Invoice"
        verbose_name_plural = "Invoices"
        ordering = ['-issued_date']

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.subscription.patient}"

    def save(self, *args, **kwargs):
        """Auto-generate invoice number if not provided"""
        if not self.invoice_number:
            # Generate invoice number: INV-YYYY-NNNN
            year = timezone.now().year
            last_invoice = Invoice.objects.filter(
                invoice_number__startswith=f'INV-{year}-'
            ).order_by('-invoice_number').first()

            if last_invoice:
                last_number = int(last_invoice.invoice_number.split('-')[-1])
                new_number = last_number + 1
            else:
                new_number = 1

            self.invoice_number = f'INV-{year}-{new_number:04d}'

        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        """Check if invoice is overdue"""
        return (
            self.status in ['SENT', 'OVERDUE'] and
            timezone.now().date() > self.due_date
        )

    @property
    def days_overdue(self):
        """Calculate days overdue"""
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days


class Payment(models.Model):
    """Payment transactions"""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
        ('CANCELLED', 'Cancelled'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('CREDIT_CARD', 'Credit Card'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('PAYPAL', 'PayPal'),
        ('CASH', 'Cash'),
        ('OTHER', 'Other'),
    ]

    payment_id = models.CharField(
        max_length=100,
        unique=True,
        help_text="External payment processor ID"
    )

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payments'
    )

    # Payment details
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Payment amount"
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default='CREDIT_CARD'
    )

    # Status and dates
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    payment_date = models.DateTimeField(null=True, blank=True)
    processed_date = models.DateTimeField(null=True, blank=True)

    # External payment details
    transaction_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="External transaction reference"
    )
    gateway_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw response from payment gateway"
    )

    # Refund information
    refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Amount refunded"
    )
    refund_date = models.DateTimeField(null=True, blank=True)
    refund_reason = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"Payment {self.payment_id} - {self.amount}"

    @property
    def is_successful(self):
        """Check if payment was successful"""
        return self.status == 'COMPLETED'

    @property
    def can_refund(self):
        """Check if payment can be refunded"""
        return (
            self.is_successful and
            self.refund_amount < self.amount and
            (timezone.now() - self.payment_date).days <= 90  # 90-day refund window
        )


class BillingHistory(models.Model):
    """Audit trail for billing operations"""

    ACTION_CHOICES = [
        ('INVOICE_CREATED', 'Invoice Created'),
        ('INVOICE_SENT', 'Invoice Sent'),
        ('PAYMENT_ATTEMPTED', 'Payment Attempted'),
        ('PAYMENT_COMPLETED', 'Payment Completed'),
        ('PAYMENT_FAILED', 'Payment Failed'),
        ('PAYMENT_REFUNDED', 'Payment Refunded'),
        ('SUBSCRIPTION_RENEWED', 'Subscription Renewed'),
        ('SUBSCRIPTION_CANCELLED', 'Subscription Cancelled'),
        ('BILLING_CYCLE_UPDATED', 'Billing Cycle Updated'),
    ]

    subscription = models.ForeignKey(
        MemberSubscription,
        on_delete=models.CASCADE,
        related_name='billing_history'
    )

    action = models.CharField(
        max_length=30,
        choices=ACTION_CHOICES
    )

    # Related objects
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_history'
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_history'
    )

    # Details
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Amount involved in the action"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of the action"
    )
    metadata = models.JSONField(
        null=True,
        blank=True,
        help_text="Additional data related to the action"
    )

    # User who performed the action
    performed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_actions'
    )

    # Timestamp
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Billing History"
        verbose_name_plural = "Billing History"
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.subscription} - {self.get_action_display()} - {self.timestamp.date()}"


    # Import audit logging for scheme operations
    from .models_audit import SchemeAuditLog