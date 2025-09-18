"""
Session management views for administrators.
"""

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter

from .models import UserSession, SessionSettings
from .serializers_sessions import UserSessionSerializer, SessionSettingsSerializer

User = get_user_model()


class IsAdminOrStaff(permissions.BasePermission):
    """Permission for admin or staff users."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.role == 'ADMIN' or request.user.is_staff)
        )


class UserSessionViewSet(ModelViewSet):
    """ViewSet for managing user sessions."""
    queryset = UserSession.objects.all()
    serializer_class = UserSessionSerializer
    permission_classes = [IsAdminOrStaff]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['user', 'status', 'ip_address']
    search_fields = ['user__username', 'ip_address', 'user_agent']
    ordering_fields = ['created_at', 'last_activity', 'expires_at']
    ordering = ['-last_activity']

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """Terminate a specific user session."""
        session = self.get_object()
        reason = request.data.get('reason', 'Administrative termination')

        session.terminate(reason)

        return Response({
            'message': f'Session terminated: {reason}',
            'session_id': session.id
        })

    @action(detail=False, methods=['post'])
    def terminate_user_sessions(self, request):
        """Terminate all sessions for a specific user."""
        user_id = request.data.get('user_id')
        exclude_current = request.data.get('exclude_current', True)
        reason = request.data.get('reason', 'Bulk session termination')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Import the utility function
        from .models import terminate_user_sessions

        exclude_session = None
        if exclude_current and hasattr(request, 'session'):
            exclude_session = request.session.session_key

        terminated_count = terminate_user_sessions(user, exclude_session)

        return Response({
            'message': f'Terminated {terminated_count} sessions for user {user.username}',
            'terminated_count': terminated_count
        })

    @action(detail=False, methods=['get'])
    def active_sessions(self, request):
        """Get all active sessions."""
        active_sessions = UserSession.objects.filter(
            status=UserSession.SessionStatus.ACTIVE
        ).select_related('user', 'session')

        serializer = self.get_serializer(active_sessions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def suspicious_sessions(self, request):
        """Get sessions marked as suspicious."""
        suspicious_sessions = UserSession.objects.filter(
            status=UserSession.SessionStatus.SUSPICIOUS
        ).select_related('user', 'session')

        serializer = self.get_serializer(suspicious_sessions, many=True)
        return Response(serializer.data)


class SessionSettingsViewSet(ModelViewSet):
    """ViewSet for managing session settings."""
    queryset = SessionSettings.objects.all()
    serializer_class = SessionSettingsSerializer
    permission_classes = [IsAdminOrStaff]

    def get_queryset(self):
        # Ensure only one settings instance exists
        if not SessionSettings.objects.exists():
            SessionSettings.objects.create()
        return SessionSettings.objects.all()

    def get_object(self):
        # Always return the single settings instance
        return SessionSettings.get_settings()

    @action(detail=False, methods=['post'])
    def cleanup_expired(self, request):
        """Clean up expired sessions."""
        from .models import cleanup_expired_sessions

        cleaned_count = cleanup_expired_sessions()

        return Response({
            'message': f'Cleaned up {cleaned_count} expired sessions',
            'cleaned_count': cleaned_count
        })


class UserSessionStatsView(generics.GenericAPIView):
    """View for session statistics."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        """Get session statistics."""
        total_sessions = UserSession.objects.count()
        active_sessions = UserSession.objects.filter(
            status=UserSession.SessionStatus.ACTIVE
        ).count()
        suspicious_sessions = UserSession.objects.filter(
            status=UserSession.SessionStatus.SUSPICIOUS
        ).count()
        terminated_sessions = UserSession.objects.filter(
            status=UserSession.SessionStatus.TERMINATED
        ).count()

        # Get sessions by user role
        admin_sessions = UserSession.objects.filter(
            user__role='ADMIN',
            status=UserSession.SessionStatus.ACTIVE
        ).count()
        provider_sessions = UserSession.objects.filter(
            user__role='PROVIDER',
            status=UserSession.SessionStatus.ACTIVE
        ).count()
        patient_sessions = UserSession.objects.filter(
            user__role='PATIENT',
            status=UserSession.SessionStatus.ACTIVE
        ).count()

        return Response({
            'total_sessions': total_sessions,
            'active_sessions': active_sessions,
            'suspicious_sessions': suspicious_sessions,
            'terminated_sessions': terminated_sessions,
            'active_by_role': {
                'admin': admin_sessions,
                'provider': provider_sessions,
                'patient': patient_sessions,
            }
        })