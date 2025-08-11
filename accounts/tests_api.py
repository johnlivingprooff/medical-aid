from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status


class AuthAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="admin", password="Password123!", role="ADMIN")

    def test_login(self):
        resp = self.client.post("/api/auth/login/", {"username": "admin", "password": "Password123!"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.json())
        self.assertIn("refresh", resp.json())
        self.assertEqual(resp.json()["user"]["role"], "ADMIN")
