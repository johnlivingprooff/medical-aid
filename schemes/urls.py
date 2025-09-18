from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchemeCategoryViewSet, SchemeBenefitViewSet, BenefitTypeViewSet,
    BenefitCategoryViewSet, SubscriptionTierViewSet, MemberSubscriptionViewSet
)

router = DefaultRouter()
router.register(r'categories', SchemeCategoryViewSet, basename='scheme-category')
router.register(r'benefits', SchemeBenefitViewSet, basename='scheme-benefit')
router.register(r'benefit-types', BenefitTypeViewSet, basename='benefit-type')
router.register(r'benefit-categories', BenefitCategoryViewSet, basename='benefit-category')
router.register(r'subscription-tiers', SubscriptionTierViewSet, basename='subscription-tier')
router.register(r'subscriptions', MemberSubscriptionViewSet, basename='member-subscription')

urlpatterns = [
	path('', include(router.urls)),
]
