from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchemeCategoryViewSet, SchemeBenefitViewSet

router = DefaultRouter()
router.register(r'categories', SchemeCategoryViewSet, basename='scheme-category')
router.register(r'benefits', SchemeBenefitViewSet, basename='scheme-benefit')

urlpatterns = [
	path('', include(router.urls)),
]
