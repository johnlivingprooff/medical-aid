from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClaimViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'', ClaimViewSet, basename='claim')  # Claims only
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
	path('', include(router.urls)),
]
