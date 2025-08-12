from rest_framework import serializers
from .models import SchemeCategory, SchemeBenefit, BenefitType
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
