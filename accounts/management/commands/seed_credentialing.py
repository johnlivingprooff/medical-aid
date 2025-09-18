"""
Management command to seed initial credentialing rules and templates.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models_credentialing import CredentialingRule, CredentialingTemplate

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed initial credentialing rules and templates'

    def handle(self, *args, **options):
        self.stdout.write('Seeding credentialing rules and templates...')

        # Get or create admin user for created_by fields
        admin_user = User.objects.filter(role='ADMIN').first()
        if not admin_user:
            admin_user = User.objects.create_user(
                username='system_admin',
                email='admin@system.com',
                password='admin123!',
                role='ADMIN'
            )

        # Create credentialing rules
        self.create_credentialing_rules(admin_user)

        # Create credentialing templates
        self.create_credentialing_templates(admin_user)

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded credentialing rules and templates')
        )

    def create_credentialing_rules(self, admin_user):
        """Create initial credentialing validation rules."""

        rules_data = [
            {
                'name': 'License Document Validation',
                'description': 'Validate medical license documents',
                'rule_type': 'LICENSE_VERIFICATION',
                'doc_type': 'LICENSE',
                'min_file_size': 10240,  # 10KB
                'max_file_size': 5242880,  # 5MB
                'allowed_extensions': ['.pdf', '.jpg', '.jpeg', '.png'],
                'content_patterns': [r'license', r'medical', r'practitioner'],
                'expiry_check_days': 90,
                'action': 'REQUIRE_REVIEW',
                'auto_approve_score': 75,
                'escalation_threshold': 30,
            },
            {
                'name': 'Contract Document Check',
                'description': 'Validate provider contract documents',
                'rule_type': 'CONTRACT_VALIDATION',
                'doc_type': 'CONTRACT',
                'min_file_size': 5120,  # 5KB
                'max_file_size': 10485760,  # 10MB
                'allowed_extensions': ['.pdf', '.doc', '.docx'],
                'content_patterns': [r'contract', r'agreement', r'terms'],
                'expiry_check_days': 60,
                'action': 'REQUIRE_REVIEW',
                'auto_approve_score': 70,
                'escalation_threshold': 45,
            },
            {
                'name': 'Insurance Certificate Validation',
                'description': 'Validate professional liability insurance',
                'rule_type': 'INSURANCE_CHECK',
                'doc_type': 'INSURANCE',
                'min_file_size': 15360,  # 15KB
                'max_file_size': 3145728,  # 3MB
                'allowed_extensions': ['.pdf', '.jpg', '.jpeg'],
                'content_patterns': [r'insurance', r'liability', r'coverage'],
                'expiry_check_days': 30,
                'action': 'REQUIRE_REVIEW',
                'auto_approve_score': 80,
                'escalation_threshold': 15,
            },
            {
                'name': 'General Document Check',
                'description': 'Basic validation for other document types',
                'rule_type': 'COMPLIANCE_REVIEW',
                'doc_type': 'OTHER',
                'min_file_size': 1024,  # 1KB
                'max_file_size': 2097152,  # 2MB
                'allowed_extensions': ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
                'content_patterns': [],
                'expiry_check_days': 365,
                'action': 'REQUIRE_REVIEW',
                'auto_approve_score': 60,
                'escalation_threshold': 60,
            },
        ]

        for rule_data in rules_data:
            rule, created = CredentialingRule.objects.get_or_create(
                name=rule_data['name'],
                defaults={
                    **rule_data,
                    'created_by': admin_user,
                    'is_active': True
                }
            )
            if created:
                self.stdout.write(f'Created rule: {rule.name}')
            else:
                self.stdout.write(f'Rule already exists: {rule.name}')

    def create_credentialing_templates(self, admin_user):
        """Create initial credentialing templates."""

        templates_data = [
            {
                'name': 'General Medical Practice Template',
                'description': 'Standard template for general medical practitioners',
                'facility_type': 'CLINIC',
                'required_documents': ['LICENSE', 'CONTRACT', 'INSURANCE'],
                'validation_rules': {
                    'LICENSE': {'required': True, 'min_score': 75},
                    'CONTRACT': {'required': True, 'min_score': 70},
                    'INSURANCE': {'required': True, 'min_score': 80}
                },
                'renewal_period_months': 12,
                'renewal_notice_days': 60,
            },
            {
                'name': 'Hospital Template',
                'description': 'Template for hospital-based providers',
                'facility_type': 'HOSPITAL',
                'required_documents': ['LICENSE', 'CONTRACT', 'INSURANCE', 'SPECIALTY_LICENSE'],
                'validation_rules': {
                    'LICENSE': {'required': True, 'min_score': 80},
                    'CONTRACT': {'required': True, 'min_score': 75},
                    'INSURANCE': {'required': True, 'min_score': 85},
                    'SPECIALTY_LICENSE': {'required': True, 'min_score': 80}
                },
                'renewal_period_months': 12,
                'renewal_notice_days': 45,
            },
            {
                'name': 'Pharmacy Template',
                'description': 'Template for pharmacy providers',
                'facility_type': 'PHARMACY',
                'required_documents': ['LICENSE', 'CONTRACT', 'INSURANCE', 'CONTROLLED_SUBSTANCES_CERT'],
                'validation_rules': {
                    'LICENSE': {'required': True, 'min_score': 75},
                    'CONTRACT': {'required': True, 'min_score': 70},
                    'INSURANCE': {'required': True, 'min_score': 80},
                    'CONTROLLED_SUBSTANCES_CERT': {'required': True, 'min_score': 85}
                },
                'renewal_period_months': 12,
                'renewal_notice_days': 30,
            },
            {
                'name': 'Diagnostic Services Template',
                'description': 'Template for diagnostic service providers',
                'facility_type': 'LAB',
                'required_documents': ['LICENSE', 'CONTRACT', 'INSURANCE', 'TECHNICAL_CERTIFICATION'],
                'validation_rules': {
                    'LICENSE': {'required': True, 'min_score': 75},
                    'CONTRACT': {'required': True, 'min_score': 70},
                    'INSURANCE': {'required': True, 'min_score': 80},
                    'TECHNICAL_CERTIFICATION': {'required': True, 'min_score': 80}
                },
                'renewal_period_months': 12,
                'renewal_notice_days': 60,
            },
        ]

        for template_data in templates_data:
            template, created = CredentialingTemplate.objects.get_or_create(
                name=template_data['name'],
                defaults={
                    **template_data,
                    'created_by': admin_user,
                    'is_active': True
                }
            )
            if created:
                self.stdout.write(f'Created template: {template.name}')
            else:
                self.stdout.write(f'Template already exists: {template.name}')