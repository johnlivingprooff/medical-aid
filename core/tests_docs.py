from rest_framework.test import APITestCase


class DocsTests(APITestCase):
    def test_openapi_schema_available(self):
        resp = self.client.get('/api/schema/?format=json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('openapi', data)
