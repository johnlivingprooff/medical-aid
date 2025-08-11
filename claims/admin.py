from django.contrib import admin
from .models import Patient, Claim, Invoice


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
	list_display = ("user", "scheme", "date_of_birth", "gender")
	search_fields = ("user__username", "scheme__name")


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
	list_display = ("id", "patient", "provider", "service_type", "cost", "status", "coverage_checked", "date_submitted")
	list_filter = ("status", "coverage_checked")
	search_fields = ("patient__user__username", "provider__username", "service_type")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
	list_display = ("claim", "amount", "payment_status", "created_at")
	list_filter = ("payment_status",)

