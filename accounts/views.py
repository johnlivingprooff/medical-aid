from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from .serializers import RegisterSerializer, UserSerializer
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
		data['user'] = UserSerializer(self.user).data
		return data


class CustomTokenObtainPairView(TokenObtainPairView):
	serializer_class = CustomTokenObtainPairSerializer
	permission_classes = [permissions.AllowAny]

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

