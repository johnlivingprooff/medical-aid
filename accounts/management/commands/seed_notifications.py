"""
Management command to seed notification data for testing.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import random

from accounts.models_notifications import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationType, NotificationChannel, NotificationStatus
)
from accounts.notification_service import NotificationService

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed notification data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=50,
            help='Number of notifications to create'
        )
        parser.add_argument(
            '--users',
            type=int,
            default=10,
            help='Number of users to create notifications for'
        )

    def handle(self, *args, **options):
        self.stdout.write('Seeding notification data...')

        # Create notification templates
        self.create_templates()

        # Create notification preferences for existing users
        self.create_preferences()

        # Create sample notifications
        self.create_notifications(options['count'], options['users'])

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded notification data')
        )

    def create_templates(self):
        """Create notification templates."""
        templates_data = [
            {
                'name': 'Claim Status Update',
                'notification_type': NotificationType.CLAIM_STATUS_UPDATE,
                'subject_template': 'Claim {{ claim_number }} Status Update',
                'message_template': '''
Your claim {{ claim_number }} has been updated.

Status: {{ new_status }}
Amount: R{{ amount }}
Service Date: {{ service_date }}

Please check your dashboard for more details.
                ''',
                'variables': ['claim_number', 'new_status', 'amount', 'service_date']
            },
            {
                'name': 'Credentialing Update',
                'notification_type': NotificationType.CREDENTIALING_UPDATE,
                'subject_template': 'Credentialing Status Update - {{ scheme_name }}',
                'message_template': '''
Your credentialing status for {{ scheme_name }} has been updated to {{ new_status }}.

Effective From: {{ effective_from }}

{{ message }}
                ''',
                'variables': ['scheme_name', 'new_status', 'effective_from', 'message']
            },
            {
                'name': 'Membership Expiring',
                'notification_type': NotificationType.MEMBERSHIP_EXPIRING,
                'subject_template': 'Membership Expiring Soon - {{ scheme_name }}',
                'message_template': '''
Your membership with {{ scheme_name }} is expiring in {{ days_until_expiry }} days.

Expiry Date: {{ expiry_date }}

Please renew your membership to continue providing services.
                ''',
                'variables': ['scheme_name', 'days_until_expiry', 'expiry_date']
            },
            {
                'name': 'System Maintenance',
                'notification_type': NotificationType.SYSTEM_MAINTENANCE,
                'subject_template': 'System Maintenance Notification',
                'message_template': '''
{{ message }}

Scheduled for: {{ maintenance_time }}
Expected downtime: {{ downtime }}

We apologize for any inconvenience.
                ''',
                'variables': ['message', 'maintenance_time', 'downtime']
            }
        ]

        admin_user = User.objects.filter(role='ADMIN').first()
        if not admin_user:
            admin_user = User.objects.create_user(
                username='admin',
                email='admin@medicalaid.com',
                password='admin123',
                role='ADMIN',
                first_name='System',
                last_name='Administrator'
            )

        for template_data in templates_data:
            template, created = NotificationTemplate.objects.get_or_create(
                name=template_data['name'],
                defaults={
                    'notification_type': template_data['notification_type'],
                    'subject_template': template_data['subject_template'].strip(),
                    'message_template': template_data['message_template'].strip(),
                    'variables': template_data['variables'],
                    'is_active': True,
                    'created_by': admin_user
                }
            )
            if created:
                self.stdout.write(f'Created template: {template.name}')

    def create_preferences(self):
        """Create notification preferences for users."""
        users = User.objects.all()

        for user in users:
            preference, created = NotificationPreference.objects.get_or_create(
                user=user,
                defaults={
                    'email_enabled': True,
                    'sms_enabled': False,
                    'push_enabled': True,
                    'in_app_enabled': True,
                    'claim_updates_enabled': True,
                    'credentialing_updates_enabled': True,
                    'payment_updates_enabled': True,
                    'system_announcements_enabled': True,
                }
            )
            if created:
                self.stdout.write(f'Created preferences for: {user.username}')

    def create_notifications(self, count, user_count):
        """Create sample notifications."""
        users = list(User.objects.all()[:user_count])
        if not users:
            self.stdout.write('No users found. Creating sample users...')
            for i in range(user_count):
                user = User.objects.create_user(
                    username=f'user{i}',
                    email=f'user{i}@example.com',
                    password='password123',
                    role=random.choice(['PROVIDER', 'PATIENT']),
                    first_name=f'User{i}',
                    last_name='Test'
                )
                users.append(user)

        notification_types = [
            NotificationType.CLAIM_STATUS_UPDATE,
            NotificationType.CREDENTIALING_UPDATE,
            NotificationType.MEMBERSHIP_EXPIRING,
            NotificationType.DOCUMENT_REVIEWED,
            NotificationType.SYSTEM_MAINTENANCE
        ]

        channels = [
            NotificationChannel.EMAIL,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ]

        statuses = [
            NotificationStatus.SENT,
            NotificationStatus.DELIVERED,
            NotificationStatus.READ,
            NotificationStatus.FAILED
        ]

        priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

        sample_titles = [
            'Claim Status Updated',
            'Credentialing Review Complete',
            'Membership Renewal Reminder',
            'Document Review Complete',
            'System Maintenance Scheduled',
            'Payment Processed',
            'New Message Received'
        ]

        sample_messages = [
            'Your claim has been processed successfully.',
            'Your credentialing documents have been reviewed.',
            'Your membership is expiring soon. Please renew.',
            'Your submitted document has been reviewed.',
            'System maintenance is scheduled for tonight.',
            'Payment has been processed for your recent claim.',
            'You have received a new message from the system.'
        ]

        service = NotificationService()

        for i in range(count):
            user = random.choice(users)
            notification_type = random.choice(notification_types)
            channel = random.choice(channels)
            status = random.choice(statuses)
            priority = random.choice(priorities)

            # Create notification with random data
            created_at = timezone.now() - timedelta(days=random.randint(0, 30))

            notification = Notification.objects.create(
                recipient=user,
                notification_type=notification_type,
                title=random.choice(sample_titles),
                message=random.choice(sample_messages),
                channel=channel,
                priority=priority,
                status=status,
                metadata={
                    'sample_data': True,
                    'created_by_seeder': True
                },
                created_at=created_at,
                updated_at=created_at
            )

            # Set sent_at and read_at based on status
            if status in [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ]:
                notification.sent_at = created_at + timedelta(minutes=random.randint(1, 60))

            if status == NotificationStatus.READ:
                notification.read_at = notification.sent_at + timedelta(minutes=random.randint(1, 1440))

            notification.save()

            if i % 10 == 0:
                self.stdout.write(f'Created {i+1}/{count} notifications')

        self.stdout.write(f'Successfully created {count} sample notifications')