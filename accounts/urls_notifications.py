"""
URL patterns for notification management.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views_notifications import (
    NotificationViewSet, NotificationPreferenceViewSet,
    NotificationLogViewSet, NotificationManagementViewSet,
    NotificationDashboardViewSet
)

# Create router for notification endpoints
notification_router = DefaultRouter()
notification_router.register(r'notifications', NotificationViewSet, basename='notification')
notification_router.register(r'preferences', NotificationPreferenceViewSet, basename='notification-preference')
notification_router.register(r'logs', NotificationLogViewSet, basename='notification-log')
notification_router.register(r'management', NotificationManagementViewSet, basename='notification-management')
notification_router.register(r'dashboard', NotificationDashboardViewSet, basename='notification-dashboard')

# URL patterns
urlpatterns = [
    # Include router URLs
    path('', include(notification_router.urls)),

    # Additional notification endpoints
    path('notifications/unread-count/', NotificationViewSet.as_view({'get': 'unread_count'}), name='notification-unread-count'),
    path('notifications/mark-read/', NotificationViewSet.as_view({'post': 'mark_read'}), name='notification-mark-read'),
    path('notifications/mark-all-read/', NotificationViewSet.as_view({'post': 'mark_all_read'}), name='notification-mark-all-read'),
    path('notifications/stats/', NotificationViewSet.as_view({'get': 'stats'}), name='notification-stats'),

    # Preference endpoints
    path('preferences/my/', NotificationPreferenceViewSet.as_view({'get': 'my_preferences'}), name='my-preferences'),

    # Management endpoints
    path('management/send-bulk/', NotificationManagementViewSet.as_view({'post': 'send_bulk'}), name='send-bulk-notification'),
    path('management/send-announcement/', NotificationManagementViewSet.as_view({'post': 'send_system_announcement'}), name='send-system-announcement'),
    path('management/process-scheduled/', NotificationManagementViewSet.as_view({'post': 'process_scheduled'}), name='process-scheduled-notifications'),
    path('management/cleanup/', NotificationManagementViewSet.as_view({'post': 'cleanup_old'}), name='cleanup-notifications'),

    # Dashboard endpoints
    path('dashboard/data/', NotificationDashboardViewSet.as_view({'get': 'dashboard_data'}), name='notification-dashboard-data'),
]