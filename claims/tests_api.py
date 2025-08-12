from django.urls import reverse
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from schemes.models import SchemeCategory, SchemeBenefit, BenefitType
from claims.models import Patient, Claim, Invoice


User = get_user_model()


class ClaimsWorkflowTests(APITestCase):
    def setUp(self):
        # users
        self.admin = User.objects.create_user(username='admin', password='admin', role='ADMIN')
        self.provider = User.objects.create_user(username='prov', password='prov', role='PROVIDER')
        self.patient_user = User.objects.create_user(username='pat', password='pat', role='PATIENT')
        # scheme + benefits
        self.scheme = SchemeCategory.objects.create(name='Basic', description='')
        self.bt_consult, _ = BenefitType.objects.get_or_create(name='CONSULTATION')
        SchemeBenefit.objects.create(
            scheme=self.scheme,
            benefit_type=self.bt_consult,
            coverage_amount=100.0,
            coverage_limit_count=5,
            coverage_period=SchemeBenefit.CoveragePeriod.YEARLY,
        )
        # patient profile
        self.patient = Patient.objects.create(
            user=self.patient_user, date_of_birth='1990-01-01', gender='M', scheme=self.scheme
        )

    def auth(self, user):
        # obtain JWT
        resp = self.client.post('/api/auth/login/', {'username': user.username, 'password': user.username})
        # fallback to explicit password when username!=password
        if resp.status_code != 200:
            resp = self.client.post('/api/auth/login/', {'username': user.username, 'password': 'admin' if user==self.admin else 'prov' if user==self.provider else 'pat'})
        token = resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_provider_can_create_claim_and_auto_invoice(self):
        self.auth(self.provider)
        payload = {
            'patient': self.patient.id,
            'service_type': self.bt_consult.id,
            'cost': '30.00',
            'notes': 'checkup',
        }
        resp = self.client.post('/api/claims/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        claim_id = resp.data['id']
        claim = Claim.objects.get(id=claim_id)
        self.assertEqual(claim.status, Claim.Status.APPROVED)
        self.assertTrue(hasattr(claim, 'invoice'))
        self.assertEqual(float(claim.invoice.amount), 30.0)

    def test_patient_can_only_see_own_claims(self):
        # create claim as provider
        self.auth(self.provider)
        self.client.post('/api/claims/', {
            'patient': self.patient.id,
            'service_type': self.bt_consult.id,
            'cost': '20.00'
        }, format='json')
        # list as patient
        self.auth(self.patient_user)
        resp = self.client.get('/api/claims/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data), 1)
        # other patient cannot see
        other_user = User.objects.create_user(username='pat2', password='pat2', role='PATIENT')
        Patient.objects.create(user=other_user, date_of_birth='1991-01-01', gender='F', scheme=self.scheme)
        self.auth(other_user)
        resp2 = self.client.get('/api/claims/')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(resp2.data), 0)

    def test_admin_only_invoice_update(self):
        # create a claim and invoice
        self.auth(self.provider)
        r = self.client.post('/api/claims/', {
            'patient': self.patient.id,
            'service_type': self.bt_consult.id,
            'cost': '15.00'
        }, format='json')
        invoice_id = Invoice.objects.first().id
        # provider cannot update invoice
        resp = self.client.patch(f'/api/invoices/{invoice_id}/', {'payment_status': 'PAID'}, format='json')
        self.assertEqual(resp.status_code, 403)
        # admin can
        self.auth(self.admin)
        resp2 = self.client.patch(f'/api/invoices/{invoice_id}/', {'payment_status': 'PAID'}, format='json')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data['payment_status'], 'PAID')

    def test_patient_coverage_balance_endpoint(self):
        # approve a claim to consume coverage
        self.auth(self.provider)
        self.client.post('/api/claims/', {
            'patient': self.patient.id,
            'service_type': self.bt_consult.id,
            'cost': '40.00'
        }, format='json')
        # check coverage balance
        self.auth(self.patient_user)
        resp = self.client.get(f'/api/patients/{self.patient.id}/coverage-balance/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('balances', resp.data)
