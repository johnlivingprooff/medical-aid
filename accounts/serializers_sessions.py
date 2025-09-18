"""
Serializers for session management models.
"""

from rest_framework import serializers
from .models import UserSession, SessionSettings


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for UserSession model."""

    user_username = serializers.CharField(source='user.username', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    session_key = serializers.CharField(source='session.session_key', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserSession
        fields = [
            'id', 'user', 'user_username', 'user_role', 'session_key',
            'ip_address', 'user_agent', 'device_info', 'location_info',
            'status', 'created_at', 'last_activity', 'expires_at',
            'login_attempts', 'failed_mfa_attempts', 'suspicious_activities',
            'is_expired', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'last_activity']


class SessionSettingsSerializer(serializers.ModelSerializer):
    """Serializer for SessionSettings model."""

    class Meta:
        model = SessionSettings
        fields = [
            'id', 'max_concurrent_sessions', 'session_timeout_minutes',
            'block_suspicious_ips', 'require_mfa_for_new_sessions',
            'enable_session_monitoring', 'alert_on_suspicious_activity'
        ]