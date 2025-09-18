from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Claim
from .models import Patient, Claim, Invoice
from .models import PreAuthorizationRequest, PreAuthorizationApproval, PreAuthorizationRule, FraudAlert
from schemes.models import BenefitType

User = get_user_model()


class PatientSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
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
            'id', 'member_id', 'user', 'user_username', 'user_first_name', 'user_last_name', 'user_email',
            'user_date_joined', 'date_of_birth', 'gender', 'status', 
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
        benefit_start = obj.benefit_year_start or obj.enrollment_date
        if not benefit_start:
            # If no benefit year start or enrollment date, return None
            return None
            
        from django.utils import timezone
        today = timezone.now().date()
        
        # Calculate next renewal date
        current_year_renewal = benefit_start.replace(year=today.year)
        if current_year_renewal > today:
            # This year's renewal hasn't happened yet
            return current_year_renewal
        else:
            # This year's renewal has passed, return next year's
            return benefit_start.replace(year=today.year + 1)

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
    fraud_alerts = serializers.SerializerMethodField()
    pre_auth_status = serializers.SerializerMethodField()
    subscription_context = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = [
            'id', 'patient', 'patient_detail', 'provider', 'provider_username', 'service_type', 'service_type_name', 
            'cost', 'date_submitted', 'date_of_service', 'status', 'priority', 'coverage_checked', 
            'processed_date', 'processed_by', 'processed_by_username', 'diagnosis_code', 'procedure_code', 
            'notes', 'preauth_number', 'preauth_expiry', 'rejection_reason', 'rejection_date',
            'fraud_alerts', 'pre_auth_status', 'subscription_context'
        ]
        read_only_fields = ['status', 'coverage_checked', 'date_submitted', 'provider', 'processed_date', 'processed_by']

    def get_fraud_alerts(self, obj):
        """Get fraud alerts related to this claim"""
        fraud_alerts = FraudAlert.objects.filter(claim=obj).order_by('-created_at')
        return FraudAlertSerializer(fraud_alerts, many=True, context=self.context).data

    def get_subscription_context(self, obj):
        """Get subscription context for this claim"""
        try:
            from schemes.models import MemberSubscription, SubscriptionTier
            
            # Get patient's active subscription
            subscription = MemberSubscription.objects.filter(
                patient=obj.patient,
                status='ACTIVE'
            ).first()
            
            if not subscription:
                return {
                    'has_subscription': False,
                    'message': 'No active subscription found'
                }
            
            # Get subscription tier details
            tier = subscription.subscription_tier
            
            # Calculate benefit utilization for this service type
            from schemes.models import SchemeBenefit
            benefit = SchemeBenefit.objects.filter(
                scheme_category=obj.patient.scheme,
                benefit_type=obj.service_type
            ).first()
            
            utilization_info = {}
            if benefit and benefit.coverage_amount:
                # Calculate used amount for this benefit type
                from django.db.models import Sum
                from .models import Claim as ClaimModel
                used_amount = ClaimModel.objects.filter(
                    patient=obj.patient,
                    service_type=obj.service_type,
                    status='APPROVED'
                ).aggregate(total=Sum('cost'))['total'] or 0
                
                remaining_amount = float(benefit.coverage_amount) - float(used_amount)
                utilization_percentage = (float(used_amount) / float(benefit.coverage_amount)) * 100
                
                utilization_info = {
                    'benefit_limit': float(benefit.coverage_amount),
                    'used_amount': float(used_amount),
                    'remaining_amount': max(remaining_amount, 0),
                    'utilization_percentage': min(utilization_percentage, 100)
                }
            
            return {
                'has_subscription': True,
                'subscription_id': subscription.id,
                'tier_name': tier.name,
                'tier_level': tier.level,
                'monthly_premium': float(tier.monthly_premium),
                'annual_limit': float(tier.annual_limit) if tier.annual_limit else None,
                'utilization_info': utilization_info,
                'subscription_status': subscription.status,
                'renewal_date': subscription.renewal_date
            }
            
        except Exception as e:
            return {
                'has_subscription': False,
                'error': f'Error retrieving subscription context: {str(e)}'
            }


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


class PreAuthorizationRuleSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)
    benefit_type_name = serializers.CharField(source='benefit_type.name', read_only=True)

    class Meta:
        model = PreAuthorizationRule
        fields = [
            'id', 'name', 'description', 'benefit_type', 'benefit_type_name', 'rule_type', 
            'condition_field', 'condition_operator', 'condition_value', 'action_type', 
            'action_value', 'is_active', 'priority', 'created_by', 'created_by_username', 
            'updated_by', 'updated_by_username', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']


class PreAuthorizationRequestSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source='patient', read_only=True)
    provider_username = serializers.CharField(source='provider.username', read_only=True)
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)
    benefit_type_name = serializers.CharField(source='benefit_type.name', read_only=True)
    days_until_expiry = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = PreAuthorizationRequest
        fields = [
            'id', 'request_number', 'patient', 'patient_detail', 'provider', 'provider_username', 
            'benefit_type', 'benefit_type_name', 'procedure_description', 'estimated_cost', 
            'urgency_level', 'clinical_notes', 'supporting_documents', 'status', 'priority', 
            'requested_by', 'requested_by_username', 'requested_date', 'expiry_date', 
            'days_until_expiry', 'is_expired', 'approved_amount', 'approved_conditions', 
            'rejection_reason', 'review_notes', 'reviewed_by', 'reviewed_date'
        ]
        read_only_fields = [
            'request_number', 'requested_by', 'requested_date', 'reviewed_by', 'reviewed_date', 
            'approved_amount', 'approved_conditions', 'rejection_reason', 'review_notes'
        ]

    def get_days_until_expiry(self, obj):
        if obj.expiry_date:
            today = timezone.now().date()
            if obj.expiry_date >= today:
                return (obj.expiry_date - today).days
            return 0
        return None

    def get_is_expired(self, obj):
        if obj.expiry_date:
            return obj.expiry_date < timezone.now().date()
        return False


class PreAuthorizationApprovalSerializer(serializers.ModelSerializer):
    request_detail = PreAuthorizationRequestSerializer(source='request', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)
    benefit_type_name = serializers.CharField(source='benefit_type.name', read_only=True)

    class Meta:
        model = PreAuthorizationApproval
        fields = [
            'id', 'request', 'request_detail', 'benefit_type', 'benefit_type_name', 
            'approved_amount', 'approved_conditions', 'approval_notes', 'approved_by', 
            'approved_by_username', 'approved_date', 'is_active', 'expires_at'
        ]
        read_only_fields = ['approved_by', 'approved_date']


class FraudAlertSerializer(serializers.ModelSerializer):
    claim_detail = ClaimSerializer(source='claim', read_only=True)
    patient_detail = PatientSerializer(source='patient', read_only=True)
    provider_username = serializers.CharField(source='provider.username', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)
    days_since_creation = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = FraudAlert
        fields = [
            'id', 'alert_type', 'severity', 'status', 'claim', 'claim_detail', 'patient',
            'patient_detail', 'provider', 'provider_username', 'title', 'description',
            'fraud_score', 'detection_rule', 'detection_data', 'reviewed_by',
            'reviewed_by_username', 'reviewed_at', 'review_notes', 'resolution_action',
            'created_at', 'updated_at', 'days_since_creation', 'is_active'
        ]
        read_only_fields = [
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at', 'days_since_creation', 'is_active'
        ]

    def get_days_since_creation(self, obj):
        return obj.days_since_creation

    def get_is_active(self, obj):
        return obj.is_active
