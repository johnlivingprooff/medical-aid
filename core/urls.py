from django.urls import path
from .views import HealthCheckView
from .views_dashboard import DashboardStatsView, ActivityFeedView
from .views_providers import ProvidersAnalyticsView, ProviderDetailAnalyticsView
from .views_alerts_reports import AlertsListView, SchemeUsageReportView, DiseaseStatsReportView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health'),
    path('alerts/', AlertsListView.as_view(), name='alerts'),
    path('reports/scheme-usage/', SchemeUsageReportView.as_view(), name='report-scheme-usage'),
    path('reports/disease-stats/', DiseaseStatsReportView.as_view(), name='report-disease-stats'),
    # Dashboard endpoints
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/activity/', ActivityFeedView.as_view(), name='dashboard-activity'),
    # Provider analytics
    path('analytics/providers/', ProvidersAnalyticsView.as_view(), name='providers-analytics'),
    path('analytics/providers/<int:provider_id>/', ProviderDetailAnalyticsView.as_view(), name='provider-analytics-detail'),
]
