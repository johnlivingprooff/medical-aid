from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date
from decimal import Decimal

from schemes.models import SchemeCategory, SchemeBenefit, BenefitType
from claims.models import Patient, Claim, Invoice
from accounts.models import ProviderProfile


class Command(BaseCommand):
    help = "Seed comprehensive sample data for development aligned with enhanced models"

    def handle(self, *args, **options):
        User = get_user_model()
        
        # Create admin user
        admin, created = User.objects.get_or_create(
            username='admin', 
            defaults={
                'role': 'ADMIN',
                'email': 'admin@medicalaid.com',
                'first_name': 'System',
                'last_name': 'Administrator'
            }
        )
        if created or not admin.password:
            admin.set_password('Password123!')
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()

        # Create diverse providers with profiles
        providers_data = [
            {
                'username': 'dr_smith', 'first_name': 'John', 'last_name': 'Smith',
                'facility_name': 'City General Hospital', 'facility_type': 'HOSPITAL',
                'phone': '+27123456789', 'address': '123 Medical Ave', 'city': 'Cape Town'
            },
            {
                'username': 'dr_jones', 'first_name': 'Sarah', 'last_name': 'Jones', 
                'facility_name': 'Family Health Clinic', 'facility_type': 'CLINIC',
                'phone': '+27123456790', 'address': '456 Health St', 'city': 'Johannesburg'
            },
            {
                'username': 'pharmacy_central', 'first_name': 'Mike', 'last_name': 'Wilson',
                'facility_name': 'Central Pharmacy', 'facility_type': 'PHARMACY',
                'phone': '+27123456791', 'address': '789 Pharmacy Rd', 'city': 'Durban'
            },
            {
                'username': 'lab_tech', 'first_name': 'Lisa', 'last_name': 'Brown',
                'facility_name': 'MedLab Diagnostics', 'facility_type': 'LAB',
                'phone': '+27123456792', 'address': '321 Lab Lane', 'city': 'Pretoria'
            }
        ]

        providers = []
        for provider_data in providers_data:
            provider, created = User.objects.get_or_create(
                username=provider_data['username'],
                defaults={
                    'role': 'PROVIDER',
                    'email': f"{provider_data['username']}@medicalaid.com",
                    'first_name': provider_data['first_name'],
                    'last_name': provider_data['last_name']
                }
            )
            if created or not provider.password:
                provider.set_password('Password123!')
                provider.save()
            
            # Create provider profile
            profile, _ = ProviderProfile.objects.get_or_create(
                user=provider,
                defaults={
                    'facility_name': provider_data['facility_name'],
                    'facility_type': provider_data['facility_type'],
                    'phone': provider_data['phone'],
                    'address': provider_data['address'],
                    'city': provider_data['city']
                }
            )
            providers.append(provider)

        # Create comprehensive benefit types
        benefit_types_data = [
            'CONSULTATION', 'SPECIALIST', 'EMERGENCY', 'SURGERY',
            'LAB', 'RADIOLOGY', 'PHARMACY', 'IMAGING', 
            'PHYSIOTHERAPY', 'DENTAL', 'OPTICAL', 'MATERNITY'
        ]
        
        benefit_types = {}
        for bt_name in benefit_types_data:
            bt, _ = BenefitType.objects.get_or_create(name=bt_name)
            benefit_types[bt_name] = bt

        # Create comprehensive scheme categories
        schemes_data = [
            {
                'name': 'VIP Premium',
                'description': 'Comprehensive coverage with premium benefits',
                'price': Decimal('2500.00')
            },
            {
                'name': 'Standard Plus', 
                'description': 'Enhanced standard coverage with additional benefits',
                'price': Decimal('1800.00')
            },
            {
                'name': 'Basic Essential',
                'description': 'Essential medical coverage for basic needs',
                'price': Decimal('1200.00')
            },
            {
                'name': 'Family Care',
                'description': 'Family-focused plan with pediatric and maternity benefits',
                'price': Decimal('2000.00')
            }
        ]

        schemes = {}
        for scheme_data in schemes_data:
            scheme, _ = SchemeCategory.objects.get_or_create(
                name=scheme_data['name'],
                defaults={
                    'description': scheme_data['description'],
                    'price': scheme_data['price']
                }
            )
            schemes[scheme_data['name']] = scheme

        # Create comprehensive scheme benefits
        benefits_config = {
            'VIP Premium': [
                ('CONSULTATION', Decimal('1000.00'), 6, 'YEARLY', Decimal('0.00'), 10, Decimal('50.00')),
                ('SPECIALIST', Decimal('1500.00'), 4, 'YEARLY', Decimal('100.00'), 15, Decimal('100.00')),
                ('EMERGENCY', Decimal('5000.00'), None, 'YEARLY', Decimal('200.00'), 0, Decimal('0.00')),
                ('SURGERY', Decimal('50000.00'), 2, 'YEARLY', Decimal('2000.00'), 20, Decimal('500.00')),
                ('LAB', Decimal('2000.00'), 12, 'YEARLY', Decimal('0.00'), 5, Decimal('25.00')),
                ('PHARMACY', Decimal('500.00'), None, 'MONTHLY', Decimal('0.00'), 10, Decimal('20.00')),
                ('IMAGING', Decimal('3000.00'), 6, 'YEARLY', Decimal('300.00'), 15, Decimal('100.00')),
                ('DENTAL', Decimal('2000.00'), 2, 'YEARLY', Decimal('500.00'), 20, Decimal('100.00')),
                ('OPTICAL', Decimal('1500.00'), 1, 'YEARLY', Decimal('0.00'), 25, Decimal('0.00')),
                ('MATERNITY', Decimal('25000.00'), 1, 'YEARLY', Decimal('5000.00'), 0, Decimal('1000.00')),
            ],
            'Standard Plus': [
                ('CONSULTATION', Decimal('600.00'), 4, 'YEARLY', Decimal('50.00'), 15, Decimal('75.00')),
                ('SPECIALIST', Decimal('800.00'), 2, 'YEARLY', Decimal('200.00'), 20, Decimal('150.00')),
                ('EMERGENCY', Decimal('3000.00'), None, 'YEARLY', Decimal('500.00'), 0, Decimal('200.00')),
                ('LAB', Decimal('1000.00'), 8, 'YEARLY', Decimal('50.00'), 10, Decimal('50.00')),
                ('PHARMACY', Decimal('300.00'), None, 'MONTHLY', Decimal('0.00'), 15, Decimal('30.00')),
                ('IMAGING', Decimal('1500.00'), 3, 'YEARLY', Decimal('500.00'), 20, Decimal('200.00')),
                ('DENTAL', Decimal('1000.00'), 1, 'YEARLY', Decimal('300.00'), 30, Decimal('150.00')),
                ('OPTICAL', Decimal('800.00'), 1, 'YEARLY', Decimal('200.00'), 30, Decimal('100.00')),
            ],
            'Basic Essential': [
                ('CONSULTATION', Decimal('300.00'), 2, 'YEARLY', Decimal('100.00'), 20, Decimal('100.00')),
                ('EMERGENCY', Decimal('2000.00'), None, 'YEARLY', Decimal('1000.00'), 0, Decimal('500.00')),
                ('LAB', Decimal('500.00'), 4, 'YEARLY', Decimal('100.00'), 15, Decimal('75.00')),
                ('PHARMACY', Decimal('200.00'), None, 'MONTHLY', Decimal('50.00'), 20, Decimal('50.00')),
            ],
            'Family Care': [
                ('CONSULTATION', Decimal('800.00'), 6, 'YEARLY', Decimal('25.00'), 10, Decimal('50.00')),
                ('SPECIALIST', Decimal('1200.00'), 3, 'YEARLY', Decimal('150.00'), 15, Decimal('120.00')),
                ('LAB', Decimal('1500.00'), 10, 'YEARLY', Decimal('25.00'), 8, Decimal('40.00')),
                ('PHARMACY', Decimal('400.00'), None, 'MONTHLY', Decimal('0.00'), 10, Decimal('25.00')),
                ('MATERNITY', Decimal('20000.00'), 2, 'YEARLY', Decimal('3000.00'), 0, Decimal('800.00')),
                ('DENTAL', Decimal('1500.00'), 2, 'YEARLY', Decimal('200.00'), 25, Decimal('100.00')),
                ('OPTICAL', Decimal('1000.00'), 1, 'YEARLY', Decimal('100.00'), 30, Decimal('50.00')),
            ]
        }

        for scheme_name, benefits in benefits_config.items():
            scheme = schemes[scheme_name]
            for benefit_data in benefits:
                bt_name, coverage_amount, coverage_limit_count, coverage_period, deductible, copay_percent, copay_fixed = benefit_data
                
                SchemeBenefit.objects.get_or_create(
                    scheme=scheme,
                    benefit_type=benefit_types[bt_name],
                    defaults={
                        'coverage_amount': coverage_amount,
                        'coverage_limit_count': coverage_limit_count,
                        'coverage_period': coverage_period,
                        'deductible_amount': deductible,
                        'copayment_percentage': copay_percent,
                        'copayment_fixed': copay_fixed,
                        'requires_preauth': bt_name in ['SURGERY', 'SPECIALIST', 'IMAGING'] and coverage_amount > Decimal('1000.00'),
                        'preauth_limit': Decimal('1000.00') if bt_name in ['SURGERY', 'SPECIALIST'] else None,
                        'waiting_period_days': 30 if bt_name in ['DENTAL', 'OPTICAL'] else 0,
                        'network_only': bt_name == 'EMERGENCY'
                    }
                )

        # Create diverse patient users and profiles
        patients_data = [
            {
                'username': 'john_doe', 'first_name': 'John', 'last_name': 'Doe',
                'dob': '1985-03-15', 'gender': 'M', 'scheme': 'VIP Premium',
                'status': 'ACTIVE', 'phone': '+27234567890', 'relationship': 'PRINCIPAL',
                'emergency_contact': 'Jane Doe', 'emergency_phone': '+27234567891'
            },
            {
                'username': 'jane_doe', 'first_name': 'Jane', 'last_name': 'Doe',
                'dob': '1987-07-22', 'gender': 'F', 'scheme': 'VIP Premium',
                'status': 'ACTIVE', 'phone': '+27234567891', 'relationship': 'SPOUSE',
                'emergency_contact': 'John Doe', 'emergency_phone': '+27234567890'
            },
            {
                'username': 'mary_smith', 'first_name': 'Mary', 'last_name': 'Smith',
                'dob': '1990-11-08', 'gender': 'F', 'scheme': 'Standard Plus',
                'status': 'ACTIVE', 'phone': '+27345678901', 'relationship': 'PRINCIPAL',
                'emergency_contact': 'Robert Smith', 'emergency_phone': '+27345678902'
            },
            {
                'username': 'peter_jones', 'first_name': 'Peter', 'last_name': 'Jones',
                'dob': '1975-12-03', 'gender': 'M', 'scheme': 'Family Care',
                'status': 'SUSPENDED', 'phone': '+27456789012', 'relationship': 'PRINCIPAL',
                'emergency_contact': 'Susan Jones', 'emergency_phone': '+27456789013'
            },
            {
                'username': 'susan_jones', 'first_name': 'Susan', 'last_name': 'Jones',
                'dob': '1978-05-18', 'gender': 'F', 'scheme': 'Family Care',
                'status': 'ACTIVE', 'phone': '+27456789013', 'relationship': 'SPOUSE',
                'emergency_contact': 'Peter Jones', 'emergency_phone': '+27456789012'
            },
            {
                'username': 'tom_brown', 'first_name': 'Tom', 'last_name': 'Brown',
                'dob': '1995-09-14', 'gender': 'M', 'scheme': 'Basic Essential',
                'status': 'ACTIVE', 'phone': '+27567890123', 'relationship': 'PRINCIPAL',
                'emergency_contact': 'Emma Brown', 'emergency_phone': '+27567890124'
            },
        ]

        patients = []
        principal_members = {}
        
        for patient_data in patients_data:
            # Create user
            patient_user, created = User.objects.get_or_create(
                username=patient_data['username'],
                defaults={
                    'role': 'PATIENT',
                    'email': f"{patient_data['username']}@email.com",
                    'first_name': patient_data['first_name'],
                    'last_name': patient_data['last_name']
                }
            )
            if created or not patient_user.password:
                patient_user.set_password('Password123!')
                patient_user.save()

            # Determine principal member
            principal_member = None
            if patient_data['relationship'] == 'SPOUSE':
                # Find principal with same last name
                principal_member = principal_members.get(patient_data['last_name'])
            
            # Create patient profile
            patient, created = Patient.objects.get_or_create(
                user=patient_user,
                defaults={
                    'date_of_birth': patient_data['dob'],
                    'gender': patient_data['gender'],
                    'scheme': schemes[patient_data['scheme']],
                    'status': patient_data['status'],
                    'phone': patient_data['phone'],
                    'relationship': patient_data['relationship'],
                    'principal_member': principal_member,
                    'emergency_contact': patient_data['emergency_contact'],
                    'emergency_phone': patient_data['emergency_phone'],
                    'enrollment_date': date.today() - timedelta(days=365),  # Enrolled 1 year ago
                    'benefit_year_start': date(date.today().year, 1, 1),  # Benefit year starts Jan 1
                }
            )
            
            # Store principal members for dependent linking
            if patient_data['relationship'] == 'PRINCIPAL':
                principal_members[patient_data['last_name']] = patient
            
            patients.append(patient)

        # Create comprehensive sample claims with realistic scenarios
        if not Claim.objects.exists():
            now = timezone.now()
            claims_data = [
                # VIP Premium member claims
                {
                    'patient': patients[0],  # john_doe
                    'provider': providers[0],  # Hospital
                    'service_type': 'CONSULTATION',
                    'cost': Decimal('450.00'),
                    'days_ago': 5,
                    'status': 'APPROVED',
                    'diagnosis_code': 'Z00.00',
                    'notes': 'Annual health checkup',
                    'create_invoice': True,
                    'invoice_status': 'PAID'
                },
                {
                    'patient': patients[0],
                    'provider': providers[2],  # Pharmacy
                    'service_type': 'PHARMACY',
                    'cost': Decimal('285.50'),
                    'days_ago': 2,
                    'status': 'APPROVED',
                    'diagnosis_code': 'I10',
                    'notes': 'Hypertension medication refill',
                    'create_invoice': True,
                    'invoice_status': 'PAID'
                },
                {
                    'patient': patients[1],  # jane_doe (spouse)
                    'provider': providers[1],  # Clinic
                    'service_type': 'SPECIALIST',
                    'cost': Decimal('750.00'),
                    'days_ago': 10,
                    'status': 'APPROVED',
                    'diagnosis_code': 'M79.9',
                    'notes': 'Orthopedic consultation for knee pain',
                    'preauth_number': 'PA2024001',
                    'create_invoice': True,
                    'invoice_status': 'PAID'
                },
                
                # Standard Plus member claims
                {
                    'patient': patients[2],  # mary_smith
                    'provider': providers[3],  # Lab
                    'service_type': 'LAB',
                    'cost': Decimal('320.00'),
                    'days_ago': 3,
                    'status': 'APPROVED',
                    'diagnosis_code': 'Z01.7',
                    'notes': 'Comprehensive blood panel',
                    'create_invoice': True,
                    'invoice_status': 'PAID'
                },
                {
                    'patient': patients[2],
                    'provider': providers[1],  # Clinic
                    'service_type': 'CONSULTATION',
                    'cost': Decimal('380.00'),
                    'days_ago': 1,
                    'status': 'PENDING',
                    'diagnosis_code': 'K59.00',
                    'notes': 'Gastrointestinal consultation',
                },
                
                # Family Care member claims
                {
                    'patient': patients[3],  # peter_jones (suspended)
                    'provider': providers[0],  # Hospital
                    'service_type': 'EMERGENCY',
                    'cost': Decimal('1500.00'),
                    'days_ago': 7,
                    'status': 'REJECTED',
                    'diagnosis_code': 'S72.001A',
                    'notes': 'Emergency room visit for fracture',
                    'rejection_reason': 'Member account suspended - outstanding premiums'
                },
                {
                    'patient': patients[4],  # susan_jones (spouse, active)
                    'provider': providers[1],  # Clinic
                    'service_type': 'MATERNITY',
                    'cost': Decimal('1200.00'),
                    'days_ago': 14,
                    'status': 'APPROVED',
                    'diagnosis_code': 'O09.90',
                    'notes': 'Prenatal care consultation',
                    'preauth_number': 'PA2024002',
                    'create_invoice': True,
                    'invoice_status': 'PENDING'
                },
                
                # Basic Essential member claims
                {
                    'patient': patients[5],  # tom_brown
                    'provider': providers[2],  # Pharmacy
                    'service_type': 'PHARMACY',
                    'cost': Decimal('150.00'),
                    'days_ago': 1,
                    'status': 'APPROVED',
                    'diagnosis_code': 'J06.9',
                    'notes': 'Cold and flu medication',
                    'create_invoice': True,
                    'invoice_status': 'PAID'
                },
                {
                    'patient': patients[5],
                    'provider': providers[1],  # Clinic
                    'service_type': 'CONSULTATION',
                    'cost': Decimal('250.00'),
                    'days_ago': 12,
                    'status': 'INVESTIGATING',
                    'diagnosis_code': 'R50.9',
                    'notes': 'Fever investigation - additional documentation requested',
                    'priority': 'HIGH'
                },
                
                # Additional claims for analytics variety
                {
                    'patient': patients[0],
                    'provider': providers[3],  # Lab
                    'service_type': 'LAB',
                    'cost': Decimal('420.00'),
                    'days_ago': 30,
                    'status': 'APPROVED',
                    'diagnosis_code': 'E11.9',
                    'notes': 'Diabetes monitoring - HbA1c test',
                    'create_invoice': True,
                    'invoice_status': 'PAID'
                },
                {
                    'patient': patients[2],
                    'provider': providers[0],  # Hospital
                    'service_type': 'IMAGING',
                    'cost': Decimal('850.00'),
                    'days_ago': 21,
                    'status': 'REQUIRES_PREAUTH',
                    'diagnosis_code': 'M25.561',
                    'notes': 'MRI scan for knee evaluation - awaiting pre-authorization',
                    'priority': 'NORMAL'
                },
            ]

            for claim_data in claims_data:
                claim = Claim.objects.create(
                    patient=claim_data['patient'],
                    provider=claim_data['provider'],
                    service_type=benefit_types[claim_data['service_type']],
                    cost=claim_data['cost'],
                    date_submitted=now - timedelta(days=claim_data['days_ago']),
                    date_of_service=(now - timedelta(days=claim_data['days_ago'] + 1)).date(),
                    status=claim_data['status'],
                    priority=claim_data.get('priority', 'NORMAL'),
                    diagnosis_code=claim_data['diagnosis_code'],
                    notes=claim_data['notes'],
                    coverage_checked=claim_data['status'] in ['APPROVED', 'REJECTED'],
                    processed_date=now - timedelta(days=claim_data['days_ago'] - 1) if claim_data['status'] in ['APPROVED', 'REJECTED'] else None,
                    processed_by=admin if claim_data['status'] in ['APPROVED', 'REJECTED'] else None,
                    preauth_number=claim_data.get('preauth_number', ''),
                    rejection_reason=claim_data.get('rejection_reason', ''),
                    rejection_date=now - timedelta(days=claim_data['days_ago'] - 1) if claim_data['status'] == 'REJECTED' else None
                )

                # Create invoices for approved claims
                if claim_data.get('create_invoice'):
                    invoice = Invoice.objects.create(
                        claim=claim,
                        amount=claim.cost,
                        payment_status=claim_data.get('invoice_status', 'PENDING')
                    )

        self.stdout.write(self.style.SUCCESS('Comprehensive seed data created successfully!'))
        self.stdout.write(self.style.SUCCESS(f'Created:'))
        self.stdout.write(f'  - {User.objects.filter(role="ADMIN").count()} Admin(s)')
        self.stdout.write(f'  - {User.objects.filter(role="PROVIDER").count()} Provider(s)')
        self.stdout.write(f'  - {User.objects.filter(role="PATIENT").count()} Patient(s)')
        self.stdout.write(f'  - {ProviderProfile.objects.count()} Provider Profile(s)')
        self.stdout.write(f'  - {SchemeCategory.objects.count()} Scheme(s)')
        self.stdout.write(f'  - {BenefitType.objects.count()} Benefit Type(s)')
        self.stdout.write(f'  - {SchemeBenefit.objects.count()} Scheme Benefit(s)')
        self.stdout.write(f'  - {Patient.objects.count()} Patient Profile(s)')
        self.stdout.write(f'  - {Claim.objects.count()} Claim(s)')
        self.stdout.write(f'  - {Invoice.objects.count()} Invoice(s)')
        
        # Recompute scheme prices after seeding benefits
        from django.db.models import F, Sum
        for scheme in SchemeCategory.objects.all():
            total = (
                SchemeBenefit.objects.filter(scheme=scheme)
                .annotate(final=F('coverage_amount') * F('coverage_limit_count'))
                .aggregate(total=Sum('final'))['total'] or 0
            )
            if scheme.price != total:
                scheme.price = total
                scheme.save(update_fields=['price'])
                self.stdout.write(f'  - Updated {scheme.name} price to {scheme.price}')
