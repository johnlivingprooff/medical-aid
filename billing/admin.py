"""
Admin interface for billing models
"""

from django.contrib import admin
from .models import PaymentMethod, Invoice, Payment, BillingCycle, BillingSettings


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['id', 'subscription', 'payment_type', 'is_default', 'is_active']
    list_filter = ['payment_type', 'is_default', 'is_active']
    search_fields = ['subscription__patient__user__username', 'card_holder_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'subscription', 'total_amount', 'status', 'due_date', 'is_overdue']
    list_filter = ['status', 'due_date', 'created_at']
    search_fields = ['invoice_number', 'subscription__patient__user__username']
    readonly_fields = ['invoice_number', 'created_at', 'updated_at', 'days_overdue']

    def is_overdue(self, obj):
        return obj.is_overdue
    is_overdue.boolean = True
    is_overdue.short_description = 'Overdue'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['payment_id', 'invoice', 'amount', 'status', 'payment_type', 'processed_at']
    list_filter = ['status', 'payment_type', 'processor', 'processed_at']
    search_fields = ['payment_id', 'processor_transaction_id', 'invoice__invoice_number']
    readonly_fields = ['payment_id', 'created_at', 'updated_at']


@admin.register(BillingCycle)
class BillingCycleAdmin(admin.ModelAdmin):
    list_display = ['id', 'subscription', 'billing_date', 'amount', 'status', 'retry_count']
    list_filter = ['status', 'billing_date', 'created_at']
    search_fields = ['subscription__patient__user__username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(BillingSettings)
class BillingSettingsAdmin(admin.ModelAdmin):
    list_display = ['id', 'currency', 'tax_rate', 'payment_processor', 'billing_day_of_month']
    readonly_fields = ['id']  # Prevent creating multiple settings records

    def has_add_permission(self, request):
        # Only allow one billing settings record
        return not BillingSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Prevent deletion of the settings record
        return False