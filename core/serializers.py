from rest_framework import serializers
from .models import SystemSettings, EDITransaction, EDIValidationRule
from accounts.models import ProviderProfile
from django.utils import timezone


class SystemSettingsSerializer(serializers.ModelSerializer):
	"""Serializer for system settings"""
	
	updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
	
	class Meta:
		model = SystemSettings
		fields = [
			'id', 'key', 'value', 'value_type', 'description', 
			'updated_by_name', 'updated_at', 'created_at'
		]
		read_only_fields = ['id', 'updated_at', 'created_at']
	
	def validate_key(self, value):
		"""Validate that the key is a valid choice"""
		from .models import SettingKey
		valid_keys = [choice[0] for choice in SettingKey.choices]
		if value not in valid_keys:
			raise serializers.ValidationError(f"Invalid setting key. Valid keys: {valid_keys}")
		return value
	
	def validate(self, data):
		"""Validate the value based on value_type"""
		value_type = data.get('value_type', self.instance.value_type if self.instance else 'string')
		# Normalize to lowercase for comparison (model may use uppercase enum values)
		vt = str(value_type).lower() if value_type is not None else 'string'
		value = data.get('value')
		
		if vt == 'integer':
			try:
				int(str(value))
			except (ValueError, TypeError):
				raise serializers.ValidationError("Value must be a valid integer")
		elif vt == 'decimal':
			try:
				from decimal import Decimal
				Decimal(str(value))
			except:
				raise serializers.ValidationError("Value must be a valid decimal number")
		elif vt == 'boolean':
			val_str = str(value).lower() if value is not None else ''
			if val_str not in ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']:
				raise serializers.ValidationError("Value must be a valid boolean (true/false, 1/0, yes/no, on/off)")
		
		return data


class EDITransactionSerializer(serializers.ModelSerializer):
	"""Serializer for EDI transactions"""

	provider_name = serializers.CharField(source='provider.facility_name', read_only=True)
	claim_reference = serializers.CharField(source='claim.reference_number', read_only=True)
	patient_member_id = serializers.CharField(source='patient.member_id', read_only=True)

	class Meta:
		model = EDITransaction
		fields = [
			'id', 'transaction_id', 'transaction_type', 'status',
			'sender_id', 'receiver_id', 'provider', 'provider_name',
			'x12_content', 'parsed_data', 'submitted_at', 'processed_at',
			'response_received_at', 'response_transaction_id', 'response_content',
			'response_parsed_data', 'error_code', 'error_message', 'validation_errors',
			'control_number', 'group_control_number', 'segment_count',
			'claim', 'claim_reference', 'patient', 'patient_member_id'
		]
		read_only_fields = [
			'id', 'transaction_id', 'submitted_at', 'processed_at',
			'response_received_at', 'parsed_data', 'response_parsed_data',
			'segment_count', 'provider_name', 'claim_reference', 'patient_member_id'
		]


class EDIValidationRuleSerializer(serializers.ModelSerializer):
	"""Serializer for EDI validation rules"""

	class Meta:
		model = EDIValidationRule
		fields = [
			'id', 'rule_name', 'rule_type', 'description', 'segment_id',
			'element_position', 'element_name', 'required', 'min_length',
			'max_length', 'valid_codes', 'regex_pattern', 'error_code',
			'error_message', 'is_active', 'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']


class EDISubmitSerializer(serializers.Serializer):
	"""Serializer for EDI submission requests"""

	x12_content = serializers.CharField(required=True, help_text='X12 EDI content to submit')
	transaction_type = serializers.ChoiceField(
		choices=EDITransaction.TransactionType.choices,
		default=EDITransaction.TransactionType.CLAIM_SUBMISSION,
		help_text='Type of EDI transaction'
	)
	claim_id = serializers.IntegerField(required=False, help_text='Associated claim ID')
	patient_id = serializers.IntegerField(required=False, help_text='Associated patient ID')

	def validate_x12_content(self, value):
		"""Basic validation of X12 content"""
		if not value or not value.strip():
			raise serializers.ValidationError("X12 content cannot be empty")

		# Check for basic X12 structure
		if not value.startswith('ISA'):
			raise serializers.ValidationError("X12 content must start with ISA segment")

		return value


class EDIResponseSerializer(serializers.Serializer):
	"""Serializer for EDI processing responses"""

	status = serializers.CharField()
	transaction_id = serializers.CharField()
	message = serializers.CharField()
	segment_count = serializers.IntegerField()
	validation_errors = serializers.ListField(child=serializers.DictField(), required=False)
	parsed_data = serializers.DictField(required=False)


class ProviderDirectorySerializer(serializers.ModelSerializer):
	"""Serializer for provider directory listings"""

	username = serializers.CharField(source='user.username', read_only=True)
	email = serializers.EmailField(source='user.email', read_only=True)
	network_memberships = serializers.SerializerMethodField()
	performance_metrics = serializers.SerializerMethodField()
	is_active = serializers.SerializerMethodField()

	class Meta:
		model = ProviderProfile
		fields = [
			'id', 'username', 'email', 'facility_name', 'facility_type',
			'phone', 'address', 'city', 'network_memberships',
			'performance_metrics', 'is_active'
		]

	def get_network_memberships(self, obj):
		"""Get active network memberships"""
		memberships = obj.user.network_memberships.filter(status='ACTIVE')
		return [
			{
				'scheme_name': membership.scheme.name,
				'status': membership.status,
				'credential_status': membership.credential_status,
				'effective_from': membership.effective_from,
				'effective_to': membership.effective_to
			}
			for membership in memberships
		]

	def get_performance_metrics(self, obj):
		"""Get performance metrics from annotations"""
		return {
			'total_claims_90d': getattr(obj, 'total_claims', 0),
			'approved_claims_90d': getattr(obj, 'approved_claims', 0),
			'total_invoices_90d': getattr(obj, 'total_invoices', 0),
			'active_networks': getattr(obj, 'active_network_memberships', 0),
			'approval_rate': round(
				(getattr(obj, 'approved_claims', 0) / getattr(obj, 'total_claims', 1)) * 100, 2
			) if getattr(obj, 'total_claims', 0) > 0 else 0
		}

	def get_is_active(self, obj):
		"""Check if provider has active network memberships"""
		return obj.user.network_memberships.filter(status='ACTIVE').exists()


class ProviderDetailSerializer(serializers.ModelSerializer):
	"""Detailed serializer for individual provider information"""

	username = serializers.CharField(source='user.username', read_only=True)
	email = serializers.EmailField(source='user.email', read_only=True)
	date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
	last_login = serializers.DateTimeField(source='user.last_login', read_only=True)

	network_memberships = serializers.SerializerMethodField()
	recent_claims = serializers.SerializerMethodField()
	performance_summary = serializers.SerializerMethodField()
	credentialing_status = serializers.SerializerMethodField()

	class Meta:
		model = ProviderProfile
		fields = [
			'id', 'username', 'email', 'facility_name', 'facility_type',
			'phone', 'address', 'city', 'date_joined', 'last_login',
			'network_memberships', 'recent_claims', 'performance_summary',
			'credentialing_status'
		]

	def get_network_memberships(self, obj):
		"""Get all network memberships with details"""
		memberships = obj.user.network_memberships.all()
		return [
			{
				'scheme_name': membership.scheme.name,
				'scheme_category': membership.scheme.category,
				'status': membership.status,
				'credential_status': membership.credential_status,
				'effective_from': membership.effective_from,
				'effective_to': membership.effective_to,
				'notes': membership.notes,
				'documents_count': membership.documents.count(),
				'pending_documents': membership.documents.filter(status='PENDING').count()
			}
			for membership in memberships
		]

	def get_recent_claims(self, obj):
		"""Get recent claims (last 30 days)"""
		from django.utils import timezone
		thirty_days_ago = timezone.now() - timezone.timedelta(days=30)

		claims = obj.user.claims_made.filter(
			created_at__gte=thirty_days_ago
		).select_related('patient', 'service_type')[:10]

		return [
			{
				'reference_number': claim.reference_number,
				'patient_member_id': claim.patient.member_id,
				'service_type': claim.service_type.name,
				'cost': str(claim.cost),
				'status': claim.status,
				'created_at': claim.created_at
			}
			for claim in claims
		]

	def get_performance_summary(self, obj):
		"""Get comprehensive performance metrics"""
		from django.db.models import Q
		from django.utils import timezone

		# Last 90 days metrics
		ninety_days_ago = timezone.now() - timezone.timedelta(days=90)

		claims_90d = obj.user.submitted_claims.filter(created_at__gte=ninety_days_ago)
		total_claims = claims_90d.count()
		approved_claims = claims_90d.filter(status='APPROVED').count()
		rejected_claims = claims_90d.filter(status='REJECTED').count()
		pending_claims = claims_90d.filter(status='PENDING').count()

		invoices_90d = obj.user.processed_claims.filter(created_at__gte=ninety_days_ago)  # Use processed claims
		total_invoices = invoices_90d.count()
		paid_invoices = invoices_90d.filter(status='APPROVED').count()  # Use approved as proxy for paid

		return {
			'period_days': 90,
			'claims': {
				'total': total_claims,
				'approved': approved_claims,
				'rejected': rejected_claims,
				'pending': pending_claims,
				'approval_rate': round((approved_claims / total_claims * 100), 2) if total_claims > 0 else 0
			},
			'invoices': {
				'total': total_invoices,
				'paid': paid_invoices,
				'payment_rate': round((paid_invoices / total_invoices * 100), 2) if total_invoices > 0 else 0
			}
		}

	def get_credentialing_status(self, obj):
		"""Get credentialing status summary"""
		memberships = obj.user.network_memberships.all()

		total_memberships = memberships.count()
		approved_credentials = memberships.filter(credential_status='APPROVED').count()
		pending_credentials = memberships.filter(credential_status='PENDING').count()
		rejected_credentials = memberships.filter(credential_status='REJECTED').count()

		return {
			'total_memberships': total_memberships,
			'approved_credentials': approved_credentials,
			'pending_credentials': pending_credentials,
			'rejected_credentials': rejected_credentials,
			'completion_rate': round((approved_credentials / total_memberships * 100), 2) if total_memberships > 0 else 0
		}


# Network Status Serializers

class ProviderNetworkStatusSerializer(serializers.Serializer):
    """Serializer for provider network status data"""

    provider = serializers.DictField()
    scheme = serializers.DictField()
    network_membership = serializers.DictField()
    real_time_status = serializers.DictField()
    network_health = serializers.DictField()
    performance_metrics = serializers.DictField()
    alerts = serializers.ListField()


class ProviderNetworkDashboardSerializer(serializers.Serializer):
    """Serializer for provider network dashboard data"""

    timestamp = serializers.DateTimeField()
    network_overview = serializers.DictField()
    credentialing_status = serializers.DictField()
    facility_breakdown = serializers.DictField()
    critical_alerts = serializers.ListField()
    alerts_count = serializers.IntegerField()
    average_health_score = serializers.FloatField()
