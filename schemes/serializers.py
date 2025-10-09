from rest_framework import serializers
from .models import (
    SchemeCategory, SchemeBenefit, BenefitType, BenefitCategory,
    SubscriptionTier, MemberSubscription, PaymentMethod, Invoice,
    Payment, BillingHistory
)
from claims.models import Patient


class BenefitCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BenefitCategory
        fields = ['id', 'name', 'description', 'subscription_required', 'access_rules']


class SubscriptionTierSerializer(serializers.ModelSerializer):
    scheme_name = serializers.CharField(source='scheme.name', read_only=True)
    benefit_categories = BenefitCategorySerializer(many=True, read_only=True)
    benefit_category_ids = serializers.PrimaryKeyRelatedField(
        queryset=BenefitCategory.objects.all(),
        source='benefit_categories',
        many=True,
        write_only=True
    )

    class Meta:
        model = SubscriptionTier
        fields = [
            'id', 'name', 'scheme', 'scheme_name', 'tier_type', 'description',
            'monthly_price', 'yearly_price', 'max_dependents', 'max_claims_per_month',
            'max_coverage_per_year', 'benefit_categories', 'benefit_category_ids',
            'is_active', 'sort_order'
        ]
        read_only_fields = ['scheme_name']

    def validate(self, data):
        """Validate subscription tier data"""
        monthly_price = data.get('monthly_price')
        yearly_price = data.get('yearly_price')
        max_coverage_per_year = data.get('max_coverage_per_year')
        
        if monthly_price and yearly_price:
            # Yearly price should be reasonable (at least 10x monthly, allowing for annual discounts)
            min_yearly = monthly_price * 10
            if yearly_price < min_yearly:
                raise serializers.ValidationError({
                    'yearly_price': f'Yearly price should be at least {min_yearly} (10x monthly price to allow for annual discounts).'
                })
            
            # Yearly price should not be less than monthly
            if yearly_price < monthly_price:
                raise serializers.ValidationError({
                    'yearly_price': 'Yearly price cannot be less than monthly price.'
                })
        
        if max_coverage_per_year and monthly_price and max_coverage_per_year < monthly_price:
            raise serializers.ValidationError({
                'max_coverage_per_year': 'Maximum annual coverage should be higher than monthly subscription cost.'
            })
        
        return data


class MemberSubscriptionSerializer(serializers.ModelSerializer):
    patient_detail = serializers.SerializerMethodField()
    tier_detail = SubscriptionTierSerializer(source='tier', read_only=True)
    usage_stats = serializers.SerializerMethodField()

    class Meta:
        model = MemberSubscription
        fields = [
            'id', 'patient', 'patient_detail', 'tier', 'tier_detail',
            'subscription_type', 'status', 'start_date', 'end_date',
            'auto_renew', 'last_payment_date', 'next_payment_date',
            'claims_this_month', 'coverage_used_this_year',
            'usage_stats', 'created_at', 'updated_at'
        ]
        read_only_fields = ['patient_detail', 'tier_detail', 'usage_stats', 'created_at', 'updated_at']

    def get_patient_detail(self, obj):
        return {
            'id': obj.patient.id,
            'member_id': obj.patient.member_id,
            'user': {
                'id': obj.patient.user.id,
                'username': obj.patient.user.username,
                'first_name': obj.patient.user.first_name,
                'last_name': obj.patient.user.last_name,
            }
        }

    def get_usage_stats(self, obj):
        from .subscription_service import SubscriptionService
        return SubscriptionService.get_subscription_usage(obj)


class SubscriptionCreateSerializer(serializers.Serializer):
    """Serializer for creating new subscriptions"""
    patient_id = serializers.IntegerField()
    tier_id = serializers.IntegerField()
    subscription_type = serializers.ChoiceField(
        choices=[('MONTHLY', 'Monthly'), ('YEARLY', 'Yearly')],
        default='MONTHLY'
    )
    start_date = serializers.DateField(required=False)

    def validate_patient_id(self, value):
        try:
            patient = Patient.objects.get(id=value)
            # Check if patient already has an active subscription
            if hasattr(patient, 'subscription') and patient.subscription.status in ['ACTIVE', 'SUSPENDED']:
                raise serializers.ValidationError("Patient already has an active subscription")
            return value
        except Patient.DoesNotExist:
            raise serializers.ValidationError("Patient not found")

    def validate_tier_id(self, value):
        try:
            return SubscriptionTier.objects.get(id=value, is_active=True)
        except SubscriptionTier.DoesNotExist:
            raise serializers.ValidationError("Subscription tier not found or inactive")


class BenefitTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BenefitType
        fields = ['id', 'name']



class SchemeBenefitSerializer(serializers.ModelSerializer):
    # Accept scheme ID on create/update; expose benefit_type as ID for writes and nested object for reads
    scheme = serializers.PrimaryKeyRelatedField(queryset=SchemeCategory.objects.all(), write_only=True)
    benefit_type = serializers.PrimaryKeyRelatedField(queryset=BenefitType.objects.all())
    benefit_type_detail = BenefitTypeSerializer(source='benefit_type', read_only=True)

    class Meta:
        model = SchemeBenefit
        fields = [
            'id', 'scheme', 'benefit_type', 'benefit_type_detail', 'coverage_amount', 'coverage_limit_count', 
            'coverage_period', 'deductible_amount', 'copayment_percentage', 'copayment_fixed', 
            'requires_preauth', 'preauth_limit', 'waiting_period_days', 'network_only', 
            'is_active', 'effective_date', 'expiry_date'
        ]


class SchemeCategorySerializer(serializers.ModelSerializer):
    benefits = SchemeBenefitSerializer(many=True, read_only=True)
    subscription_tiers = SubscriptionTierSerializer(many=True, read_only=True)

    class Meta:
        model = SchemeCategory
        fields = ['id', 'name', 'description', 'price', 'is_active', 'benefits', 'subscription_tiers']


# Billing Serializers

class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer for payment methods"""

    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'payment_type', 'card_number_masked', 'card_holder_name',
            'expiry_month', 'expiry_year', 'account_number_masked',
            'routing_number', 'paypal_email', 'is_default', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'card_number_masked': {'write_only': True},
            'account_number_masked': {'write_only': True},
            'routing_number': {'write_only': True},
        }

    def create(self, validated_data):
        """Ensure only one default payment method per member"""
        validated_data['member'] = self.context['request'].user.patient_profile
        return super().create(validated_data)


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoices"""

    subscription_detail = MemberSubscriptionSerializer(source='subscription', read_only=True)
    payment_method_detail = PaymentMethodSerializer(source='payment_method', read_only=True)
    days_overdue = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'subscription', 'subscription_detail',
            'billing_start_date', 'billing_end_date', 'subtotal', 'tax_amount',
            'discount_amount', 'total_amount', 'status', 'issued_date',
            'due_date', 'paid_date', 'payment_method', 'payment_method_detail',
            'notes', 'days_overdue', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'invoice_number', 'subscription_detail', 'payment_method_detail',
            'days_overdue', 'created_at', 'updated_at'
        ]


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for payments"""

    invoice_detail = InvoiceSerializer(source='invoice', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'payment_id', 'invoice', 'invoice_detail', 'amount',
            'payment_method', 'status', 'payment_date', 'processed_date',
            'transaction_id', 'refund_amount', 'refund_date', 'refund_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'invoice_detail', 'created_at', 'updated_at'
        ]


class BillingHistorySerializer(serializers.ModelSerializer):
    """Serializer for billing history"""

    performed_by_detail = serializers.SerializerMethodField()
    invoice_detail = InvoiceSerializer(source='invoice', read_only=True)
    payment_detail = PaymentSerializer(source='payment', read_only=True)

    class Meta:
        model = BillingHistory
        fields = [
            'id', 'subscription', 'action', 'invoice', 'invoice_detail',
            'payment', 'payment_detail', 'amount', 'description', 'metadata',
            'performed_by', 'performed_by_detail', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']

    def get_performed_by_detail(self, obj):
        if obj.performed_by:
            return {
                'id': obj.performed_by.id,
                'username': obj.performed_by.username,
                'first_name': obj.performed_by.first_name,
                'last_name': obj.performed_by.last_name,
            }
        return None


class PaymentProcessingSerializer(serializers.Serializer):
    """Serializer for payment processing"""

    invoice_id = serializers.IntegerField()
    payment_method_id = serializers.IntegerField()
    payment_data = serializers.JSONField(required=False, default=dict)

    def validate_invoice_id(self, value):
        try:
            invoice = Invoice.objects.get(id=value)
            if invoice.status == 'PAID':
                raise serializers.ValidationError("Invoice is already paid")
            return invoice
        except Invoice.DoesNotExist:
            raise serializers.ValidationError("Invoice not found")

    def validate_payment_method_id(self, value):
        try:
            payment_method = PaymentMethod.objects.get(
                id=value,
                member=self.context['request'].user.patient_profile,
                is_active=True
            )
            return payment_method
        except PaymentMethod.DoesNotExist:
            raise serializers.ValidationError("Payment method not found or inactive")


class BillingSummarySerializer(serializers.Serializer):
    """Serializer for billing summary"""

    total_invoiced = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_refunded = serializers.DecimalField(max_digits=12, decimal_places=2)
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    next_billing_date = serializers.DateField()
    auto_renew = serializers.BooleanField()
    recent_invoices = InvoiceSerializer(many=True)
    recent_payments = PaymentSerializer(many=True)
    recent_history = BillingHistorySerializer(many=True)
