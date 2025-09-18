"""
Billing service for handling payments, invoices, and billing cycles
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Tuple, Dict, Any
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from .models import PaymentMethod, Invoice, Payment, BillingCycle, BillingSettings
from schemes.models import MemberSubscription


class BillingService:
    """Service class for managing billing operations"""

    @staticmethod
    def create_invoice(
        subscription: MemberSubscription,
        billing_period_start: date,
        billing_period_end: date,
        amount: Decimal,
        due_date: Optional[date] = None
    ) -> Invoice:
        """
        Create an invoice for a subscription billing period

        Args:
            subscription: The subscription to bill
            billing_period_start: Start of billing period
            billing_period_end: End of billing period
            amount: Base amount to bill
            due_date: Due date for payment (defaults to 30 days from now)

        Returns:
            Created Invoice instance
        """
        if due_date is None:
            due_date = timezone.now().date() + timedelta(days=30)

        # Get billing settings for tax calculation
        billing_settings = BillingSettings.objects.first()
        if billing_settings:
            tax_amount = amount * (billing_settings.tax_rate / 100)
            if billing_settings.tax_inclusive:
                total_amount = amount
                amount = amount / (1 + billing_settings.tax_rate / 100)
            else:
                total_amount = amount + tax_amount
        else:
            tax_amount = Decimal('0.00')
            total_amount = amount

        with transaction.atomic():
            invoice = Invoice.objects.create(
                subscription=subscription,
                billing_period_start=billing_period_start,
                billing_period_end=billing_period_end,
                due_date=due_date,
                amount=amount,
                tax_amount=tax_amount,
                total_amount=total_amount,
                status=Invoice.InvoiceStatus.DRAFT,
                description=f"Subscription billing for {billing_period_start} - {billing_period_end}"
            )

        return invoice

    @staticmethod
    def process_payment(
        invoice: Invoice,
        payment_method: PaymentMethod,
        amount: Optional[Decimal] = None
    ) -> Tuple[bool, str, Optional[Payment]]:
        """
        Process a payment for an invoice

        Args:
            invoice: Invoice to pay
            payment_method: Payment method to use
            amount: Amount to pay (defaults to invoice total)

        Returns:
            Tuple of (success, message, payment_instance)
        """
        if amount is None:
            amount = invoice.total_amount

        # Here you would integrate with actual payment processor (Stripe, PayPal, etc.)
        # For now, we'll simulate a successful payment

        payment_id = f"pay_{timezone.now().strftime('%Y%m%d_%H%M%S')}_{invoice.id}"

        with transaction.atomic():
            payment = Payment.objects.create(
                payment_id=payment_id,
                invoice=invoice,
                amount=amount,
                payment_type=Payment.PaymentType.SUBSCRIPTION,
                payment_method=payment_method,
                status=Payment.PaymentStatus.COMPLETED,
                processor='stripe',  # Default processor
                processor_transaction_id=f"txn_{payment_id}",
                processed_at=timezone.now()
            )

            # Mark invoice as paid
            invoice.status = Invoice.InvoiceStatus.PAID
            invoice.payment_date = timezone.now()
            invoice.payment_method = payment_method
            invoice.transaction_id = payment.processor_transaction_id
            invoice.save()

        return True, "Payment processed successfully", payment

    @staticmethod
    def create_billing_cycle(
        subscription: MemberSubscription,
        billing_date: date,
        amount: Decimal
    ) -> BillingCycle:
        """
        Create a billing cycle for a subscription

        Args:
            subscription: The subscription
            billing_date: Date when billing should occur
            amount: Amount to bill

        Returns:
            Created BillingCycle instance
        """
        # Calculate cycle dates based on subscription type
        if subscription.subscription_type == 'YEARLY':
            cycle_start = billing_date - timedelta(days=365)
            cycle_end = billing_date
        else:  # MONTHLY
            cycle_start = billing_date - timedelta(days=30)
            cycle_end = billing_date

        with transaction.atomic():
            billing_cycle = BillingCycle.objects.create(
                subscription=subscription,
                cycle_start=cycle_start,
                cycle_end=cycle_end,
                billing_date=billing_date,
                amount=amount
            )

        return billing_cycle

    @staticmethod
    def generate_monthly_invoices():
        """
        Generate invoices for all active subscriptions that are due for billing
        This should be run as a scheduled task (e.g., daily)
        """
        today = timezone.now().date()

        # Get billing settings
        billing_settings = BillingSettings.objects.first()
        if not billing_settings:
            billing_settings = BillingSettings.objects.create()

        # Find subscriptions that need billing
        subscriptions_to_bill = MemberSubscription.objects.filter(
            status=MemberSubscription.SubscriptionStatus.ACTIVE,
            next_payment_date__lte=today
        )

        invoices_created = 0

        for subscription in subscriptions_to_bill:
            try:
                with transaction.atomic():
                    # Calculate billing period
                    if subscription.subscription_type == 'YEARLY':
                        period_start = subscription.next_payment_date - timedelta(days=365)
                        period_end = subscription.next_payment_date
                        amount = subscription.tier.yearly_price
                    else:  # MONTHLY
                        period_start = subscription.next_payment_date - timedelta(days=30)
                        period_end = subscription.next_payment_date
                        amount = subscription.tier.monthly_price

                    # Create invoice
                    invoice = BillingService.create_invoice(
                        subscription=subscription,
                        billing_period_start=period_start,
                        billing_period_end=period_end,
                        amount=amount,
                        due_date=subscription.next_payment_date + timedelta(days=billing_settings.grace_period_days)
                    )

                    # Create billing cycle
                    billing_cycle = BillingService.create_billing_cycle(
                        subscription=subscription,
                        billing_date=subscription.next_payment_date,
                        amount=invoice.total_amount
                    )

                    # Link invoice to billing cycle
                    billing_cycle.invoice = invoice
                    billing_cycle.save()

                    # Update subscription next payment date
                    if subscription.subscription_type == 'YEARLY':
                        subscription.next_payment_date += timedelta(days=365)
                    else:
                        subscription.next_payment_date += timedelta(days=30)

                    subscription.save()
                    invoices_created += 1

            except Exception as e:
                # Log error but continue with other subscriptions
                print(f"Error billing subscription {subscription.id}: {str(e)}")
                continue

        return invoices_created

    @staticmethod
    def process_overdue_invoices():
        """
        Process overdue invoices and suspend subscriptions if necessary
        This should be run as a scheduled task
        """
        today = timezone.now().date()

        # Get billing settings
        billing_settings = BillingSettings.objects.first()
        if not billing_settings:
            return

        grace_period = timedelta(days=billing_settings.grace_period_days)

        # Find overdue invoices
        overdue_invoices = Invoice.objects.filter(
            status__in=[Invoice.InvoiceStatus.SENT, Invoice.InvoiceStatus.OVERDUE],
            due_date__lt=today - grace_period
        )

        suspended_count = 0

        for invoice in overdue_invoices:
            try:
                with transaction.atomic():
                    # Mark invoice as overdue
                    invoice.status = Invoice.InvoiceStatus.OVERDUE
                    invoice.save()

                    # Suspend subscription
                    subscription = invoice.subscription
                    subscription.status = MemberSubscription.SubscriptionStatus.SUSPENDED
                    subscription.save()

                    suspended_count += 1

            except Exception as e:
                print(f"Error processing overdue invoice {invoice.id}: {str(e)}")
                continue

        return suspended_count

    @staticmethod
    def retry_failed_payments():
        """
        Retry failed payments for billing cycles
        This should be run as a scheduled task
        """
        today = timezone.now().date()

        # Find billing cycles that need retry
        cycles_to_retry = BillingCycle.objects.filter(
            status=BillingCycle.CycleStatus.FAILED,
            next_retry_date__lte=today,
            retry_count__lt=3  # Max retries from model
        )

        retried_count = 0

        for cycle in cycles_to_retry:
            try:
                # Attempt to process payment again
                invoice = cycle.invoice
                if not invoice:
                    continue

                # Get default payment method
                payment_method = PaymentMethod.objects.filter(
                    subscription=invoice.subscription,
                    is_default=True,
                    is_active=True
                ).first()

                if not payment_method:
                    continue

                success, message, payment = BillingService.process_payment(
                    invoice=invoice,
                    payment_method=payment_method
                )

                if success:
                    cycle.status = BillingCycle.CycleStatus.COMPLETED
                    cycle.save()
                else:
                    cycle.retry_count += 1
                    cycle.next_retry_date = today + timedelta(days=3)
                    cycle.save()

                retried_count += 1

            except Exception as e:
                print(f"Error retrying payment for cycle {cycle.id}: {str(e)}")
                continue

        return retried_count

    @staticmethod
    def get_billing_summary() -> Dict[str, Any]:
        """
        Get a summary of billing statistics

        Returns:
            Dictionary with billing summary data
        """
        today = timezone.now().date()

        # Invoice statistics
        total_invoices = Invoice.objects.count()
        paid_invoices = Invoice.objects.filter(status=Invoice.InvoiceStatus.PAID).count()
        overdue_invoices = Invoice.objects.filter(
            status=Invoice.InvoiceStatus.OVERDUE
        ).count()

        # Payment statistics
        total_payments = Payment.objects.filter(
            status=Payment.PaymentStatus.COMPLETED
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

        # Monthly revenue (current month)
        month_start = today.replace(day=1)
        monthly_revenue = Payment.objects.filter(
            status=Payment.PaymentStatus.COMPLETED,
            processed_at__date__gte=month_start
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

        return {
            'total_invoices': total_invoices,
            'paid_invoices': paid_invoices,
            'overdue_invoices': overdue_invoices,
            'payment_success_rate': (paid_invoices / total_invoices * 100) if total_invoices > 0 else 0,
            'total_revenue': float(total_payments),
            'monthly_revenue': float(monthly_revenue)
        }


# Import here to avoid circular imports
from django.db import models