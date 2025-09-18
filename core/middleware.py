import logging
import json
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from .error_tracking import error_tracker


class ErrorTrackingMiddleware(MiddlewareMixin):
    """
    Middleware to automatically track errors and exceptions
    """

    def process_exception(self, request, exception):
        """
        Track exceptions that occur during request processing
        """
        # Don't track in debug mode for development
        if settings.DEBUG:
            return None

        # Track the error
        error_data = error_tracker.track_error(
            error=exception,
            request=request,
            user=getattr(request, 'user', None),
            context={
                'middleware': 'ErrorTrackingMiddleware',
                'view': getattr(request, 'resolver_match', {}).view_name if hasattr(request, 'resolver_match') else None,
            }
        )

        # Return a JSON error response for API requests
        if request.path.startswith('/api/'):
            return JsonResponse({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred. Our team has been notified.',
                'error_id': error_data.get('timestamp', 'unknown')
            }, status=500)

        return None


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log all requests and responses
    """

    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.logger = logging.getLogger('medical_aid.requests')

    def process_request(self, request):
        """Log incoming requests"""
        if not settings.DEBUG:  # Only log in production
            self.logger.info(
                f"Request: {request.method} {request.path}",
                extra={
                    'method': request.method,
                    'path': request.path,
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'remote_addr': request.META.get('REMOTE_ADDR', ''),
                    'user': request.user.username if request.user.is_authenticated else 'anonymous',
                }
            )

    def process_response(self, request, response):
        """Log response details"""
        if not settings.DEBUG:  # Only log in production
            self.logger.info(
                f"Response: {response.status_code} for {request.method} {request.path}",
                extra={
                    'status_code': response.status_code,
                    'method': request.method,
                    'path': request.path,
                    'content_length': len(response.content) if hasattr(response, 'content') else 0,
                }
            )

        return response


class PerformanceMonitoringMiddleware(MiddlewareMixin):
    """
    Middleware to monitor request performance
    """

    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.logger = logging.getLogger('medical_aid.performance')

    def process_request(self, request):
        """Start timing the request"""
        if not settings.DEBUG:
            request._start_time = timezone.now()

    def process_response(self, request, response):
        """Log performance metrics"""
        if not settings.DEBUG and hasattr(request, '_start_time'):
            duration = timezone.now() - request._start_time
            duration_ms = duration.total_seconds() * 1000

            # Log slow requests
            if duration_ms > 1000:  # More than 1 second
                self.logger.warning(
                    f"Slow request: {request.method} {request.path} took {duration_ms:.2f}ms",
                    extra={
                        'method': request.method,
                        'path': request.path,
                        'duration_ms': duration_ms,
                        'status_code': response.status_code,
                        'user': request.user.username if request.user.is_authenticated else 'anonymous',
                    }
                )

        return response