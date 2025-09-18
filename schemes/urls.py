from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchemeCategoryViewSet, SchemeBenefitViewSet, BenefitTypeViewSet,
    BenefitCategoryViewSet, SubscriptionTierViewSet, MemberSubscriptionViewSet,
    PaymentMethodViewSet, InvoiceViewSet, PaymentViewSet, BillingHistoryViewSet,
    BillingManagementViewSet
)

router = DefaultRouter()
router.register(r'categories', SchemeCategoryViewSet, basename='scheme-category')
router.register(r'benefits', SchemeBenefitViewSet, basename='scheme-benefit')
router.register(r'benefit-types', BenefitTypeViewSet, basename='benefit-type')
router.register(r'benefit-categories', BenefitCategoryViewSet, basename='benefit-category')
router.register(r'subscription-tiers', SubscriptionTierViewSet, basename='subscription-tier')
router.register(r'subscriptions', MemberSubscriptionViewSet, basename='member-subscription')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'billing-history', BillingHistoryViewSet, basename='billing-history')

urlpatterns = [
	path('', include(router.urls)),
    path('billing/', BillingManagementViewSet.as_view({
        'get': 'summary',
        'post': 'process_payment'
    }), name='billing-management'),
]
