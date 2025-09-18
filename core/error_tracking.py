import logging
import traceback
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
import json


class ErrorTracker:
    """Custom error tracking and alerting system"""

    def __init__(self):
        self.logger = logging.getLogger('medical_aid.errors')
        self.alert_cooldown = timedelta(minutes=5)  # Don't send alerts too frequently
        self.last_alert_time = {}

    def track_error(self, error, request=None, user=None, context=None):
        """
        Track and log an error with optional alerting
        """
        error_data = {
            'timestamp': timezone.now().isoformat(),
            'error_type': type(error).__name__,
            'error_message': str(error),
            'traceback': traceback.format_exc(),
            'request': self._extract_request_info(request) if request else None,
            'user': self._extract_user_info(user) if user else None,
            'context': context or {},
        }

        # Log the error
        self.logger.error(
            f"Error tracked: {error_data['error_type']}: {error_data['error_message']}",
            extra={'error_data': json.dumps(error_data, default=str)}
        )

        # Check if we should send an alert
        self._check_and_send_alert(error_data)

        return error_data

    def _extract_request_info(self, request):
        """Extract relevant information from the request"""
        if not request:
            return None

        return {
            'method': request.method,
            'path': request.path,
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'remote_addr': self._get_client_ip(request),
            'query_params': dict(request.GET),
            'post_data': dict(request.POST) if request.POST else None,
        }

    def _extract_user_info(self, user):
        """Extract relevant user information"""
        if not user or not user.is_authenticated:
            return None

        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        }

    def _get_client_ip(self, request):
        """Get the client's IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def _check_and_send_alert(self, error_data):
        """Check if we should send an alert for this error"""
        error_type = error_data['error_type']
        now = timezone.now()

        # Check cooldown
        if error_type in self.last_alert_time:
            time_since_last_alert = now - self.last_alert_time[error_type]
            if time_since_last_alert < self.alert_cooldown:
                return  # Too soon to send another alert

        # Update last alert time
        self.last_alert_time[error_type] = now

        # Send alert
        self._send_alert_email(error_data)

    def _send_alert_email(self, error_data):
        """Send an alert email for the error"""
        if not settings.DEBUG:  # Only send emails in production
            try:
                subject = f"Medical Aid Error Alert: {error_data['error_type']}"

                message = f"""
Medical Aid System Error Alert

Error Type: {error_data['error_type']}
Message: {error_data['error_message']}
Timestamp: {error_data['timestamp']}

Request Info:
{json.dumps(error_data['request'], indent=2) if error_data['request'] else 'No request info'}

User Info:
{json.dumps(error_data['user'], indent=2) if error_data['user'] else 'No user info'}

Context:
{json.dumps(error_data['context'], indent=2) if error_data['context'] else 'No context'}

Traceback:
{error_data['traceback']}
                """

                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[settings.ADMIN_EMAIL],
                    fail_silently=True
                )

                self.logger.info(f"Error alert email sent for {error_data['error_type']}")

            except Exception as e:
                self.logger.error(f"Failed to send error alert email: {str(e)}")


# Global error tracker instance
error_tracker = ErrorTracker()


def track_error(error, request=None, user=None, context=None):
    """
    Convenience function to track errors
    """
    return error_tracker.track_error(error, request, user, context)