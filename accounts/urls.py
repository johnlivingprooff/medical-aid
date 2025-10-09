from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterView, MeView, MFAVerifyView, ProviderNetworkMembershipViewSet, CredentialingDocumentViewSet
from .views_credentialing import (
    CredentialingRuleViewSet, CredentialingReviewViewSet,
    CredentialingTemplateViewSet, DocumentExpiryAlertViewSet,
    CredentialingDashboardView, CredentialingWorkflowView
)
from .views_mfa import MFAViewSet
from .views_sessions import UserSessionViewSet, SessionSettingsViewSet, UserSessionStatsView
from . import urls_notifications

# Create router for MFA endpoints
router = DefaultRouter()
router.register(r'mfa', MFAViewSet, basename='mfa')
router.register(r'sessions', UserSessionViewSet, basename='user-session')
router.register(r'session-settings', SessionSettingsViewSet, basename='session-settings')
router.register(r'provider-network', ProviderNetworkMembershipViewSet, basename='provider-network')
router.register(r'provider-credentialing-docs', CredentialingDocumentViewSet, basename='provider-credentialing-doc')
router.register(r'credentialing-rules', CredentialingRuleViewSet, basename='credentialing-rule')
router.register(r'credentialing-reviews', CredentialingReviewViewSet, basename='credentialing-review')
router.register(r'credentialing-templates', CredentialingTemplateViewSet, basename='credentialing-template')
router.register(r'expiry-alerts', DocumentExpiryAlertViewSet, basename='expiry-alert')

from .views import UserSettingsView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),
    path('mfa/verify/', MFAVerifyView.as_view(), name='mfa_verify'),
    path('sessions/stats/', UserSessionStatsView.as_view(), name='session_stats'),
    path('credentialing/dashboard/', CredentialingDashboardView.as_view(), name='credentialing-dashboard'),
    path('credentialing/workflow/', CredentialingWorkflowView.as_view(), name='credentialing-workflow'),
    path('notifications/', include(urls_notifications)),
    path('', include(router.urls)),
]
