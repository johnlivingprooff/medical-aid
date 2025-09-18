"""
MFA (Multi-Factor Authentication) views for the Medical Aid system.
Provides TOTP setup, verification, and management endpoints.
"""

import qrcode
import io
import base64
from django.contrib.auth import get_user_model
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import status, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from django_otp import devices_for_user
from django_otp.plugins.otp_totp.models import TOTPDevice

User = get_user_model()


class MFASetupSerializer(serializers.Serializer):
    """Serializer for MFA setup response."""
    qr_code = serializers.CharField()
    secret = serializers.CharField()
    backup_codes = serializers.ListField(child=serializers.CharField())


class MFAVerifySerializer(serializers.Serializer):
    """Serializer for MFA verification."""
    token = serializers.CharField(max_length=6, min_length=6)
    device_id = serializers.IntegerField(required=False)


class MFABackupCodeSerializer(serializers.Serializer):
    """Serializer for backup code verification."""
    backup_code = serializers.CharField()


class MFAViewSet(ModelViewSet):
    """ViewSet for MFA management."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def setup(self, request):
        """Set up MFA for the current user."""
        user = request.user

        # Check if user already has MFA enabled
        if user.mfa_enabled:
            return Response(
                {'error': 'MFA is already enabled for this user'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create TOTP device
        device = TOTPDevice.objects.create(
            user=user,
            name=f"{user.username}'s TOTP Device",
            confirmed=False
        )

        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        provisioning_uri = device.config_url
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

        # Generate backup codes
        import secrets
        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        user.backup_codes = backup_codes
        user.save()

        return Response({
            'qr_code': f"data:image/png;base64,{qr_code_base64}",
            'secret': device.bin_key.decode('utf-8'),
            'backup_codes': backup_codes,
            'device_id': device.id
        })

    @action(detail=False, methods=['post'])
    def verify_setup(self, request):
        """Verify MFA setup with initial token."""
        serializer = MFAVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        token = serializer.validated_data['token']
        device_id = serializer.validated_data.get('device_id')

        try:
            if device_id:
                device = TOTPDevice.objects.get(id=device_id, user=user, confirmed=False)
            else:
                device = TOTPDevice.objects.filter(user=user, confirmed=False).first()

            if not device:
                return Response(
                    {'error': 'No unconfirmed MFA device found'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Verify the token
            if device.verify_token(token):
                device.confirmed = True
                device.save()
                user.mfa_enabled = True
                user.save()

                return Response({
                    'message': 'MFA setup completed successfully',
                    'backup_codes': user.backup_codes
                })
            else:
                return Response(
                    {'error': 'Invalid token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except TOTPDevice.DoesNotExist:
            return Response(
                {'error': 'MFA device not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def verify(self, request):
        """Verify MFA token for authentication."""
        serializer = MFAVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        token = serializer.validated_data['token']

        # Find user's confirmed TOTP device
        device = user.get_totp_device()
        if not device:
            return Response(
                {'error': 'No MFA device configured'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if device.verify_token(token):
            return Response({'message': 'MFA verification successful'})
        else:
            return Response(
                {'error': 'Invalid MFA token'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def verify_backup_code(self, request):
        """Verify backup code for MFA recovery."""
        serializer = MFABackupCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        backup_code = serializer.validated_data['backup_code']

        if backup_code in user.backup_codes:
            # Remove used backup code
            user.backup_codes.remove(backup_code)
            user.save()
            return Response({'message': 'Backup code verification successful'})
        else:
            return Response(
                {'error': 'Invalid backup code'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def disable(self, request):
        """Disable MFA for the current user."""
        user = request.user

        if not user.mfa_enabled:
            return Response(
                {'error': 'MFA is not enabled for this user'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete all TOTP devices
        TOTPDevice.objects.filter(user=user).delete()

        # Reset MFA settings
        user.mfa_enabled = False
        user.backup_codes = []
        user.save()

        return Response({'message': 'MFA disabled successfully'})

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get MFA status for the current user."""
        user = request.user

        device = user.get_totp_device()

        return Response({
            'mfa_enabled': user.mfa_enabled,
            'mfa_required': user.is_mfa_required,
            'has_device': device is not None,
            'device_name': device.name if device else None,
            'backup_codes_count': len(user.backup_codes)
        })

    @action(detail=False, methods=['post'])
    def regenerate_backup_codes(self, request):
        """Regenerate backup codes for the current user."""
        user = request.user

        if not user.mfa_enabled:
            return Response(
                {'error': 'MFA must be enabled to regenerate backup codes'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate new backup codes
        import secrets
        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        user.backup_codes = backup_codes
        user.save()

        return Response({
            'message': 'Backup codes regenerated successfully',
            'backup_codes': backup_codes
        })