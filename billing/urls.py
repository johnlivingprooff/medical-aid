"""
URL patterns for billing app
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'payment-methods', views.PaymentMethodViewSet)
router.register(r'invoices', views.InvoiceViewSet)
router.register(r'payments', views.PaymentViewSet)
router.register(r'billing-cycles', views.BillingCycleViewSet)
router.register(r'settings', views.BillingSettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
]