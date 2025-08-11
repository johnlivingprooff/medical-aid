from rest_framework.test import APITestCase
from rest_framework import status


class HealthAPITests(APITestCase):
    def test_health(self):
        url = "/api/core/health/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json().get("status"), "ok")
