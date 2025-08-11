from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Patient, Claim, Invoice

User = get_user_model()


class PatientSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'user', 'user_username', 'date_of_birth', 'gender', 'scheme',
            'diagnoses', 'investigations', 'treatments'
        ]


class ClaimSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source='patient', read_only=True)

    class Meta:
        model = Claim
        fields = [
            'id', 'patient', 'patient_detail', 'provider', 'service_type', 'cost',
            'date_submitted', 'status', 'coverage_checked', 'notes'
        ]
        read_only_fields = ['status', 'coverage_checked', 'date_submitted', 'provider']


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ['id', 'claim', 'amount', 'payment_status', 'created_at']
        read_only_fields = ['created_at']
