"""
EDI (Electronic Data Interchange) services for healthcare data exchange.
Handles X12 parsing, validation, and processing for medical aid claims and payments.
"""

import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from decimal import Decimal

from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import EDITransaction, EDIValidationRule


class X12Parser:
	"""Parser for X12 EDI format healthcare transactions"""

	def __init__(self, x12_content: str):
		self.x12_content = x12_content
		self.segments = []
		self.parsed_data = {}
		self.errors = []

	def parse(self) -> Dict[str, Any]:
		"""Parse X12 content into structured data"""
		try:
			# Split into segments and clean up
			raw_segments = [seg.strip() for seg in re.split(r'[\r\n]+', self.x12_content) if seg.strip()]

			if not raw_segments:
				self.errors.append("No segments found in X12 content")
				return {}

			# Parse each segment
			for segment in raw_segments:
				parsed_segment = self._parse_segment(segment)
				if parsed_segment:
					self.segments.append(parsed_segment)

			# Validate basic structure
			if not self.segments:
				self.errors.append("No valid segments parsed")
				return {}

			# Build hierarchical structure
			self.parsed_data = self._build_hierarchy()
			return self.parsed_data

		except Exception as e:
			self.errors.append(f"Parse error: {str(e)}")
			return {}

	def _parse_segment(self, segment: str) -> Optional[Dict[str, Any]]:
		"""Parse a single X12 segment"""
		try:
			# Split by element separator (*)
			elements = segment.split('*')

			if not elements:
				return None

			segment_id = elements[0]

			# Parse elements (skip segment ID)
			parsed_elements = []
			for i, element in enumerate(elements[1:], 1):
				# Handle composite elements (sub-elements separated by :)
				if ':' in element:
					sub_elements = element.split(':')
					parsed_elements.append(sub_elements)
				else:
					parsed_elements.append(element)

			return {
				'segment_id': segment_id,
				'elements': parsed_elements,
				'raw': segment
			}

		except Exception as e:
			self.errors.append(f"Error parsing segment '{segment}': {str(e)}")
			return None

	def _build_hierarchy(self) -> Dict[str, Any]:
		"""Build hierarchical structure from parsed segments"""
		hierarchy = {
			'interchange': {},
			'functional_groups': [],
			'transactions': []
		}

		current_group = None
		current_transaction = None

		for segment in self.segments:
			segment_id = segment['segment_id']

			if segment_id == 'ISA':
				# Interchange Control Header
				hierarchy['interchange'] = self._parse_isa_segment(segment)
			elif segment_id == 'GS':
				# Functional Group Header
				current_group = self._parse_gs_segment(segment)
				hierarchy['functional_groups'].append(current_group)
			elif segment_id == 'ST':
				# Transaction Set Header
				current_transaction = self._parse_st_segment(segment)
				if current_group:
					current_group['transactions'].append(current_transaction)
				else:
					hierarchy['transactions'].append(current_transaction)
			elif segment_id == 'SE':
				# Transaction Set Trailer
				if current_transaction:
					current_transaction['trailer'] = self._parse_se_segment(segment)
			elif segment_id == 'GE':
				# Functional Group Trailer
				if current_group:
					current_group['trailer'] = self._parse_ge_segment(segment)
			elif segment_id == 'IEA':
				# Interchange Control Trailer
				hierarchy['interchange']['trailer'] = self._parse_iea_segment(segment)
			else:
				# Transaction data segments
				if current_transaction:
					if 'segments' not in current_transaction:
						current_transaction['segments'] = []
					current_transaction['segments'].append(segment)

		return hierarchy

	def _parse_isa_segment(self, segment) -> Dict[str, Any]:
		"""Parse ISA (Interchange Control Header) segment"""
		elements = segment['elements']
		return {
			'authorization_qualifier': elements[0] if len(elements) > 0 else '',
			'authorization_info': elements[1] if len(elements) > 1 else '',
			'security_qualifier': elements[2] if len(elements) > 2 else '',
			'security_info': elements[3] if len(elements) > 3 else '',
			'sender_qualifier': elements[4] if len(elements) > 4 else '',
			'sender_id': elements[5] if len(elements) > 5 else '',
			'receiver_qualifier': elements[6] if len(elements) > 6 else '',
			'receiver_id': elements[7] if len(elements) > 7 else '',
			'date': elements[8] if len(elements) > 8 else '',
			'time': elements[9] if len(elements) > 9 else '',
			'control_standards_id': elements[10] if len(elements) > 10 else '',
			'control_version': elements[11] if len(elements) > 11 else '',
			'control_number': elements[12] if len(elements) > 12 else '',
			'acknowledgment_requested': elements[13] if len(elements) > 13 else '',
			'usage_indicator': elements[14] if len(elements) > 14 else '',
		}

	def _parse_gs_segment(self, segment) -> Dict[str, Any]:
		"""Parse GS (Functional Group Header) segment"""
		elements = segment['elements']
		return {
			'functional_id': elements[0] if len(elements) > 0 else '',
			'application_sender': elements[1] if len(elements) > 1 else '',
			'application_receiver': elements[2] if len(elements) > 2 else '',
			'date': elements[3] if len(elements) > 3 else '',
			'time': elements[4] if len(elements) > 4 else '',
			'control_number': elements[5] if len(elements) > 5 else '',
			'responsible_agency': elements[6] if len(elements) > 6 else '',
			'version': elements[7] if len(elements) > 7 else '',
			'transactions': []
		}

	def _parse_st_segment(self, segment) -> Dict[str, Any]:
		"""Parse ST (Transaction Set Header) segment"""
		elements = segment['elements']
		return {
			'transaction_set_id': elements[0] if len(elements) > 0 else '',
			'transaction_set_control_number': elements[1] if len(elements) > 1 else '',
			'segments': []
		}

	def _parse_se_segment(self, segment) -> Dict[str, Any]:
		"""Parse SE (Transaction Set Trailer) segment"""
		elements = segment['elements']
		return {
			'segment_count': elements[0] if len(elements) > 0 else '',
			'transaction_set_control_number': elements[1] if len(elements) > 1 else '',
		}

	def _parse_ge_segment(self, segment) -> Dict[str, Any]:
		"""Parse GE (Functional Group Trailer) segment"""
		elements = segment['elements']
		return {
			'transaction_count': elements[0] if len(elements) > 0 else '',
			'control_number': elements[1] if len(elements) > 1 else '',
		}

	def _parse_iea_segment(self, segment) -> Dict[str, Any]:
		"""Parse IEA (Interchange Control Trailer) segment"""
		elements = segment['elements']
		return {
			'functional_group_count': elements[0] if len(elements) > 0 else '',
			'control_number': elements[1] if len(elements) > 1 else '',
		}


class EDIValidator:
	"""Validator for EDI transactions using configurable rules"""

	def __init__(self):
		self.validation_errors = []

	def validate_transaction(self, parsed_data: Dict[str, Any]) -> List[Dict[str, Any]]:
		"""Validate parsed EDI transaction data"""
		self.validation_errors = []

		# Get active validation rules
		rules = EDIValidationRule.objects.filter(is_active=True)

		# Validate interchange level
		if 'interchange' in parsed_data:
			self._validate_interchange(parsed_data['interchange'], rules)

		# Validate functional groups
		if 'functional_groups' in parsed_data:
			for group in parsed_data['functional_groups']:
				self._validate_functional_group(group, rules)

		# Validate transactions
		if 'transactions' in parsed_data:
			for transaction in parsed_data['transactions']:
				self._validate_transaction_set(transaction, rules)

		return self.validation_errors

	def _validate_interchange(self, interchange: Dict[str, Any], rules):
		"""Validate interchange control segments"""
		# Validate ISA segment
		isa_rules = rules.filter(segment_id='ISA')
		for rule in isa_rules:
			if rule.element_position and rule.element_position <= len(interchange):
				value = interchange.get(f'element_{rule.element_position}')
				errors = rule.validate_element(value)
				self.validation_errors.extend(errors)

	def _validate_functional_group(self, group: Dict[str, Any], rules):
		"""Validate functional group segments"""
		# Validate GS segment
		gs_rules = rules.filter(segment_id='GS')
		for rule in gs_rules:
			if rule.element_position and rule.element_position <= len(group):
				value = group.get(f'element_{rule.element_position}')
				errors = rule.validate_element(value)
				self.validation_errors.extend(errors)

	def _validate_transaction_set(self, transaction: Dict[str, Any], rules):
		"""Validate transaction set segments"""
		if 'segments' not in transaction:
			return

		for segment in transaction['segments']:
			segment_id = segment.get('segment_id')
			segment_rules = rules.filter(segment_id=segment_id)

			for rule in segment_rules:
				if rule.element_position and rule.element_position <= len(segment.get('elements', [])):
					value = segment['elements'][rule.element_position - 1]
					errors = rule.validate_element(value)
					# Add segment context to errors
					for error in errors:
						error['segment'] = segment_id
						error['segment_raw'] = segment.get('raw', '')
					self.validation_errors.extend(errors)


class EDIProcessor:
	"""Main processor for EDI transactions"""

	def __init__(self):
		self.parser = X12Parser('')
		self.validator = EDIValidator()

	def process_edi_submission(self, x12_content: str, transaction_type: str,
							 provider=None, claim=None, patient=None) -> Tuple[bool, str, Dict[str, Any]]:
		"""
		Process an EDI submission
		Returns: (success, message, response_data)
		"""
		try:
			# Parse the X12 content
			self.parser = X12Parser(x12_content)
			parsed_data = self.parser.parse()

			if self.parser.errors:
				return False, f"Parse errors: {', '.join(self.parser.errors)}", {}

			# Validate the parsed data
			validation_errors = self.validator.validate_transaction(parsed_data)

			# Create EDI transaction record
			transaction_id = f"EDI-{uuid.uuid4().hex[:12].upper()}"

			transaction = EDITransaction.objects.create(
				transaction_id=transaction_id,
				transaction_type=transaction_type,
				status=EDITransaction.Status.PENDING,
				sender_id=parsed_data.get('interchange', {}).get('sender_id', ''),
				receiver_id=parsed_data.get('interchange', {}).get('receiver_id', ''),
				provider=provider,
				x12_content=x12_content,
				parsed_data=parsed_data,
				segment_count=len(self.parser.segments),
				control_number=parsed_data.get('interchange', {}).get('control_number', ''),
				claim=claim,
				patient=patient
			)

			# Determine status based on validation
			if validation_errors:
				transaction.mark_error(
					error_message="Validation errors found",
					validation_errors=validation_errors
				)
				status = "ACCEPTED_WITH_ERRORS"
				message = f"EDI accepted with {len(validation_errors)} validation errors"
			else:
				transaction.mark_sent()
				status = "ACCEPTED"
				message = "EDI accepted and queued for processing"

			response_data = {
				'status': status,
				'transaction_id': transaction_id,
				'message': message,
				'segment_count': len(self.parser.segments),
				'validation_errors': validation_errors,
				'parsed_data': parsed_data
			}

			return True, message, response_data

		except Exception as e:
			return False, f"Processing error: {str(e)}", {}

	def get_transaction_status(self, transaction_id: str) -> Optional[EDITransaction]:
		"""Get EDI transaction by ID"""
		try:
			return EDITransaction.objects.get(transaction_id=transaction_id)
		except EDITransaction.DoesNotExist:
			return None

	def get_provider_transactions(self, provider, status=None, transaction_type=None):
		"""Get EDI transactions for a provider with optional filtering"""
		queryset = EDITransaction.objects.filter(provider=provider)

		if status:
			queryset = queryset.filter(status=status)
		if transaction_type:
			queryset = queryset.filter(transaction_type=transaction_type)

		return queryset.order_by('-submitted_at')


# Global EDI processor instance
edi_processor = EDIProcessor()