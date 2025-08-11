from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from .serializers import RegisterSerializer, UserSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

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

