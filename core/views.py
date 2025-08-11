from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse


class HealthCheckView(APIView):
	permission_classes = [AllowAny]

	@extend_schema(responses={200: OpenApiResponse(description='Service health status')})
	def get(self, request):
		return Response({"status": "ok"})

