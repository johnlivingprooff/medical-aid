"""
Views for billing API endpoints
"""

from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal

from .models import PaymentMethod, Invoice, Payment, BillingCycle, BillingSettings
from .serializers import (
    PaymentMethodSerializer, InvoiceSerializer, PaymentSerializer,
    BillingCycleSerializer, BillingSettingsSerializer
)
from schemes.models import MemberSubscription
from core.permissions import IsAdminOrProvider, IsOwnerOrAdmin


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payment methods"""

    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return PaymentMethod.objects.all()
        # For patients, only show their own payment methods
        return PaymentMethod.objects.filter(
            subscription__patient__user=user
        )

    def perform_create(self, serializer):
        # Ensure the subscription belongs to the current user (if not admin)
        subscription = serializer.validated_data['subscription']
        if (self.request.user.role != 'ADMIN' and
            subscription.patient.user != self.request.user):
            raise serializers.ValidationError("You can only add payment methods to your own subscriptions")
        serializer.save()

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this payment method as the default for the subscription"""
        payment_method = self.get_object()

        # Remove default from other payment methods for this subscription
        PaymentMethod.objects.filter(
            subscription=payment_method.subscription,
            is_default=True
        ).update(is_default=False)

        # Set this one as default
        payment_method.is_default = True
        payment_method.save()

        serializer = self.get_serializer(payment_method)
        return Response(serializer.data)


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing invoices"""

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Invoice.objects.all()
        # For patients, only show their own invoices
        return Invoice.objects.filter(
            subscription__patient__user=user
        )

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark an invoice as paid"""
        invoice = self.get_object()

        if invoice.status == Invoice.InvoiceStatus.PAID:
            return Response(
                {'error': 'Invoice is already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        invoice.status = Invoice.InvoiceStatus.PAID
        invoice.payment_date = timezone.now()
        invoice.save()

        serializer = self.get_serializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_reminder(self, request, pk=None):
        """Send a payment reminder for overdue invoices"""
        invoice = self.get_object()

        if not invoice.is_overdue:
            return Response(
                {'error': 'Invoice is not overdue'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Here you would integrate with your notification system
        # For now, just return success
        return Response({'message': 'Reminder sent successfully'})


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payments"""

    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    queryset = Payment.objects.all()

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Payment.objects.all()
        # For patients, only show their own payments
        return Payment.objects.filter(
            invoice__subscription__patient__user=user
        )


class BillingCycleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing billing cycles"""

    serializer_class = BillingCycleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrProvider]
    queryset = BillingCycle.objects.all()

    @action(detail=True, methods=['post'])
    def retry_payment(self, request, pk=None):
        """Retry payment for a failed billing cycle"""
        billing_cycle = self.get_object()

        if billing_cycle.status != BillingCycle.CycleStatus.FAILED:
            return Response(
                {'error': 'Can only retry failed billing cycles'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if billing_cycle.retry_count >= billing_cycle.max_retries:
            return Response(
                {'error': 'Maximum retry attempts exceeded'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Here you would implement the actual payment retry logic
        # For now, just increment retry count
        billing_cycle.retry_count += 1
        billing_cycle.next_retry_date = timezone.now().date() + timezone.timedelta(days=3)
        billing_cycle.save()

        serializer = self.get_serializer(billing_cycle)
        return Response(serializer.data)


class BillingSettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for managing billing settings"""

    serializer_class = BillingSettingsSerializer
    permission_classes = [IsAuthenticated, IsAdminOrProvider]
    queryset = BillingSettings.objects.all()

    def get_queryset(self):
        # There should only be one billing settings record
        return BillingSettings.objects.all()[:1]

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current billing settings"""
        settings = BillingSettings.objects.first()
        if not settings:
            # Create default settings if none exist
            settings = BillingSettings.objects.create()

        serializer = self.get_serializer(settings)
        return Response(serializer.data)


# Import here to avoid circular imports
from schemes.models import MemberSubscription