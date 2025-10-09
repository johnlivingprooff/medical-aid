from .models import SettingKey
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from .models import SystemSettings, SettingKey
from .serializers import SystemSettingsSerializer
from backend.pagination import OptimizedPagination


class HealthCheckView(APIView):
	permission_classes = [AllowAny]

	@extend_schema(responses={200: OpenApiResponse(description='Service health status')})
	@method_decorator(cache_page(60))  # Cache for 1 minute (health checks are frequent)
	def get(self, request):
		return Response({"status": "ok"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_setting_keys(request):
	"""Return allowed system setting keys and their labels for frontend validation"""
	keys = [{'key': k[0], 'label': k[1]} for k in SettingKey.choices]
	return Response({'keys': keys})


class SystemSettingsViewSet(viewsets.ModelViewSet):
	"""ViewSet for managing system settings"""
	queryset = SystemSettings.objects.all()
	serializer_class = SystemSettingsSerializer
	permission_classes = [IsAuthenticated]
	pagination_class = OptimizedPagination

	@method_decorator(cache_page(600))  # Cache for 10 minutes (settings change less frequently)
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@method_decorator(cache_page(600))  # Cache for 10 minutes
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)
	
	def get_queryset(self):
		"""Filter settings based on user permissions"""
		user = self.request.user
		if user.role in ['ADMIN']:
			return SystemSettings.objects.all()
		# Non-admin users can only view certain settings
		return SystemSettings.objects.filter(key__in=[
			'PREAUTH_THRESHOLD', 'AUTO_APPROVAL_ENABLED'
		])
	
	def perform_create(self, serializer):
		"""Set the user who created/updated the setting"""
		serializer.save(updated_by=self.request.user)
	
	def perform_update(self, serializer):
		"""Set the user who updated the setting"""
		serializer.save(updated_by=self.request.user)
	
	@action(detail=False, methods=['get'])
	def get_setting(self, request):
		"""Get a specific setting by key"""
		key = request.query_params.get('key')
		if not key:
			return Response(
				{"error": "key parameter is required"}, 
				status=status.HTTP_400_BAD_REQUEST
			)
		
		try:
			setting = SystemSettings.objects.get(key=key)
			serializer = self.get_serializer(setting)
			return Response(serializer.data)
		except SystemSettings.DoesNotExist:
			return Response(
				{"error": f"Setting '{key}' not found"}, 
				status=status.HTTP_404_NOT_FOUND
			)
	
	@action(detail=False, methods=['post'])
	def bulk_update(self, request):
		"""Bulk update multiple settings"""
		settings_data = request.data
		if not isinstance(settings_data, list):
			return Response(
				{"error": "Expected a list of settings"}, 
				status=status.HTTP_400_BAD_REQUEST
			)
		
		updated_settings = []
		errors = []
		
		for setting_data in settings_data:
			try:
				setting = SystemSettings.objects.get(key=setting_data['key'])
				serializer = self.get_serializer(setting, data=setting_data, partial=True)
				if serializer.is_valid():
					serializer.save(updated_by=request.user)
					updated_settings.append(serializer.data)
				else:
					errors.append({
						'key': setting_data['key'],
						'errors': serializer.errors
					})
			except SystemSettings.DoesNotExist:
				# Create new setting
				serializer = self.get_serializer(data=setting_data)
				if serializer.is_valid():
					serializer.save(updated_by=request.user)
					updated_settings.append(serializer.data)
				else:
					errors.append({
						'key': setting_data.get('key', 'unknown'),
						'errors': serializer.errors
					})
		
		return Response({
			'updated': updated_settings,
			'errors': errors
		})

