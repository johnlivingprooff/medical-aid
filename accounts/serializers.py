from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import ProviderProfile, ProviderNetworkMembership, CredentialingDocument

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
        ]
        read_only_fields = ['id', 'role']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Optional provider profile fields
    facility_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    facility_type = serializers.ChoiceField(write_only=True, required=False, choices=ProviderProfile.FacilityType.choices)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    address = serializers.CharField(write_only=True, required=False, allow_blank=True)
    city = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role',
                  'facility_name', 'facility_type', 'phone', 'address', 'city']
        extra_kwargs = {'role': {'required': False}, 'id': {'read_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password')
        facility_name = validated_data.pop('facility_name', '').strip()
        facility_type = validated_data.pop('facility_type', None)
        phone = validated_data.pop('phone', '').strip()
        address = validated_data.pop('address', '').strip()
        city = validated_data.pop('city', '').strip()
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        # Create provider profile if role is PROVIDER and fields were provided
        if getattr(user, 'role', None) == 'PROVIDER' and (facility_name or facility_type):
            ProviderProfile.objects.create(
                user=user,
                facility_name=facility_name or user.get_full_name() or user.username,
                facility_type=facility_type or ProviderProfile.FacilityType.CLINIC,
                phone=phone,
                address=address,
                city=city,
            )
        return user


class ProviderNetworkMembershipSerializer(serializers.ModelSerializer):
    provider_username = serializers.CharField(source='provider.username', read_only=True)
    scheme_name = serializers.CharField(source='scheme.name', read_only=True)

    class Meta:
        model = ProviderNetworkMembership
        fields = ['id', 'provider', 'provider_username', 'scheme', 'scheme_name', 'status', 'effective_from', 'effective_to', 'credential_status', 'credentialed_at', 'notes', 'meta']
        read_only_fields = ['credentialed_at']


class CredentialingDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = CredentialingDocument
        fields = ['id', 'membership', 'uploaded_by', 'uploaded_by_username', 'file', 'doc_type', 'notes', 'status', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']
