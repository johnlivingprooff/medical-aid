from django.contrib import admin
from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
	list_display = ("type", "severity", "patient", "is_read", "created_at")
	list_filter = ("type", "severity", "is_read")
