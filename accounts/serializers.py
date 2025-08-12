from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import ProviderProfile

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
