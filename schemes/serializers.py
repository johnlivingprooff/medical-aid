from rest_framework import serializers
from .models import SchemeCategory, SchemeBenefit


class SchemeBenefitSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemeBenefit
        fields = ['id', 'benefit_type', 'coverage_amount', 'coverage_limit_count', 'coverage_period']


class SchemeCategorySerializer(serializers.ModelSerializer):
    benefits = SchemeBenefitSerializer(many=True, read_only=True)

    class Meta:
        model = SchemeCategory
        fields = ['id', 'name', 'description', 'benefits']
