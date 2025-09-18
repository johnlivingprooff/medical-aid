"""
Test script for notification system functionality.
"""

import os
import sys
import django
from datetime import datetime, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.test import TestCase

from accounts.models_notifications import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationLog, NotificationType, NotificationChannel
)
from accounts.notification_service import NotificationService
from claims.models import Claim
from accounts.models import ProviderNetworkMembership

User = get_user_model()


def test_notification_creation():
    """Test basic notification creation."""
    print("Testing notification creation...")

    # Get or create a test user
    user, created = User.objects.get_or_create(
        username='test_provider',
        defaults={
            'email': 'test@provider.com',
            'role': 'PROVIDER',
            'first_name': 'Test',
            'last_name': 'Provider'
        }
    )

    service = NotificationService()

    # Create a notification
    notification = service.create_notification(
        recipient=user,
        notification_type=NotificationType.CLAIM_STATUS_UPDATE,
        title='Test Claim Update',
        message='Your claim has been updated to APPROVED status.',
        priority='HIGH',
        metadata={'test': True}
    )

    if notification:
        print(f"✅ Created notification: {notification.title}")
        print(f"   Status: {notification.status}")
        print(f"   Channel: {notification.channel}")
        return notification
    else:
        print("❌ Failed to create notification")
        return None


def test_bulk_notifications():
    """Test bulk notification sending."""
    print("\nTesting bulk notifications...")

    # Create test users
    users = []
    for i in range(3):
        user, created = User.objects.get_or_create(
            username=f'bulk_test_user_{i}',
            defaults={
                'email': f'bulk{i}@test.com',
                'role': 'PROVIDER',
                'first_name': f'Bulk{i}',
                'last_name': 'Test'
            }
        )
        users.append(user)

    service = NotificationService()

    # Send bulk notification
    notifications = service.send_bulk_notification(
        recipients=users,
        notification_type=NotificationType.SYSTEM_MAINTENANCE,
        title='System Maintenance Notice',
        message='The system will be undergoing maintenance tonight.',
        priority='MEDIUM'
    )

    print(f"✅ Sent {len(notifications)} bulk notifications")
    return notifications


def test_notification_preferences():
    """Test notification preferences."""
    print("\nTesting notification preferences...")

    user, created = User.objects.get_or_create(
        username='pref_test_user',
        defaults={
            'email': 'pref@test.com',
            'role': 'PROVIDER',
            'first_name': 'Pref',
            'last_name': 'Test'
        }
    )

    # Get preferences
    service = NotificationService()
    preferences = service._get_user_preferences(user)

    print(f"✅ User preferences: Email={preferences.email_enabled}, Push={preferences.push_enabled}")

    # Test preference-based filtering
    notification = service.create_notification(
        recipient=user,
        notification_type=NotificationType.CLAIM_STATUS_UPDATE,
        title='Preference Test',
        message='This should respect user preferences.',
        priority='MEDIUM'
    )

    if notification:
        print(f"✅ Preference-based notification created: {notification.channel}")
    else:
        print("❌ Notification blocked by preferences")

    return preferences


def test_notification_stats():
    """Test notification statistics."""
    print("\nTesting notification statistics...")

    user, created = User.objects.get_or_create(
        username='stats_test_user',
        defaults={
            'email': 'stats@test.com',
            'role': 'PROVIDER',
            'first_name': 'Stats',
            'last_name': 'Test'
        }
    )

    service = NotificationService()

    # Create some test notifications
    for i in range(5):
        service.create_notification(
            recipient=user,
            notification_type=NotificationType.CLAIM_STATUS_UPDATE,
            title=f'Test Notification {i}',
            message=f'This is test notification {i}',
            priority='MEDIUM'
        )

    # Get stats
    stats = service.get_notification_stats(user)

    print(f"✅ Notification stats: Total={stats['total']}, Unread={stats['unread']}")
    print(f"   By type: {stats['by_type']}")

    return stats


def test_claim_status_notification():
    """Test claim status update notifications."""
    print("\nTesting claim status notifications...")

    # Get a provider and create a test claim
    provider = User.objects.filter(role='PROVIDER').first()
    if not provider:
        provider, created = User.objects.get_or_create(
            username='claim_test_provider',
            defaults={
                'email': 'claim@test.com',
                'role': 'PROVIDER',
                'first_name': 'Claim',
                'last_name': 'Test'
            }
        )

    # Create a test claim (simplified)
    try:
        from claims.models import Claim, Patient
        from schemes.models import Scheme

        patient = Patient.objects.first()
        scheme = Scheme.objects.first()

        if patient and scheme:
            claim = Claim.objects.create(
                patient=patient,
                provider=provider,
                scheme=scheme,
                service_type='CONSULTATION',
                cost=1500.00,
                date_of_service=timezone.now().date(),
                status='PENDING'
            )

            service = NotificationService()

            # Test status update notification
            notification = service.notify_claim_status_update(
                claim, 'PENDING', 'APPROVED'
            )

            if notification:
                print(f"✅ Claim status notification created: {notification.title}")
                print(f"   Message: {notification.message[:50]}...")
            else:
                print("❌ Failed to create claim status notification")

            return notification
        else:
            print("❌ Missing patient or scheme data for claim test")
            return None

    except Exception as e:
        print(f"❌ Error creating claim notification: {str(e)}")
        return None


def test_credentialing_notification():
    """Test credentialing update notifications."""
    print("\nTesting credentialing notifications...")

    try:
        from accounts.models import ProviderNetworkMembership
        from schemes.models import Scheme

        provider = User.objects.filter(role='PROVIDER').first()
        scheme = Scheme.objects.first()

        if provider and scheme:
            membership, created = ProviderNetworkMembership.objects.get_or_create(
                provider=provider,
                scheme=scheme,
                defaults={
                    'status': 'PENDING',
                    'effective_from': timezone.now().date()
                }
            )

            service = NotificationService()

            # Test credentialing update notification
            notification = service.notify_credentialing_update(
                membership, 'PENDING', 'APPROVED'
            )

            if notification:
                print(f"✅ Credentialing notification created: {notification.title}")
                print(f"   Message: {notification.message[:50]}...")
            else:
                print("❌ Failed to create credentialing notification")

            return notification
        else:
            print("❌ Missing provider or scheme data for credentialing test")
            return None

    except Exception as e:
        print(f"❌ Error creating credentialing notification: {str(e)}")
        return None


def test_system_announcement():
    """Test system announcement notifications."""
    print("\nTesting system announcements...")

    service = NotificationService()

    # Send system announcement
    notifications = service.send_system_announcement(
        title='Test System Maintenance',
        message='The system will be down for maintenance from 2 AM to 4 AM.',
        target_roles=['PROVIDER', 'ADMIN']
    )

    print(f"✅ Sent system announcement to {len(notifications)} users")
    return notifications


def test_notification_marking():
    """Test marking notifications as read."""
    print("\nTesting notification marking...")

    user, created = User.objects.get_or_create(
        username='mark_test_user',
        defaults={
            'email': 'mark@test.com',
            'role': 'PROVIDER',
            'first_name': 'Mark',
            'last_name': 'Test'
        }
    )

    service = NotificationService()

    # Create some notifications
    notifications = []
    for i in range(3):
        notification = service.create_notification(
            recipient=user,
            notification_type=NotificationType.CLAIM_STATUS_UPDATE,
            title=f'Mark Test {i}',
            message=f'Test message {i}',
            priority='MEDIUM'
        )
        if notification:
            notifications.append(notification)

    if notifications:
        # Mark some as read
        notification_ids = [n.id for n in notifications[:2]]
        updated_count = service.mark_notifications_read(user, notification_ids)

        print(f"✅ Marked {updated_count} notifications as read")

        # Check unread count
        unread_count = service.get_user_notifications(user, status='SENT')
        print(f"   Remaining unread: {len(unread_count)}")

    return notifications


def run_all_tests():
    """Run all notification tests."""
    print("🚀 Starting Notification System Tests")
    print("=" * 50)

    test_results = []

    # Run individual tests
    test_results.append(("Notification Creation", test_notification_creation()))
    test_results.append(("Bulk Notifications", test_bulk_notifications()))
    test_results.append(("Preferences", test_notification_preferences()))
    test_results.append(("Statistics", test_notification_stats()))
    test_results.append(("Claim Notifications", test_claim_status_notification()))
    test_results.append(("Credentialing Notifications", test_credentialing_notification()))
    test_results.append(("System Announcements", test_system_announcement()))
    test_results.append(("Marking Notifications", test_notification_marking()))

    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")

    passed = 0
    failed = 0

    for test_name, result in test_results:
        if result is not None and result != []:
            print(f"✅ {test_name}: PASSED")
            passed += 1
        else:
            print(f"❌ {test_name}: FAILED")
            failed += 1

    print(f"\nTotal Tests: {len(test_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")

    if failed == 0:
        print("\n🎉 All tests passed! Notification system is working correctly.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please check the implementation.")

    return passed, failed


if __name__ == '__main__':
    try:
        passed, failed = run_all_tests()
        sys.exit(0 if failed == 0 else 1)
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)