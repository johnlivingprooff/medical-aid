from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from django_otp import match_token

from .serializers import RegisterSerializer, UserSerializer, ProviderNetworkMembershipSerializer, CredentialingDocumentSerializer
from rest_framework import viewsets, status
from rest_framework.decorators import action
from .models import ProviderNetworkMembership, CredentialingDocument
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework import permissions

User = get_user_model()


class IsAdmin(permissions.BasePermission):
	def has_permission(self, request, view):
		return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class RegisterView(generics.CreateAPIView):
	serializer_class = RegisterSerializer
	permission_classes = [permissions.AllowAny]


class MeView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	@extend_schema(responses=UserSerializer)
	def get(self, request):
		return Response(UserSerializer(request.user).data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
	@classmethod
	def get_token(cls, user):
		token = super().get_token(user)
		token['role'] = user.role
		token['username'] = user.username
		return token

	def validate(self, attrs):
		data = super().validate(attrs)
		user = self.user

		# Check if MFA is required for this user
		if user.is_mfa_required and not user.mfa_enabled:
			data['mfa_required'] = True
			data['mfa_setup_required'] = True
			# Don't return tokens if MFA setup is required
			return data

		# If MFA is enabled, check if token was provided
		if user.mfa_enabled:
			mfa_token = attrs.get('mfa_token')
			if not mfa_token:
				data['mfa_required'] = True
				data['mfa_token_required'] = True
				# Don't return tokens if MFA token is required
				return data

			# Verify MFA token
			device = match_token(user, mfa_token)
			if not device:
				# Check backup codes
				if mfa_token in user.backup_codes:
					user.backup_codes.remove(mfa_token)
					user.save()
				else:
					from rest_framework import serializers
					raise serializers.ValidationError({
						'mfa_token': 'Invalid MFA token or backup code'
					})

		data['user'] = UserSerializer(self.user).data
		return data


class CustomTokenObtainPairView(TokenObtainPairView):
	serializer_class = CustomTokenObtainPairSerializer
	permission_classes = [permissions.AllowAny]

	def post(self, request, *args, **kwargs):
		# Allow mfa_token in the request data
		if hasattr(request.data, '_mutable'):
			request.data._mutable = True
		return super().post(request, *args, **kwargs)


class MFAVerifyView(APIView):
	"""Endpoint for MFA verification after initial login."""
	permission_classes = [permissions.AllowAny]

	@extend_schema(request={
		'application/json': {
			'type': 'object',
			'properties': {
				'username': {'type': 'string'},
				'mfa_token': {'type': 'string', 'description': '6-digit TOTP token or backup code'}
			},
			'required': ['username', 'mfa_token']
		}
	})
	def post(self, request):
		username = request.data.get('username')
		mfa_token = request.data.get('mfa_token')

		if not username or not mfa_token:
			return Response(
				{'error': 'Username and MFA token are required'},
				status=400
			)

		try:
			user = User.objects.get(username=username)
		except User.DoesNotExist:
			return Response(
				{'error': 'User not found'},
				status=404
			)

		# Verify MFA token
		device = match_token(user, mfa_token)
		if device:
			# Generate tokens
			from rest_framework_simplejwt.tokens import RefreshToken
			refresh = RefreshToken.for_user(user)
			refresh['role'] = user.role
			refresh['username'] = user.username

			return Response({
				'access': str(refresh.access_token),
				'refresh': str(refresh),
				'user': UserSerializer(user).data
			})
		else:
			# Check backup codes
			if mfa_token in user.backup_codes:
				user.backup_codes.remove(mfa_token)
				user.save()

				# Generate tokens
				from rest_framework_simplejwt.tokens import RefreshToken
				refresh = RefreshToken.for_user(user)
				refresh['role'] = user.role
				refresh['username'] = user.username

				return Response({
					'access': str(refresh.access_token),
					'refresh': str(refresh),
					'user': UserSerializer(user).data
				})
			else:
				return Response(
					{'error': 'Invalid MFA token or backup code'},
					status=400
				)

	def post(self, request, *args, **kwargs):
		# Accept username, email, or login; trim whitespace
		data = request.data.copy()
		username = (data.get('username') or '').strip()
		password = data.get('password')
		if not username:
			login_val = (data.get('login') or data.get('email') or '').strip()
			if login_val:
				# If email matches a user, map to that username; otherwise try as username
				try:
					user_obj = User.objects.get(email__iexact=login_val)
					username = user_obj.username
				except User.DoesNotExist:
					username = login_val
		payload = {'username': username, 'password': password}
		serializer = self.get_serializer(data=payload)
		try:
			serializer.is_valid(raise_exception=True)
		except Exception as exc:
			# Return a concise message and which keys were received; avoid exposing secrets
			detail = getattr(getattr(exc, 'detail', None), 'detail', None) or getattr(exc, 'detail', None) or 'Bad Request'
			return Response({'detail': str(detail), 'received_keys': list(request.data.keys())}, status=400)
		return Response(serializer.validated_data, status=200)


class ProviderNetworkMembershipViewSet(viewsets.ModelViewSet):
	queryset = ProviderNetworkMembership.objects.select_related('provider', 'scheme').all()
	serializer_class = ProviderNetworkMembershipSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['provider', 'scheme', 'status', 'credential_status']

	def get_queryset(self):
		qs = super().get_queryset()
		user = self.request.user
		if getattr(user, 'role', None) == 'ADMIN':
			return qs
		if getattr(user, 'role', None) == 'PROVIDER':
			return qs.filter(provider=user)
		return qs.none()

	def perform_create(self, serializer):
		# Providers can request membership for a scheme
		if getattr(self.request.user, 'role', None) == 'PROVIDER':
			serializer.save(provider=self.request.user)
		else:
			serializer.save()


class CredentialingDocumentViewSet(viewsets.ModelViewSet):
	queryset = CredentialingDocument.objects.select_related('membership__provider', 'membership__scheme').all()
	serializer_class = CredentialingDocumentSerializer
	permission_classes = [permissions.IsAuthenticated]
	filterset_fields = ['membership', 'doc_type', 'status']

	def get_queryset(self):
		qs = super().get_queryset()
		user = self.request.user
		if getattr(user, 'role', None) == 'ADMIN':
			return qs
		if getattr(user, 'role', None) == 'PROVIDER':
			return qs.filter(membership__provider=user)
		return qs.none()

	def create(self, request, *args, **kwargs):
		# Support multipart file upload
		data = request.data.copy()
		serializer = self.get_serializer(data=data)
		serializer.is_valid(raise_exception=True)
		serializer.save(uploaded_by=request.user)
		headers = self.get_success_headers(serializer.data)
		return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

