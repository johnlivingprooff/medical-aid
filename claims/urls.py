from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet, ClaimViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'', ClaimViewSet, basename='claim')
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
	path('', include(router.urls)),
]
