"""
Views for managing provider notifications and communications.
"""

from django.db import models
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, CharFilter, ChoiceFilter, DateTimeFilter

from .models_notifications import (
    Notification, NotificationPreference, NotificationLog,
    NotificationType, NotificationChannel, NotificationTemplate
)
from .serializers_notifications import (
    NotificationSerializer, NotificationDetailSerializer,
    NotificationPreferenceSerializer, NotificationLogSerializer, NotificationTemplateSerializer
)
from .notification_service import NotificationService
from .permissions import IsProviderOrAdmin

User = get_user_model()


class NotificationPagination(PageNumberPagination):
    """Custom pagination for notifications."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationFilter(FilterSet):
    """Filter for notifications."""
    notification_type = ChoiceFilter(choices=NotificationType.choices)
    channel = ChoiceFilter(choices=NotificationChannel.choices)
    status = ChoiceFilter(choices=Notification.Status.choices)
    created_after = DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = DateTimeFilter(field_name='created_at', lookup_expr='lte')
    priority = CharFilter(field_name='priority')

    class Meta:
        model = Notification
        fields = ['notification_type', 'channel', 'status', 'priority']


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing notifications."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsProviderOrAdmin]
    pagination_class = NotificationPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = NotificationFilter

    def get_queryset(self):
        """Filter notifications based on user role."""
        user = self.request.user

        if user.role == 'ADMIN':
            # Admins can see all notifications
            return Notification.objects.all()
        elif user.role == 'PROVIDER':
            # Providers see their own notifications
            return Notification.objects.filter(recipient=user)
        else:
            # Patients see their own notifications
            return Notification.objects.filter(recipient=user)

    def get_serializer_class(self):
        """Use detailed serializer for individual notifications."""
        if self.action in ['retrieve', 'update', 'partial_update']:
            return NotificationDetailSerializer
        return NotificationSerializer

    def perform_create(self, serializer):
        """Set the recipient when creating notifications."""
        serializer.save(recipient=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        """Mark multiple notifications as read."""
        notification_ids = request.data.get('notification_ids', [])
        if not notification_ids:
            return Response(
                {'error': 'notification_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = NotificationService()
        updated_count = service.mark_notifications_read(
            request.user, notification_ids
        )

        return Response({
            'message': f'Marked {updated_count} notifications as read',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all user's notifications as read."""
        user = request.user
        updated_count = Notification.objects.filter(
            recipient=user,
            status__in=['SENT', 'DELIVERED']
        ).update(
            status=Notification.Status.READ,
            read_at=timezone.now()
        )

        return Response({
            'message': f'Marked {updated_count} notifications as read',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications."""
        user = request.user
        count = Notification.objects.filter(
            recipient=user,
            status__in=['SENT', 'DELIVERED']
        ).count()

        return Response({'unread_count': count})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get notification statistics."""
        service = NotificationService()
        stats = service.get_notification_stats(request.user)

        return Response(stats)

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        """Resend a failed notification."""
        notification = self.get_object()

        # Check permissions
        if notification.recipient != request.user and request.user.role != 'ADMIN':
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        if notification.status != Notification.Status.FAILED:
            return Response(
                {'error': 'Only failed notifications can be resent'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reset notification status and resend
        notification.status = Notification.Status.PENDING
        notification.save()

        service = NotificationService()
        service._send_notification(notification)

        return Response({
            'message': 'Notification queued for resend',
            'notification_id': notification.id
        })


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing notification preferences."""
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Users can only see their own preferences."""
        return NotificationPreference.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create preferences for the current user."""
        obj, created = NotificationPreference.objects.get_or_create(
            user=self.request.user,
            defaults={
                'email_enabled': True,
                'sms_enabled': False,
                'push_enabled': True,
                'in_app_enabled': True,
                'claim_updates_enabled': True,
                'credentialing_updates_enabled': True,
                'payment_updates_enabled': True,
                'system_announcements_enabled': True,
                # Ensure new preference flags default to enabled for better UX
                'member_messages_enabled': True,
                'subscription_reminders_enabled': True,
            }
        )
        return obj

    @action(detail=False, methods=['get'])
    def my_preferences(self, request):
        """Get current user's notification preferences."""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)


class NotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing notification logs."""
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated, IsProviderOrAdmin]
    pagination_class = NotificationPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['action', 'notification__notification_type']

    def get_queryset(self):
        """Filter logs based on user role."""
        user = self.request.user

        if user.role == 'ADMIN':
            # Admins can see all logs
            return NotificationLog.objects.all()
        else:
            # Users see logs for their own notifications
            return NotificationLog.objects.filter(
                notification__recipient=user
            )


class NotificationManagementViewSet(viewsets.ViewSet):
    """ViewSet for notification management operations."""
    permission_classes = [IsAuthenticated, IsProviderOrAdmin]

    @action(detail=False, methods=['post'])
    def send_bulk(self, request):
        """Send bulk notifications to multiple users."""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admins can send bulk notifications'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        required_fields = ['recipient_ids', 'notification_type', 'title', 'message']

        for field in required_fields:
            if field not in data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        recipient_ids = data['recipient_ids']
        recipients = User.objects.filter(id__in=recipient_ids)

        if len(recipients) != len(recipient_ids):
            return Response(
                {'error': 'Some recipient IDs are invalid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = NotificationService()
        notifications = service.send_bulk_notification(
            recipients=list(recipients),
            notification_type=data['notification_type'],
            title=data['title'],
            message=data['message'],
            priority=data.get('priority', 'MEDIUM'),
            metadata=data.get('metadata', {})
        )

        return Response({
            'message': f'Sent {len(notifications)} notifications',
            'notification_count': len(notifications),
            'notification_ids': [n.id for n in notifications]
        })

    @action(detail=False, methods=['post'])
    def send_system_announcement(self, request):
        """Send system-wide announcement."""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admins can send system announcements'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        required_fields = ['title', 'message']

        for field in required_fields:
            if field not in data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        service = NotificationService()
        notifications = service.send_system_announcement(
            title=data['title'],
            message=data['message'],
            target_roles=data.get('target_roles', ['ADMIN', 'PROVIDER', 'PATIENT'])
        )

        return Response({
            'message': f'Sent system announcement to {len(notifications)} users',
            'notification_count': len(notifications)
        })

    @action(detail=False, methods=['post'])
    def process_scheduled(self, request):
        """Process scheduled notifications (admin only)."""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admins can process scheduled notifications'},
                status=status.HTTP_403_FORBIDDEN
            )

        service = NotificationService()
        processed_count = service.process_scheduled_notifications()

        return Response({
            'message': f'Processed {processed_count} scheduled notifications',
            'processed_count': processed_count
        })

    @action(detail=False, methods=['post'])
    def cleanup_old(self, request):
        """Clean up old notifications (admin only)."""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Only admins can cleanup notifications'},
                status=status.HTTP_403_FORBIDDEN
            )

        days_old = request.data.get('days_old', 90)
        service = NotificationService()
        deleted_count = service.cleanup_old_notifications(days_old)

        return Response({
            'message': f'Cleaned up {deleted_count} old notifications',
            'deleted_count': deleted_count
        })


class NotificationDashboardViewSet(viewsets.ViewSet):
    """ViewSet for notification dashboard data."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def dashboard_data(self, request):
        """Get notification dashboard data for the current user."""
        user = request.user

        # Get recent notifications
        recent_notifications = Notification.objects.filter(
            recipient=user
        ).order_by('-created_at')[:10]

        # Get unread count
        unread_count = Notification.objects.filter(
            recipient=user,
            status__in=['SENT', 'DELIVERED']
        ).count()

        # Get notification stats by type
        type_stats = Notification.objects.filter(
            recipient=user
        ).values('notification_type').annotate(
            total=models.Count('id'),
            unread=models.Count('id', filter=models.Q(status__in=['SENT', 'DELIVERED']))
        ).order_by('-total')

        # Get recent activity (last 30 days)
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        recent_activity = Notification.objects.filter(
            recipient=user,
            created_at__gte=thirty_days_ago
        ).values('notification_type').annotate(
            count=models.Count('id')
        ).order_by('-count')

        return Response({
            'recent_notifications': NotificationSerializer(recent_notifications, many=True).data,
            'unread_count': unread_count,
            'type_stats': list(type_stats),
            'recent_activity': list(recent_activity),
            'preferences': NotificationPreferenceSerializer(
                NotificationPreference.objects.filter(user=user).first()
            ).data if NotificationPreference.objects.filter(user=user).exists() else None
        })


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    """Admin-only CRUD for notification templates."""
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated, IsProviderOrAdmin]

    def get_queryset(self):
        qs = NotificationTemplate.objects.all().order_by('-updated_at')
        # Providers should not manage templates; restrict to admins
        if self.request.user.role != 'ADMIN':
            return NotificationTemplate.objects.none()
        # Optional filters
        ntype = self.request.query_params.get('notification_type')
        channel = self.request.query_params.get('channel')
        is_active = self.request.query_params.get('is_active')
        if ntype:
            qs = qs.filter(notification_type=ntype)
        if channel:
            qs = qs.filter(channel=channel)
        if is_active is not None:
            if is_active.lower() in ('true', '1'):
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ('false', '0'):
                qs = qs.filter(is_active=False)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role != 'ADMIN':
            raise PermissionDenied('Only admins can create templates')
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role != 'ADMIN':
            raise PermissionDenied('Only admins can update templates')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'ADMIN':
            raise PermissionDenied('Only admins can delete templates')
        instance.delete()