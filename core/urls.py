from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthCheckView, SystemSettingsViewSet, system_setting_keys
from .views_dashboard import DashboardStatsView, ActivityFeedView
from .views_providers import ProvidersAnalyticsView, ProviderDetailAnalyticsView
from .views_schemes import SchemesOverviewView
from .views_members import MembersAnalyticsView
from .views_alerts_reports import AlertsListView, SchemeUsageReportView, DiseaseStatsReportView, DetailedClaimsReportView
from .views_admin import AdminStatsView, AdminActionsView
from .views_search import GlobalSearchView
from .views_edi import (
    EDISubmitView,
    EDITransactionDetailView,
    EDIProviderTransactionsView,
    EDIStatusUpdateView
)
from .views_providers_directory import (
    ProviderDirectoryView,
    ProviderDetailView,
    ProviderDirectoryStatsView,
    ProviderNetworkStatusView
)
from .views_provider_network_status import (
    ProviderNetworkStatusView as NetworkStatusView,
    ProviderNetworkDashboardView
)

# Create router for system settings
router = DefaultRouter()
router.register(r'settings', SystemSettingsViewSet, basename='system-settings')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health'),
    path('alerts/', AlertsListView.as_view(), name='alerts'),
    path('reports/scheme-usage/', SchemeUsageReportView.as_view(), name='report-scheme-usage'),
    path('reports/disease-stats/', DiseaseStatsReportView.as_view(), name='report-disease-stats'),
    path('reports/detailed-claims/', DetailedClaimsReportView.as_view(), name='report-detailed-claims'),
    # Dashboard endpoints
    path('settings/keys/', system_setting_keys, name='system-setting-keys'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/activity/', ActivityFeedView.as_view(), name='dashboard-activity'),
    # Provider analytics
    path('analytics/providers/', ProvidersAnalyticsView.as_view(), name='providers-analytics'),
    path('analytics/providers/<int:provider_id>/', ProviderDetailAnalyticsView.as_view(), name='provider-analytics-detail'),
    # Schemes overview
    path('analytics/schemes/overview/', SchemesOverviewView.as_view(), name='schemes-overview'),
    # Members analytics
    path('analytics/members/', MembersAnalyticsView.as_view(), name='members-analytics'),
    # Admin endpoints
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/actions/', AdminActionsView.as_view(), name='admin-actions'),
    # Search endpoint
    path('search/', GlobalSearchView.as_view(), name='global-search'),
    # EDI endpoints
    path('edi/submit/', EDISubmitView.as_view(), name='edi-submit'),
    path('edi/transactions/<str:transaction_id>/', EDITransactionDetailView.as_view(), name='edi-transaction-detail'),
    path('edi/transactions/', EDIProviderTransactionsView.as_view(), name='edi-provider-transactions'),
    path('edi/transactions/<str:transaction_id>/status/', EDIStatusUpdateView.as_view(), name='edi-status-update'),
    # Provider directory endpoints
    path('providers/directory/', ProviderDirectoryView.as_view(), name='provider-directory'),
    path('providers/directory/stats/', ProviderDirectoryStatsView.as_view(), name='provider-directory-stats'),
    path('providers/<str:username>/', ProviderDetailView.as_view(), name='provider-detail'),
    path('providers/<str:username>/network-status/', ProviderNetworkStatusView.as_view(), name='provider-network-status'),
    # Provider network status endpoints
    path('providers/network/status/', NetworkStatusView.as_view(), name='provider-network-status-monitoring'),
    path('providers/network/dashboard/', ProviderNetworkDashboardView.as_view(), name='provider-network-dashboard'),
    # System settings
    path('', include(router.urls)),
]
