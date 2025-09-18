"""
Session management middleware for enhanced security and tracking.
"""

import json
from django.contrib.sessions.models import Session
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model
from .models import UserSession, SessionSettings
from django.core.exceptions import ObjectDoesNotExist

User = get_user_model()


class SessionSecurityMiddleware(MiddlewareMixin):
    """Middleware for session security and tracking."""

    def process_request(self, request):
        """Process incoming requests for session security."""
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return

        # Get or create user session
        session_key = request.session.session_key
        if session_key:
            user_session, created = UserSession.objects.get_or_create(
                session_id=session_key,
                defaults={
                    'user': request.user,
                    'session_id': session_key,
                    'ip_address': self._get_client_ip(request),
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'device_info': self._get_device_info(request),
                }
            )

            if not created:
                # Update existing session info
                user_session.last_activity = timezone.now()
                user_session.ip_address = self._get_client_ip(request)
                user_session.save(update_fields=['last_activity', 'ip_address'])

            # Check for suspicious activity
            self._check_suspicious_activity(request, user_session)

            # Check session limits
            self._enforce_session_limits(request.user)

    def _get_client_ip(self, request):
        """Get the client's IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def _get_device_info(self, request):
        """Extract device information from request."""
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        # Basic device detection
        device_info = {
            'user_agent': user_agent,
            'is_mobile': 'Mobile' in user_agent,
            'is_tablet': 'Tablet' in user_agent,
            'browser': self._detect_browser(user_agent),
            'os': self._detect_os(user_agent),
        }

        return device_info

    def _detect_browser(self, user_agent):
        """Detect browser from user agent."""
        browsers = {
            'Chrome': 'Chrome',
            'Firefox': 'Firefox',
            'Safari': 'Safari',
            'Edge': 'Edge',
            'Opera': 'Opera',
        }

        for browser, identifier in browsers.items():
            if identifier in user_agent:
                return browser
        return 'Unknown'

    def _detect_os(self, user_agent):
        """Detect operating system from user agent."""
        os_list = {
            'Windows': 'Windows',
            'macOS': 'Macintosh',
            'Linux': 'Linux',
            'Android': 'Android',
            'iOS': 'iPhone',
        }

        for os_name, identifier in os_list.items():
            if identifier in user_agent:
                return os_name
        return 'Unknown'

    def _check_suspicious_activity(self, request, user_session):
        """Check for suspicious session activity."""
        settings = SessionSettings.get_settings()

        if not settings.enable_session_monitoring:
            return

        current_ip = self._get_client_ip(request)
        suspicious = False
        reasons = []

        # Check for IP address changes
        if user_session.ip_address and user_session.ip_address != current_ip:
            # This could be normal (VPN, mobile network changes)
            # but we'll log it for monitoring
            reasons.append('IP address changed')

        # Check for unusual login times (basic check)
        current_hour = timezone.now().hour
        if current_hour < 6 or current_hour > 22:  # Outside 6 AM - 10 PM
            reasons.append('Unusual login time')

        # Check for rapid login attempts
        if user_session.login_attempts > 5:
            suspicious = True
            reasons.append('High login attempt frequency')

        if suspicious and settings.alert_on_suspicious_activity:
            user_session.mark_suspicious(
                'Suspicious activity detected',
                {'reasons': reasons, 'ip': current_ip}
            )

    def _enforce_session_limits(self, user):
        """Enforce concurrent session limits."""
        settings = SessionSettings.get_settings()

        # Get active sessions for user
        active_sessions = UserSession.objects.filter(
            user=user,
            status=UserSession.SessionStatus.ACTIVE
        ).count()

        if active_sessions > settings.max_concurrent_sessions:
            # Terminate oldest sessions
            sessions_to_terminate = UserSession.objects.filter(
                user=user,
                status=UserSession.SessionStatus.ACTIVE
            ).order_by('last_activity')[:active_sessions - settings.max_concurrent_sessions]

            for session in sessions_to_terminate:
                session.terminate("Session limit exceeded")


class SessionTimeoutMiddleware(MiddlewareMixin):
    """Middleware to handle session timeouts and cleanup."""

    def process_request(self, request):
        """Check for session timeouts."""
        if hasattr(request, 'session') and request.session.session_key:
            try:
                session = Session.objects.get(session_key=request.session.session_key)

                # Check if session has expired
                if session.expire_date <= timezone.now():
                    # Session has expired, delete it
                    request.session.flush()
                    return

                # Update session expiry if it's an authenticated user
                if hasattr(request, 'user') and request.user.is_authenticated:
                    settings = SessionSettings.get_settings()
                    # Extend session by configured timeout
                    new_expiry = timezone.now() + timezone.timedelta(
                        minutes=settings.session_timeout_minutes
                    )
                    session.expire_date = new_expiry
                    session.save()

            except Session.DoesNotExist:
                # Session doesn't exist, flush it
                request.session.flush()