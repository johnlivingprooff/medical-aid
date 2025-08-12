from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Claim
from .models import Patient, Claim, Invoice
from schemes.models import BenefitType

User = get_user_model()


class PatientSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    member_id = serializers.CharField(read_only=True)
    user_date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
    scheme_name = serializers.CharField(source='scheme.name', read_only=True)
    last_claim_date = serializers.SerializerMethodField()
    next_renewal = serializers.SerializerMethodField()
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    age = serializers.ReadOnlyField()
    is_dependent = serializers.ReadOnlyField()
    principal_member_name = serializers.CharField(source='principal_member.user.username', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'member_id', 'user', 'user_username', 'user_date_joined', 'date_of_birth', 'gender', 'status', 
            'scheme', 'scheme_name', 'enrollment_date', 'benefit_year_start', 'principal_member', 'principal_member_name',
            'relationship', 'phone', 'emergency_contact', 'emergency_phone', 'last_claim_date', 'next_renewal', 
            'first_name', 'last_name', 'age', 'is_dependent', 'diagnoses', 'investigations', 'treatments'
        ]

    def get_last_claim_date(self, obj):
        latest = (
            Claim.objects.filter(patient=obj).order_by('-date_submitted').values_list('date_submitted', flat=True).first()
        )
        return latest

    def get_next_renewal(self, obj):
        # Calculate next benefit year start
        benefit_start = obj.benefit_year_start_date
        from django.utils import timezone
        today = timezone.now().date()
        next_renewal = benefit_start.replace(year=today.year + 1)
        if benefit_start.replace(year=today.year) > today:
            next_renewal = benefit_start.replace(year=today.year)
        return next_renewal

    def update(self, instance: Patient, validated_data):
        # Pop nested user name updates if provided
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        if first_name is not None or last_name is not None:
            user = instance.user
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
            user.save(update_fields=[f for f, v in [('first_name', first_name), ('last_name', last_name)] if v is not None])
        return super().update(instance, validated_data)


class ClaimSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source='patient', read_only=True)
    service_type = serializers.PrimaryKeyRelatedField(queryset=BenefitType.objects.all())
    service_type_name = serializers.CharField(source='service_type.name', read_only=True)
    provider_username = serializers.CharField(source='provider.username', read_only=True)
    processed_by_username = serializers.CharField(source='processed_by.username', read_only=True)

    class Meta:
        model = Claim
        fields = [
            'id', 'patient', 'patient_detail', 'provider', 'provider_username', 'service_type', 'service_type_name', 
            'cost', 'date_submitted', 'date_of_service', 'status', 'priority', 'coverage_checked', 
            'processed_date', 'processed_by', 'processed_by_username', 'diagnosis_code', 'procedure_code', 
            'notes', 'preauth_number', 'preauth_expiry', 'rejection_reason', 'rejection_date'
        ]
        read_only_fields = ['status', 'coverage_checked', 'date_submitted', 'provider', 'processed_date', 'processed_by']


class InvoiceSerializer(serializers.ModelSerializer):
    claim_details = ClaimSerializer(source='claim', read_only=True)
    total_patient_responsibility = serializers.ReadOnlyField()
    amount_outstanding = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'claim', 'claim_details', 'amount', 'payment_status', 'amount_paid', 'payment_date', 
            'payment_reference', 'patient_deductible', 'patient_copay', 'patient_coinsurance', 
            'created_at', 'updated_at', 'provider_bank_account', 'provider_bank_name',
            'total_patient_responsibility', 'amount_outstanding'
        ]
        read_only_fields = ['created_at', 'updated_at']
