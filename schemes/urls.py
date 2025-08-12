from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchemeCategoryViewSet, SchemeBenefitViewSet, BenefitTypeViewSet

router = DefaultRouter()
router.register(r'categories', SchemeCategoryViewSet, basename='scheme-category')
router.register(r'benefits', SchemeBenefitViewSet, basename='scheme-benefit')
router.register(r'benefit-types', BenefitTypeViewSet, basename='benefit-type')

urlpatterns = [
	path('', include(router.urls)),
]
