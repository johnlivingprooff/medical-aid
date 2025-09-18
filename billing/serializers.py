"""
Serializers for billing models
"""

from rest_framework import serializers
from .models import PaymentMethod, Invoice, Payment, BillingCycle, BillingSettings


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer for payment methods"""

    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'subscription', 'payment_type', 'is_default',
            'card_number_masked', 'card_holder_name', 'expiry_month', 'expiry_year',
            'bank_name', 'account_number_masked',
            'wallet_provider', 'wallet_email',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Ensure only one default payment method per subscription
        if validated_data.get('is_default'):
            PaymentMethod.objects.filter(
                subscription=validated_data['subscription'],
                is_default=True
            ).update(is_default=False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Ensure only one default payment method per subscription
        if validated_data.get('is_default') and not instance.is_default:
            PaymentMethod.objects.filter(
                subscription=instance.subscription,
                is_default=True
            ).update(is_default=False)
        return super().update(instance, validated_data)


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoices"""

    subscription_detail = serializers.SerializerMethodField()
    payment_method_detail = serializers.SerializerMethodField()
    days_overdue = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'subscription', 'subscription_detail',
            'billing_period_start', 'billing_period_end', 'due_date',
            'amount', 'tax_amount', 'discount_amount', 'total_amount',
            'status', 'description', 'notes',
            'payment_method', 'payment_method_detail', 'payment_date', 'transaction_id',
            'days_overdue', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at', 'updated_at', 'days_overdue']

    def get_subscription_detail(self, obj):
        return {
            'id': obj.subscription.id,
            'patient_name': obj.subscription.patient.user.get_full_name(),
            'tier_name': obj.subscription.tier.name,
            'subscription_type': obj.subscription.subscription_type
        }

    def get_payment_method_detail(self, obj):
        if obj.payment_method:
            return {
                'id': obj.payment_method.id,
                'type': obj.payment_method.payment_type,
                'masked_number': obj.payment_method.card_number_masked or obj.payment_method.account_number_masked
            }
        return None


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for payments"""

    invoice_detail = serializers.SerializerMethodField()
    payment_method_detail = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'payment_id', 'invoice', 'invoice_detail', 'amount', 'payment_type',
            'payment_method', 'payment_method_detail', 'status', 'processor',
            'processor_transaction_id', 'processor_fee', 'error_message', 'error_code',
            'processed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'payment_id', 'created_at', 'updated_at']

    def get_invoice_detail(self, obj):
        return {
            'id': obj.invoice.id,
            'invoice_number': obj.invoice.invoice_number,
            'total_amount': obj.invoice.total_amount
        }

    def get_payment_method_detail(self, obj):
        if obj.payment_method:
            return {
                'id': obj.payment_method.id,
                'type': obj.payment_method.payment_type,
                'masked_number': obj.payment_method.card_number_masked or obj.payment_method.account_number_masked
            }
        return None


class BillingCycleSerializer(serializers.ModelSerializer):
    """Serializer for billing cycles"""

    subscription_detail = serializers.SerializerMethodField()
    invoice_detail = serializers.SerializerMethodField()

    class Meta:
        model = BillingCycle
        fields = [
            'id', 'subscription', 'subscription_detail', 'cycle_start', 'cycle_end',
            'billing_date', 'amount', 'status', 'invoice', 'invoice_detail',
            'retry_count', 'max_retries', 'next_retry_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_subscription_detail(self, obj):
        return {
            'id': obj.subscription.id,
            'patient_name': obj.subscription.patient.user.get_full_name(),
            'tier_name': obj.subscription.tier.name
        }

    def get_invoice_detail(self, obj):
        if obj.invoice:
            return {
                'id': obj.invoice.id,
                'invoice_number': obj.invoice.invoice_number,
                'status': obj.invoice.status
            }
        return None


class BillingSettingsSerializer(serializers.ModelSerializer):
    """Serializer for billing settings"""

    class Meta:
        model = BillingSettings
        fields = [
            'id', 'tax_rate', 'tax_inclusive', 'currency', 'payment_processor',
            'billing_day_of_month', 'grace_period_days', 'max_payment_retries',
            'retry_interval_days', 'late_fee_percentage', 'late_fee_fixed'
        ]