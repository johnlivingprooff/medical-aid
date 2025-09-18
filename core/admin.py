from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from django.utils import timezone
from datetime import timedelta
from .models import Alert
from core.tasks import health_check
from .views_monitoring import system_monitoring_dashboard


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("type", "severity", "patient", "is_read", "created_at")
    list_filter = ("type", "severity", "is_read")

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('system-monitoring/', system_monitoring_dashboard, name='system_monitoring_dashboard'),
        ]
        return custom_urls + urls
