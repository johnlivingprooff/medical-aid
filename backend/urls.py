"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import CustomTokenObtainPairView
from core.views_alerts_reports import AlertsListView, SchemeUsageReportView, DiseaseStatsReportView

urlpatterns = [
    path('admin/', admin.site.urls),
    # OpenAPI schema and docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Auth endpoints
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # App endpoints
    path('api/accounts/', include('accounts.urls')),
    path('api/schemes/', include('schemes.urls')),
    path('api/claims/', include('claims.urls')),
    path('api/patients/', include('claims.urls_patients')),
    path('api/invoices/', include('claims.urls_invoices')),
    path('api/core/', include('core.urls')),
    # Root-level reports and alerts
    path('api/alerts/', AlertsListView.as_view(), name='alerts-root'),
    path('api/reports/scheme-usage/', SchemeUsageReportView.as_view(), name='report-scheme-usage-root'),
    path('api/reports/disease-stats/', DiseaseStatsReportView.as_view(), name='report-disease-stats-root'),
]
