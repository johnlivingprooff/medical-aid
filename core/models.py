from django.conf import settings
from django.db import models
from django.utils import timezone


class Alert(models.Model):
	class Type(models.TextChoices):
		LOW_BALANCE = 'LOW_BALANCE', 'Low Balance'
		FRAUD_SUSPECT = 'FRAUD_SUSPECT', 'Fraud Suspect'
		SCHEME_ABUSE = 'SCHEME_ABUSE', 'Scheme Abuse'

	class Severity(models.TextChoices):
		INFO = 'INFO', 'Info'
		WARNING = 'WARNING', 'Warning'
		CRITICAL = 'CRITICAL', 'Critical'

	type = models.CharField(max_length=32, choices=Type.choices)
	message = models.TextField()
	severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.WARNING)
	patient = models.ForeignKey('claims.Patient', on_delete=models.CASCADE, null=True, blank=True, related_name='alerts')
	created_at = models.DateTimeField(auto_now_add=True)
	is_read = models.BooleanField(default=False)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.type} - {self.severity} - {self.created_at:%Y-%m-%d}"


class MemberMessage(models.Model):
	class Direction(models.TextChoices):
		TO_MEMBER = 'TO_MEMBER', 'To Member'
		FROM_MEMBER = 'FROM_MEMBER', 'From Member'

	patient = models.ForeignKey('claims.Patient', on_delete=models.CASCADE, related_name='messages')
	sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_member_messages')
	subject = models.CharField(max_length=200, blank=True)
	body = models.TextField()
	direction = models.CharField(max_length=20, choices=Direction.choices, default=Direction.TO_MEMBER)
	created_at = models.DateTimeField(auto_now_add=True)
	read_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['patient', 'created_at']),
		]

	def mark_read(self):
		if not self.read_at:
			self.read_at = timezone.now()
			self.save(update_fields=['read_at'])


class SystemSettings(models.Model):
	"""System-wide configuration settings"""
	
	class SettingKey(models.TextChoices):
		PREAUTH_THRESHOLD = 'PREAUTH_THRESHOLD', 'Pre-authorization Threshold'
		DEFAULT_WAITING_PERIOD = 'DEFAULT_WAITING_PERIOD', 'Default Waiting Period (days)'
		MAX_CLAIM_AMOUNT = 'MAX_CLAIM_AMOUNT', 'Maximum Claim Amount'
		AUTO_APPROVAL_ENABLED = 'AUTO_APPROVAL_ENABLED', 'Auto-approval Enabled'
		FRAUD_DETECTION_ENABLED = 'FRAUD_DETECTION_ENABLED', 'Fraud Detection Enabled'
	
	key = models.CharField(max_length=50, choices=SettingKey.choices, unique=True)
	value = models.CharField(max_length=255, help_text='Setting value as string')
	value_type = models.CharField(max_length=20, choices=[
		('string', 'String'),
		('integer', 'Integer'),
		('decimal', 'Decimal'),
		('boolean', 'Boolean'),
	], default='string')
	description = models.TextField(blank=True, help_text='Description of what this setting controls')
	updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
	updated_at = models.DateTimeField(auto_now=True)
	created_at = models.DateTimeField(auto_now_add=True)
	
	class Meta:
		verbose_name = 'System Setting'
		verbose_name_plural = 'System Settings'
		ordering = ['key']
	
	def __str__(self):
		return f"{self.key}: {self.value}"
	
	@property
	def typed_value(self):
		"""Return the value converted to its appropriate type"""
		if self.value_type == 'integer':
			try:
				return int(self.value)
			except ValueError:
				return 0
		elif self.value_type == 'decimal':
			try:
				from decimal import Decimal
				return Decimal(self.value)
			except:
				return Decimal('0.00')
		elif self.value_type == 'boolean':
			return self.value.lower() in ('true', '1', 'yes', 'on')
		else:
			return self.value
	
	@classmethod
	def get_setting(cls, key, default=None):
		"""Get a setting value by key, with optional default"""
		try:
			setting = cls.objects.get(key=key)
			return setting.typed_value
		except cls.DoesNotExist:
			return default
	
	@classmethod
	def set_setting(cls, key, value, value_type='string', description='', user=None):
		"""Set or update a setting value"""
		setting, created = cls.objects.get_or_create(
			key=key,
			defaults={
				'value': str(value),
				'value_type': value_type,
				'description': description,
				'updated_by': user
			}
		)
		if not created:
			setting.value = str(value)
			setting.value_type = value_type
			setting.description = description
			setting.updated_by = user
			setting.save()
		return setting


def member_document_path(instance, filename: str) -> str:
	return f"member_docs/patient_{instance.patient_id}/{filename}"


class MemberDocument(models.Model):
	class DocType(models.TextChoices):
		ID = 'ID', 'Identity Document'
		ADDRESS = 'ADDRESS', 'Proof of Address'
		CARD = 'CARD', 'Medical Aid Card'
		OTHER = 'OTHER', 'Other'

	patient = models.ForeignKey('claims.Patient', on_delete=models.CASCADE, related_name='documents')
	uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_member_documents')
	file = models.FileField(upload_to=member_document_path)
	doc_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.OTHER)
	notes = models.CharField(max_length=255, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['patient', 'created_at']),
		]


class EDITransaction(models.Model):
	"""Tracks EDI transactions for claims, payments, and other healthcare data exchange"""

	class TransactionType(models.TextChoices):
		CLAIM_SUBMISSION = 'CLAIM_SUBMISSION', 'Claim Submission (837)'
		CLAIM_STATUS = 'CLAIM_STATUS', 'Claim Status Inquiry (276)'
		PAYMENT_ADVICE = 'PAYMENT_ADVICE', 'Payment/Remittance Advice (835)'
		ELIGIBILITY = 'ELIGIBILITY', 'Eligibility Inquiry (270)'
		ENROLLMENT = 'ENROLLMENT', 'Enrollment/Disenrollment (834)'

	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		SENT = 'SENT', 'Sent'
		ACCEPTED = 'ACCEPTED', 'Accepted'
		REJECTED = 'REJECTED', 'Rejected'
		ERROR = 'ERROR', 'Error'

	transaction_id = models.CharField(max_length=50, unique=True, help_text='Unique EDI transaction identifier')
	transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

	# Sender/Receiver information
	sender_id = models.CharField(max_length=15, help_text='ISA sender ID')
	receiver_id = models.CharField(max_length=15, help_text='ISA receiver ID')
	provider = models.ForeignKey('accounts.ProviderProfile', on_delete=models.CASCADE, null=True, blank=True, related_name='edi_transactions')

	# EDI content
	x12_content = models.TextField(help_text='Original X12 EDI content')
	parsed_data = models.JSONField(null=True, blank=True, help_text='Parsed EDI data structure')

	# Processing details
	submitted_at = models.DateTimeField(auto_now_add=True)
	processed_at = models.DateTimeField(null=True, blank=True)
	response_received_at = models.DateTimeField(null=True, blank=True)

	# Response tracking
	response_transaction_id = models.CharField(max_length=50, blank=True, help_text='Response transaction ID')
	response_content = models.TextField(blank=True, help_text='EDI response content')
	response_parsed_data = models.JSONField(null=True, blank=True, help_text='Parsed response data')

	# Error handling
	error_code = models.CharField(max_length=10, blank=True, help_text='EDI error code')
	error_message = models.TextField(blank=True, help_text='Error description')
	validation_errors = models.JSONField(null=True, blank=True, help_text='Detailed validation errors')

	# Metadata
	control_number = models.CharField(max_length=9, blank=True, help_text='ISA control number')
	group_control_number = models.CharField(max_length=9, blank=True, help_text='GS control number')
	segment_count = models.PositiveIntegerField(default=0, help_text='Number of EDI segments')

	# Related business objects
	claim = models.ForeignKey('claims.Claim', on_delete=models.SET_NULL, null=True, blank=True, related_name='edi_transactions')
	patient = models.ForeignKey('claims.Patient', on_delete=models.SET_NULL, null=True, blank=True, related_name='edi_transactions')

	class Meta:
		ordering = ['-submitted_at']
		indexes = [
			models.Index(fields=['transaction_id']),
			models.Index(fields=['status', 'submitted_at']),
			models.Index(fields=['provider', 'status']),
			models.Index(fields=['transaction_type', 'status']),
		]

	def __str__(self):
		return f"{self.transaction_type} - {self.transaction_id} - {self.status}"

	def mark_sent(self):
		"""Mark transaction as sent"""
		self.status = self.Status.SENT
		self.processed_at = timezone.now()
		self.save(update_fields=['status', 'processed_at'])

	def mark_accepted(self, response_transaction_id=None):
		"""Mark transaction as accepted"""
		self.status = self.Status.ACCEPTED
		self.response_received_at = timezone.now()
		if response_transaction_id:
			self.response_transaction_id = response_transaction_id
		self.save(update_fields=['status', 'response_received_at', 'response_transaction_id'])

	def mark_rejected(self, error_code='', error_message='', validation_errors=None):
		"""Mark transaction as rejected with error details"""
		self.status = self.Status.REJECTED
		self.error_code = error_code
		self.error_message = error_message
		if validation_errors:
			self.validation_errors = validation_errors
		self.response_received_at = timezone.now()
		self.save(update_fields=['status', 'error_code', 'error_message', 'validation_errors', 'response_received_at'])

	def mark_error(self, error_message='', validation_errors=None):
		"""Mark transaction as having processing errors"""
		self.status = self.Status.ERROR
		self.error_message = error_message
		if validation_errors:
			self.validation_errors = validation_errors
		self.save(update_fields=['status', 'error_message', 'validation_errors'])


class EDIValidationRule(models.Model):
	"""Validation rules for EDI transactions"""

	class RuleType(models.TextChoices):
		REQUIRED_SEGMENT = 'REQUIRED_SEGMENT', 'Required Segment'
		REQUIRED_ELEMENT = 'REQUIRED_ELEMENT', 'Required Element'
		FORMAT_VALIDATION = 'FORMAT_VALIDATION', 'Format Validation'
		CODE_VALIDATION = 'CODE_VALIDATION', 'Code Validation'
		CROSS_REFERENCE = 'CROSS_REFERENCE', 'Cross Reference'

	rule_name = models.CharField(max_length=100, unique=True)
	rule_type = models.CharField(max_length=20, choices=RuleType.choices)
	description = models.TextField(blank=True)

	# Rule configuration
	segment_id = models.CharField(max_length=3, blank=True, help_text='EDI segment identifier (e.g., ISA, GS, ST)')
	element_position = models.PositiveIntegerField(null=True, blank=True, help_text='Element position within segment')
	element_name = models.CharField(max_length=50, blank=True, help_text='Name of the element being validated')

	# Validation parameters
	required = models.BooleanField(default=False)
	min_length = models.PositiveIntegerField(null=True, blank=True)
	max_length = models.PositiveIntegerField(null=True, blank=True)
	valid_codes = models.JSONField(null=True, blank=True, help_text='List of valid codes for this element')
	regex_pattern = models.CharField(max_length=255, blank=True, help_text='Regex pattern for validation')

	# Error configuration
	error_code = models.CharField(max_length=10, help_text='Error code to return on validation failure')
	error_message = models.TextField(help_text='Error message for validation failure')

	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['rule_name']
		indexes = [
			models.Index(fields=['rule_type', 'is_active']),
			models.Index(fields=['segment_id', 'is_active']),
		]

	def __str__(self):
		return f"{self.rule_name} - {self.rule_type}"

	def validate_element(self, value):
		"""Validate a single element against this rule"""
		errors = []

		# Required check
		if self.required and (value is None or str(value).strip() == ''):
			errors.append({
				'code': self.error_code,
				'message': self.error_message,
				'element': self.element_name,
				'value': value
			})
			return errors

		# Skip further validation if value is empty and not required
		if value is None or str(value).strip() == '':
			return errors

		value_str = str(value)

		# Length validation
		if self.min_length and len(value_str) < self.min_length:
			errors.append({
				'code': self.error_code,
				'message': f"{self.element_name} must be at least {self.min_length} characters",
				'element': self.element_name,
				'value': value
			})

		if self.max_length and len(value_str) > self.max_length:
			errors.append({
				'code': self.error_code,
				'message': f"{self.element_name} must not exceed {self.max_length} characters",
				'element': self.element_name,
				'value': value
			})

		# Code validation
		if self.valid_codes and value_str not in self.valid_codes:
			errors.append({
				'code': self.error_code,
				'message': f"{self.element_name} must be one of: {', '.join(self.valid_codes)}",
				'element': self.element_name,
				'value': value
			})

		# Regex validation
		if self.regex_pattern:
			import re
			if not re.match(self.regex_pattern, value_str):
				errors.append({
					'code': self.error_code,
					'message': f"{self.element_name} format is invalid",
					'element': self.element_name,
					'value': value
				})

		return errors


class SystemSettings(models.Model):
	"""System-wide configuration settings"""

	class ValueType(models.TextChoices):
		STRING = 'STRING', 'String'
		INTEGER = 'INTEGER', 'Integer'
		DECIMAL = 'DECIMAL', 'Decimal'
		BOOLEAN = 'BOOLEAN', 'Boolean'
		JSON = 'JSON', 'JSON'

	key = models.CharField(max_length=100, unique=True, help_text="Setting key (e.g., 'preauth_threshold')")
	value = models.TextField(help_text="Setting value")
	value_type = models.CharField(max_length=20, choices=ValueType.choices, default=ValueType.STRING)
	description = models.TextField(blank=True, help_text="Description of the setting")

	# Audit fields
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	updated_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='updated_settings'
	)

	class Meta:
		verbose_name = "System Setting"
		verbose_name_plural = "System Settings"
		ordering = ['key']

	def __str__(self):
		return f"{self.key}: {self.value}"

	@property
	def typed_value(self):
		"""Return the value converted to the appropriate Python type"""
		if self.value_type == self.ValueType.INTEGER:
			return int(self.value)
		elif self.value_type == self.ValueType.DECIMAL:
			return float(self.value)
		elif self.value_type == self.ValueType.BOOLEAN:
			return self.value.lower() in ('true', '1', 'yes', 'on')
		elif self.value_type == self.ValueType.JSON:
			import json
			return json.loads(self.value)
		else:
			return self.value

	@classmethod
	def get_setting(cls, key: str, default=None):
		"""Retrieve a system setting by key"""
		try:
			setting = cls.objects.get(key=key)
			return setting.typed_value
		except cls.DoesNotExist:
			return default

