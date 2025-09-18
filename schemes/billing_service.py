"""
Billing service for payment processing, invoice generation, and billing cycle management.
"""

from decimal import Decimal
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError

from .models import (
    MemberSubscription, Invoice, Payment, PaymentMethod,
    BillingHistory, SubscriptionTier
)


class BillingService:
    """Service for handling billing operations"""

    @staticmethod
    def generate_invoice(
        subscription: MemberSubscription,
        billing_start_date: date,
        billing_end_date: date,
        notes: str = ""
    ) -> Invoice:
        """Generate an invoice for a subscription billing period"""

        # Calculate amounts
        if subscription.subscription_type == SubscriptionTier.BillingCycle.YEARLY:
            subtotal = subscription.tier.yearly_price
        else:
            subtotal = subscription.tier.monthly_price

        # Apply any discounts or adjustments
        discount_amount = Decimal('0.00')
        tax_amount = Decimal('0.00')  # Could be calculated based on region

        total_amount = subtotal - discount_amount + tax_amount

        # Set due date (30 days from now)
        due_date = timezone.now().date() + timedelta(days=30)

        # Create invoice
        invoice = Invoice.objects.create(
            subscription=subscription,
            billing_start_date=billing_start_date,
            billing_end_date=billing_end_date,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            due_date=due_date,
            notes=notes,
            status='DRAFT'
        )

        # Log billing history
        BillingHistory.objects.create(
            subscription=subscription,
            action='INVOICE_CREATED',
            invoice=invoice,
            amount=total_amount,
            description=f"Invoice generated for billing period {billing_start_date} to {billing_end_date}"
        )

        return invoice

    @staticmethod
    def process_payment(
        invoice: Invoice,
        payment_method: PaymentMethod,
        payment_data: Dict
    ) -> Tuple[bool, str, Optional[Payment]]:
        """Process a payment for an invoice"""

        try:
            with transaction.atomic():
                # Create payment record
                payment = Payment.objects.create(
                    payment_id=payment_data.get('payment_id', f'PAY-{invoice.invoice_number}'),
                    invoice=invoice,
                    amount=invoice.total_amount,
                    payment_method=payment_method.payment_type,
                    status='PENDING',
                    transaction_id=payment_data.get('transaction_id', ''),
                    gateway_response=payment_data
                )

                # Log payment attempt
                BillingHistory.objects.create(
                    subscription=invoice.subscription,
                    action='PAYMENT_ATTEMPTED',
                    invoice=invoice,
                    payment=payment,
                    amount=invoice.total_amount,
                    description=f"Payment attempt for invoice {invoice.invoice_number}"
                )

                # Simulate payment processing (in real implementation, integrate with payment gateway)
                success = BillingService._simulate_payment_processing(payment_data)

                if success:
                    # Update payment status
                    payment.status = 'COMPLETED'
                    payment.payment_date = timezone.now()
                    payment.processed_date = timezone.now()
                    payment.save()

                    # Update invoice status
                    invoice.status = 'PAID'
                    invoice.paid_date = timezone.now().date()
                    invoice.payment_method = payment_method
                    invoice.save()

                    # Update subscription
                    subscription = invoice.subscription
                    subscription.last_payment_date = timezone.now().date()
                    subscription.total_paid += invoice.total_amount
                    subscription.outstanding_balance = max(
                        Decimal('0.00'),
                        subscription.outstanding_balance - invoice.total_amount
                    )
                    subscription.save()

                    # Log successful payment
                    BillingHistory.objects.create(
                        subscription=invoice.subscription,
                        action='PAYMENT_COMPLETED',
                        invoice=invoice,
                        payment=payment,
                        amount=invoice.total_amount,
                        description=f"Payment completed for invoice {invoice.invoice_number}"
                    )

                    return True, "Payment processed successfully", payment
                else:
                    # Update payment status to failed
                    payment.status = 'FAILED'
                    payment.save()

                    # Log failed payment
                    BillingHistory.objects.create(
                        subscription=invoice.subscription,
                        action='PAYMENT_FAILED',
                        invoice=invoice,
                        payment=payment,
                        amount=invoice.total_amount,
                        description=f"Payment failed for invoice {invoice.invoice_number}"
                    )

                    return False, "Payment processing failed", payment

        except Exception as e:
            return False, f"Payment processing error: {str(e)}", None

    @staticmethod
    def _simulate_payment_processing(payment_data: Dict) -> bool:
        """Simulate payment gateway processing"""
        # In a real implementation, this would integrate with Stripe, PayPal, etc.
        # For now, simulate success/failure based on test data
        return payment_data.get('simulate_success', True)

    @staticmethod
    def process_subscription_renewal(subscription: MemberSubscription) -> Tuple[bool, str]:
        """Process automatic subscription renewal"""

        try:
            with transaction.atomic():
                # Check if subscription should auto-renew
                if not subscription.auto_renew:
                    return False, "Auto-renewal is disabled"

                # Check payment method
                payment_method = PaymentMethod.objects.filter(
                    member=subscription.member,
                    is_default=True,
                    is_active=True
                ).first()

                if not payment_method:
                    return False, "No active payment method found"

                # Calculate next billing period
                if subscription.subscription_type == SubscriptionTier.BillingCycle.YEARLY:
                    next_start = subscription.end_date
                    next_end = next_start + timedelta(days=365)
                else:
                    next_start = subscription.end_date
                    next_end = next_start + timedelta(days=30)

                # Generate invoice
                invoice = BillingService.generate_invoice(
                    subscription,
                    next_start,
                    next_end,
                    "Automatic renewal"
                )

                # Process payment
                payment_data = {
                    'payment_id': f'AUTO-{subscription.id}-{timezone.now().strftime("%Y%m%d%H%M%S")}',
                    'simulate_success': True  # In production, this would be False
                }

                success, message, payment = BillingService.process_payment(
                    invoice, payment_method, payment_data
                )

                if success:
                    # Update subscription dates
                    subscription.start_date = next_start
                    subscription.end_date = next_end
                    subscription.next_billing_date = next_end
                    subscription.save()

                    # Log renewal
                    BillingHistory.objects.create(
                        subscription=subscription,
                        action='SUBSCRIPTION_RENEWED',
                        invoice=invoice,
                        amount=invoice.total_amount,
                        description=f"Subscription automatically renewed for period {next_start} to {next_end}"
                    )

                    return True, "Subscription renewed successfully"
                else:
                    return False, f"Renewal payment failed: {message}"

        except Exception as e:
            return False, f"Renewal processing error: {str(e)}"

    @staticmethod
    def cancel_subscription(
        subscription: MemberSubscription,
        cancel_date: Optional[date] = None,
        refund_prorated: bool = True
    ) -> Tuple[bool, str]:
        """Cancel a subscription with optional prorated refund"""

        try:
            with transaction.atomic():
                if cancel_date is None:
                    cancel_date = timezone.now().date()

                # Calculate prorated refund if requested
                refund_amount = Decimal('0.00')
                if refund_prorated and subscription.end_date > cancel_date:
                    remaining_days = (subscription.end_date - cancel_date).days
                    total_days = (subscription.end_date - subscription.start_date).days

                    if subscription.subscription_type == SubscriptionTier.BillingCycle.YEARLY:
                        daily_rate = subscription.tier.yearly_price / 365
                    else:
                        daily_rate = subscription.tier.monthly_price / 30

                    refund_amount = daily_rate * remaining_days

                # Update subscription
                subscription.status = 'CANCELLED'
                subscription.cancelled_at = timezone.now()
                subscription.end_date = cancel_date
                subscription.auto_renew = False
                subscription.save()

                # Process refund if applicable
                if refund_amount > 0:
                    # Find last payment for this subscription
                    last_payment = Payment.objects.filter(
                        invoice__subscription=subscription,
                        status='COMPLETED'
                    ).order_by('-payment_date').first()

                    if last_payment and last_payment.can_refund:
                        last_payment.refund_amount = min(refund_amount, last_payment.amount)
                        last_payment.refund_date = timezone.now()
                        last_payment.save()

                        # Log refund
                        BillingHistory.objects.create(
                            subscription=subscription,
                            action='PAYMENT_REFUNDED',
                            payment=last_payment,
                            amount=last_payment.refund_amount,
                            description=f"Prorated refund for cancelled subscription"
                        )

                # Log cancellation
                BillingHistory.objects.create(
                    subscription=subscription,
                    action='SUBSCRIPTION_CANCELLED',
                    amount=refund_amount,
                    description=f"Subscription cancelled on {cancel_date} with refund of {refund_amount}"
                )

                return True, f"Subscription cancelled successfully. Refund: {refund_amount}"

        except Exception as e:
            return False, f"Cancellation error: {str(e)}"

    @staticmethod
    def get_subscription_billing_summary(subscription: MemberSubscription) -> Dict:
        """Get comprehensive billing summary for a subscription"""

        # Get invoices
        invoices = Invoice.objects.filter(subscription=subscription).order_by('-issued_date')

        # Get payments
        payments = Payment.objects.filter(
            invoice__subscription=subscription
        ).order_by('-payment_date')

        # Calculate totals
        total_invoiced = invoices.aggregate(
            total=models.Sum('total_amount')
        )['total'] or Decimal('0.00')

        total_paid = payments.filter(status='COMPLETED').aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')

        total_refunded = payments.filter(status='REFUNDED').aggregate(
            total=models.Sum('refund_amount')
        )['total'] or Decimal('0.00')

        # Get billing history
        history = BillingHistory.objects.filter(
            subscription=subscription
        ).order_by('-timestamp')[:10]  # Last 10 actions

        return {
            'subscription': subscription,
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'total_refunded': total_refunded,
            'outstanding_balance': total_invoiced - total_paid + total_refunded,
            'invoices': invoices,
            'payments': payments,
            'recent_history': history,
            'next_billing_date': subscription.next_billing_date,
            'auto_renew': subscription.auto_renew
        }

    @staticmethod
    def check_overdue_invoices() -> List[Invoice]:
        """Get all overdue invoices that need attention"""

        overdue_invoices = Invoice.objects.filter(
            status__in=['SENT', 'OVERDUE'],
            due_date__lt=timezone.now().date()
        ).select_related('subscription', 'subscription__member')

        # Update status to OVERDUE if not already
        overdue_invoices.filter(status='SENT').update(status='OVERDUE')

        return list(overdue_invoices)

    @staticmethod
    def process_bulk_renewals() -> Dict[str, int]:
        """Process renewals for all subscriptions due today"""

        today = timezone.now().date()

        # Find subscriptions due for renewal
        due_subscriptions = MemberSubscription.objects.filter(
            next_billing_date=today,
            status='ACTIVE',
            auto_renew=True
        )

        results = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'errors': []
        }

        for subscription in due_subscriptions:
            results['processed'] += 1
            success, message = BillingService.process_subscription_renewal(subscription)

            if success:
                results['successful'] += 1
            else:
                results['failed'] += 1
                results['errors'].append({
                    'subscription_id': subscription.id,
                    'member': str(subscription.member),
                    'error': message
                })

        return results