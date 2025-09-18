from rest_framework import serializers
from .models import SchemeCategory, SchemeBenefit, BenefitType, BenefitCategory, SubscriptionTier, MemberSubscription
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

    class Meta:
        model = SchemeCategory
        fields = ['id', 'name', 'description', 'price', 'benefits']
