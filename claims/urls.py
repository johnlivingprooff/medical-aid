from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClaimViewSet, InvoiceViewSet, PreAuthorizationRequestViewSet, PreAuthorizationApprovalViewSet, PreAuthorizationRuleViewSet, FraudAlertViewSet

router = DefaultRouter()
router.register(r'', ClaimViewSet, basename='claim')  # Claims only
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'preauth-requests', PreAuthorizationRequestViewSet, basename='preauth-request')
router.register(r'preauth-approvals', PreAuthorizationApprovalViewSet, basename='preauth-approval')
router.register(r'preauth-rules', PreAuthorizationRuleViewSet, basename='preauth-rule')
router.register(r'fraud-alerts', FraudAlertViewSet, basename='fraud-alert')

urlpatterns = [
	path('', include(router.urls)),
]
