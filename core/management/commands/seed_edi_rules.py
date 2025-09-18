"""
Management command to seed EDI validation rules for X12 transactions.
"""

from django.core.management.base import BaseCommand
from core.models import EDIValidationRule


class Command(BaseCommand):
    help = 'Seed EDI validation rules for X12 transactions'

    def handle(self, *args, **options):
        self.stdout.write('Seeding EDI validation rules...')

        # ISA segment validation rules
        isa_rules = [
            {
                'rule_name': 'ISA_Sender_ID_Required',
                'rule_type': 'REQUIRED_ELEMENT',
                'segment_id': 'ISA',
                'element_position': 6,
                'element_name': 'Sender ID',
                'required': True,
                'min_length': 2,
                'max_length': 15,
                'error_code': 'ISA001',
                'error_message': 'ISA Sender ID is required and must be 2-15 characters',
            },
            {
                'rule_name': 'ISA_Receiver_ID_Required',
                'rule_type': 'REQUIRED_ELEMENT',
                'segment_id': 'ISA',
                'element_position': 8,
                'element_name': 'Receiver ID',
                'required': True,
                'min_length': 2,
                'max_length': 15,
                'error_code': 'ISA002',
                'error_message': 'ISA Receiver ID is required and must be 2-15 characters',
            },
            {
                'rule_name': 'ISA_Date_Format',
                'rule_type': 'FORMAT_VALIDATION',
                'segment_id': 'ISA',
                'element_position': 9,
                'element_name': 'Date',
                'required': True,
                'regex_pattern': r'^\d{6}$',
                'error_code': 'ISA003',
                'error_message': 'ISA Date must be in YYMMDD format',
            },
            {
                'rule_name': 'ISA_Time_Format',
                'rule_type': 'FORMAT_VALIDATION',
                'segment_id': 'ISA',
                'element_position': 10,
                'element_name': 'Time',
                'required': True,
                'regex_pattern': r'^\d{4}$',
                'error_code': 'ISA004',
                'error_message': 'ISA Time must be in HHMM format',
            },
        ]

        # GS segment validation rules
        gs_rules = [
            {
                'rule_name': 'GS_Functional_ID_Valid',
                'rule_type': 'CODE_VALIDATION',
                'segment_id': 'GS',
                'element_position': 1,
                'element_name': 'Functional ID',
                'required': True,
                'valid_codes': ['HC', 'HP', 'HR', 'HI'],
                'error_code': 'GS001',
                'error_message': 'GS Functional ID must be HC (Health Care), HP (Property), HR (Human Resources), or HI (Health Care Institutional)',
            },
            {
                'rule_name': 'GS_Version_Valid',
                'rule_type': 'FORMAT_VALIDATION',
                'segment_id': 'GS',
                'element_position': 8,
                'element_name': 'Version',
                'required': True,
                'regex_pattern': r'^\d{3}$',
                'error_code': 'GS002',
                'error_message': 'GS Version must be a 3-digit number',
            },
        ]

        # ST segment validation rules
        st_rules = [
            {
                'rule_name': 'ST_Transaction_Set_ID_Valid',
                'rule_type': 'CODE_VALIDATION',
                'segment_id': 'ST',
                'element_position': 1,
                'element_name': 'Transaction Set ID',
                'required': True,
                'valid_codes': ['837', '835', '270', '271', '276', '277'],
                'error_code': 'ST001',
                'error_message': 'ST Transaction Set ID must be a valid healthcare transaction type (837, 835, 270, 271, 276, 277)',
            },
        ]

        # Create all rules
        all_rules = isa_rules + gs_rules + st_rules

        created_count = 0
        updated_count = 0

        for rule_data in all_rules:
            rule, created = EDIValidationRule.objects.get_or_create(
                rule_name=rule_data['rule_name'],
                defaults=rule_data
            )
            if created:
                created_count += 1
                self.stdout.write(f"  Created: {rule.rule_name}")
            else:
                # Update existing rule
                for key, value in rule_data.items():
                    setattr(rule, key, value)
                rule.save()
                updated_count += 1
                self.stdout.write(f"  Updated: {rule.rule_name}")

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully processed {created_count + updated_count} EDI validation rules '
                f'({created_count} created, {updated_count} updated)'
            )
        )