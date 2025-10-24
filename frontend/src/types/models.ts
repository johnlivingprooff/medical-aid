/**
 * Complete TypeScript type definitions for Medical Aid Management System
 * Aligned with Django backend models
 */

// User and Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'PROVIDER' | 'PATIENT';
  is_active: boolean;
  date_joined: string;
  last_login?: string;
}

export interface ProviderProfile {
  id: number;
  user: number;
  facility_name: string;
  facility_type: 'HOSPITAL' | 'CLINIC' | 'PHARMACY' | 'LAB' | 'IMAGING';
  phone: string;
  address: string;
  city: string;
}

// Patient and Member Types
export interface Patient {
  id: number;
  user: number;
  user_username: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  user_date_joined: string;
  member_id: string;
  date_of_birth: string;
  gender: 'M' | 'F' | 'O';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';
  scheme: number;
  scheme_name: string;
  enrollment_date: string;
  benefit_year_start?: string;
  principal_member?: number;
  relationship: 'PRINCIPAL' | 'SPOUSE' | 'CHILD' | 'DEPENDENT';
  phone: string;
  emergency_contact: string;
  emergency_phone: string;
  diagnoses: string;
  investigations: string;
  treatments: string;
  last_claim_date?: string;
  next_renewal?: string;
  first_name?: string;
  last_name?: string;
}

// Scheme and Benefit Types
export interface SchemeCategory {
  id: number;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  benefits?: SchemeBenefit[];
  subscription_tiers?: SubscriptionTier[];
}

export interface BenefitType {
  id: number;
  name: string;
}

export interface SchemeBenefit {
  id: number;
  scheme: number;
  benefit_type: number;
  benefit_type_detail: BenefitType;
  coverage_amount?: number;
  coverage_limit_count?: number;
  coverage_period: 'PER_VISIT' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME' | 'BENEFIT_YEAR';
  deductible_amount: number;
  copayment_percentage: number;
  copayment_fixed: number;
  requires_preauth: boolean;
  preauth_limit?: number;
  waiting_period_days: number;
  network_only: boolean;
  is_active: boolean;
  effective_date: string;
  expiry_date?: string;
}

// Claim Types
export interface Claim {
  id: number;
  patient: number;
  patient_detail: Patient;
  provider: number;
  provider_username: string;
  provider_facility_name: string;
  service_type: number;
  service_type_name: string;
  cost: number;
  date_submitted: string;
  date_of_service: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_PREAUTH' | 'INVESTIGATING';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  coverage_checked: boolean;
  processed_date?: string;
  processed_by?: number;
  diagnosis_code: string;
  procedure_code: string;
  notes: string;
  preauth_number: string;
  preauth_expiry?: string;
  rejection_reason: string;
  rejection_date?: string;
}

// Invoice Types
export interface Invoice {
  id: number;
  claim: number;
  amount: number;
  payment_status: 'PENDING' | 'PAID' | 'PARTIAL' | 'CANCELLED' | 'DISPUTED';
  amount_paid: number;
  payment_date?: string;
  payment_reference: string;
  patient_deductible: number;
  patient_copay: number;
  patient_coinsurance: number;
  created_at: string;
  updated_at: string;
  provider_bank_account: string;
  provider_bank_name: string;
  total_patient_responsibility?: number;
  amount_outstanding?: number;
}

// Alert Types
export interface Alert {
  id: number;
  type: 'LOW_BALANCE' | 'FRAUD_SUSPECT' | 'SCHEME_ABUSE';
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  patient?: number;
  created_at: string;
  is_read: boolean;
}

// Analytics Types (extend existing ones)
export interface DashboardStats {
  kpis: {
    active_members: number;
    total_claims_period: number;
    claim_value_approved: number;
    pending_claim_value: number;
    utilization_rate: number;
    avg_processing_days: number;
  };
  status_snapshot: Record<string, { count: number; amount: number }>;
  scheme_utilization: Array<{ patient__scheme__name: string; total_amount: number; total_claims: number }>;
}

export interface ProvidersAnalytics {
  results: Array<{
    provider_id: number;
    provider: string;
    total_claims: number;
    approved_claims: number;
    rejected_claims: number;
    pending_claims: number;
    total_amount: number;
    approved_amount: number;
    pending_amount: number;
    approval_rate: number;
    avg_processing_days: number;
  }>;
}

export interface MembersAnalytics {
  results: Array<{
    member_id: string;
    member: string;
    scheme: string;
    total_claims: number;
    approved_amount: number;
    enrollment_date: string;
    status: string;
  }>;
}

export interface SchemesAnalytics {
  results: Array<{
    id: number;
    name: string;
    members_count: number;
    total_claims_30d: number;
    total_amount_30d: number;
    utilization_rate: number;
  }>;
}

// Coverage Balance Types
export interface CoverageBalance {
  scheme: string;
  balances: Array<{
    benefit_type: number;
    benefit_type_name: string;
    coverage_amount?: number;
    used_amount: number;
    remaining_amount?: number;
    coverage_limit_count?: number;
    remaining_count?: number;
    coverage_period: string;
  }>;
}

// Form Types
export interface ClaimSubmissionForm {
  patient: number;
  service_type: number;
  cost: string;
  date_of_service: string;
  diagnosis_code?: string;
  procedure_code?: string;
  notes?: string;
  preauth_number?: string;
}

export interface SchemeForm {
  name: string;
  description: string;
  price: number;
}

export interface BenefitForm {
  scheme: number;
  benefit_type: number;
  coverage_amount?: number;
  coverage_limit_count?: number;
  coverage_period: string;
  deductible_amount?: number;
  copayment_percentage?: number;
  copayment_fixed?: number;
  requires_preauth?: boolean;
  preauth_limit?: number;
  waiting_period_days?: number;
  network_only?: boolean;
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface TokenRefreshRequest {
  refresh: string;
}

export interface TokenRefreshResponse {
  access: string;
}

// Subscription Types
export interface BenefitCategory {
  id: number;
  name: string;
  description: string;
  subscription_required: boolean;
  access_rules: Record<string, any>;
}

export interface SubscriptionTier {
  id: number;
  name: string;
  scheme: number;
  scheme_name: string;
  tier_type: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  description: string;
  monthly_price: number;
  yearly_price: number;
  max_dependents: number;
  max_claims_per_month?: number;
  max_coverage_per_year?: number;
  benefit_categories: BenefitCategory[];
  benefit_category_ids: number[];
  is_active: boolean;
  sort_order: number;
}

export interface MemberSubscription {
  id: number;
  patient: number;
  patient_detail: {
    id: number;
    member_id: string;
    user: {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
    };
  };
  tier: number;
  tier_detail: SubscriptionTier;
  subscription_type: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  last_payment_date?: string;
  next_payment_date?: string;
  claims_this_month: number;
  coverage_used_this_year: number;
  usage_stats: SubscriptionUsageStats;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsageStats {
  claims_this_month: number;
  max_claims_per_month?: number;
  coverage_used_this_year: number;
  max_coverage_per_year?: number;
  remaining_coverage?: number;
  subscription_status: string;
  is_active: boolean;
  tier_name: string;
  monthly_price: number;
  yearly_price: number;
}

export interface SubscriptionCreateRequest {
  patient_id: number;
  tier_id: number;
  subscription_type: 'MONTHLY' | 'YEARLY';
  start_date?: string;
}

export interface SubscriptionUpgradeRequest {
  new_tier_id: number;
}

export interface SubscriptionAnalytics {
  total_subscriptions: number;
  active_subscriptions: number;
  suspended_subscriptions: number;
  cancelled_subscriptions: number;
  active_percentage: number;
  tier_distribution: Record<string, number>;
}

// Notification Types
export type NotificationType =
  | 'CLAIM_STATUS_UPDATE'
  | 'CREDENTIALING_UPDATE'
  | 'DOCUMENT_REVIEWED'
  | 'MEMBERSHIP_EXPIRING'
  | 'PAYMENT_PROCESSED'
  | 'SYSTEM_MAINTENANCE'
  | 'GENERAL_ANNOUNCEMENT';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: number;
  recipient: number;
  recipient_name: string;
  recipient_role: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  html_message: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  is_read: boolean;
  related_claim_id?: number;
  related_membership_id?: number;
  related_document_id?: number;
  metadata: Record<string, any>;
  scheduled_for?: string;
  sent_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
  time_since_created: string;
  related_claim?: {
    id: number;
    claim_number: string;
    status: string;
    cost: string;
    date_of_service: string;
  };
  related_membership?: {
    id: number;
    scheme_name: string;
    status: string;
    effective_from: string;
    effective_to?: string;
  };
  related_document?: {
    id: number;
    doc_type: string;
    file_name: string;
    status: string;
    uploaded_at: string;
  };
  logs?: NotificationLog[];
}

export interface NotificationLog {
  id: number;
  notification: number;
  notification_title: string;
  recipient_name: string;
  action: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface NotificationTemplate {
  id: number;
  name: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  subject_template: string;
  message_template: string;
  html_template: string;
  variables: string[];
  is_active: boolean;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: number;
  user: number;
  user_name: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  claim_updates_enabled: boolean;
  credentialing_updates_enabled: boolean;
  payment_updates_enabled: boolean;
  system_announcements_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  failed: number;
  by_type: Array<{
    notification_type: string;
    count: number;
  }>;
}

export interface NotificationDashboardData {
  recent_notifications: Notification[];
  unread_count: number;
  type_stats: Array<{
    notification_type: string;
    total: number;
    unread: number;
  }>;
  recent_activity: Array<{
    notification_type: string;
    count: number;
  }>;
  preferences?: NotificationPreference;
}

export interface BulkNotificationRequest {
  recipient_ids: number[];
  notification_type: NotificationType;
  title: string;
  message: string;
  html_message?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

export interface SystemAnnouncementRequest {
  title: string;
  message: string;
  html_message?: string;
  target_roles: Array<'ADMIN' | 'PROVIDER' | 'PATIENT'>;
  priority?: NotificationPriority;
}

export interface PaymentMethodCreateRequest {
  payment_type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_ACCOUNT' | 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'DIGITAL_WALLET';
  provider: 'STRIPE' | 'PAYPAL' | 'PAYFAST' | 'OTHER';
  provider_payment_method_id: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  card_brand?: string;
  bank_name?: string;
  account_holder_name: string;
  is_default?: boolean;
}

export interface SubscriptionInvoice {
  id: number;
  subscription: number;
  subscription_detail: {
    id: number;
    tier_detail: {
      name: string;
      monthly_price: number;
      yearly_price: number;
    };
    subscription_type: 'MONTHLY' | 'YEARLY';
  };
  invoice_number: string;
  amount: number;
  total_amount?: number; // Alias for amount
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  due_date: string;
  paid_date?: string;
  payment_reference?: string;
  billing_start_date?: string;
  billing_end_date?: string;
  line_items: InvoiceLineItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: number;
  description: string;
  amount: number;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface SubscriptionInvoiceCreateRequest {
  subscription_id: number;
  amount: number;
  due_date: string;
  line_items: Array<{
    description: string;
    amount: number;
    quantity: number;
    unit_price: number;
  }>;
  notes?: string;
}

export interface SubscriptionPayment {
  id: number;
  invoice: number;
  invoice_detail: SubscriptionInvoice;
  payment_method: number;
  payment_method_detail: PaymentMethod;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  payment_reference: string;
  payment_id?: string; // Alias for payment_reference
  provider_transaction_id?: string;
  transaction_id?: string; // Alias for provider_transaction_id
  failure_reason?: string;
  refunded_amount: number;
  processed_at?: string;
  payment_date?: string; // Alias for processed_at
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPaymentCreateRequest {
  invoice_id: number;
  payment_method_id: number;
  amount: number;
}

export interface RefundRequest {
  amount: number;
  reason: string;
}

export interface BillingHistory {
  id: number;
  subscription: number;
  subscription_detail: {
    id: number;
    tier_detail: {
      name: string;
    };
  };
  invoice?: number;
  invoice_detail?: SubscriptionInvoice;
  payment?: number;
  payment_detail?: SubscriptionPayment;
  activity_type: 'INVOICE_CREATED' | 'PAYMENT_PROCESSED' | 'PAYMENT_FAILED' | 'REFUND_PROCESSED' | 'SUBSCRIPTION_RENEWED' | 'SUBSCRIPTION_CANCELLED';
  action?: string; // Alias for activity_type
  description: string;
  amount?: number;
  created_at: string;
  timestamp?: string; // Alias for created_at
}

export interface BillingOverview {
  total_outstanding: number;
  total_paid_this_month: number;
  total_overdue: number;
  upcoming_payments: Array<{
    subscription_id: number;
    tier_name: string;
    amount: number;
    due_date: string;
  }>;
  recent_payments: SubscriptionPayment[];
  payment_methods_count: number;
}

export interface PaymentStats {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  refunded_amount: number;
  average_payment_amount: number;
  payment_method_distribution: Record<string, number>;
  monthly_revenue: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
}

// Billing App Types (from billing app models)
export interface PaymentMethod {
  id: number;
  subscription: number;
  payment_type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_ACCOUNT' | 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'DIGITAL_WALLET';
  provider: 'STRIPE' | 'PAYPAL' | 'PAYFAST' | 'OTHER';
  account_number?: string;
  account_number_masked?: string;
  expiry_date?: string;
  expiry_month?: number;
  expiry_year?: number;
  card_brand?: string;
  card_holder_name?: string;
  card_number_masked?: string;
  paypal_email?: string;
  bank_name?: string;
  account_holder_name?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  subscription: number;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  amount: number;
  tax_amount: number;
  discount_amount: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  payment_method?: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  invoice: number;
  payment_method: number;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  transaction_id?: string;
  payment_date: string;
  processed_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BillingCycle {
  id: number;
  subscription: number;
  billing_date: string;
  due_date: string;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  payment_method?: number;
  invoice?: number;
  retry_count: number;
  max_retries: number;
  next_retry_date?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BillingSettings {
  id: number;
  default_payment_provider: 'STRIPE' | 'PAYPAL' | 'PAYFAST' | 'OTHER';
  auto_retry_failed_payments: boolean;
  max_retry_attempts: number;
  retry_interval_days: number;
  late_payment_grace_period_days: number;
  default_currency: string;
  tax_rate: number;
  invoice_prefix: string;
  email_invoice_on_creation: boolean;
  email_payment_receipt: boolean;
  created_at: string;
  updated_at: string;
}

// EDI (Electronic Data Interchange) Types
export interface EDITransaction {
  id: number;
  transaction_id: string;
  transaction_type: 'CLAIM_SUBMISSION' | 'CLAIM_STATUS' | 'PAYMENT_ADVICE' | 'ELIGIBILITY' | 'ENROLLMENT';
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'ERROR';
  sender_id: string;
  receiver_id: string;
  provider?: number;
  provider_name?: string;
  claim?: number;
  claim_reference?: string;
  patient?: number;
  patient_member_id?: string;
  x12_content: string;
  parsed_data?: any;
  submitted_at: string;
  processed_at?: string;
  response_received_at?: string;
  response_transaction_id?: string;
  response_content?: string;
  response_parsed_data?: any;
  error_code?: string;
  error_message?: string;
  validation_errors?: Array<{
    code: string;
    message: string;
    element: string;
    segment?: string;
    value?: any;
  }>;
  control_number?: string;
  group_control_number?: string;
  segment_count: number;
}

export interface EDIValidationRule {
  id: number;
  rule_name: string;
  rule_type: 'REQUIRED_SEGMENT' | 'REQUIRED_ELEMENT' | 'FORMAT_VALIDATION' | 'CODE_VALIDATION' | 'CROSS_REFERENCE';
  description: string;
  segment_id: string;
  element_position?: number;
  element_name: string;
  required: boolean;
  min_length?: number;
  max_length?: number;
  valid_codes?: string[];
  regex_pattern?: string;
  error_code: string;
  error_message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Provider Network Types
export interface ProviderNetworkStatus {
  provider: {
    id: number;
    username: string;
    facility_name: string;
    facility_type: string;
    city: string;
  };
  scheme: {
    id: number;
    name: string;
    category: string;
  };
  network_membership: {
    status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    credential_status: 'APPROVED' | 'PENDING' | 'REJECTED';
    effective_from: string;
    effective_to?: string;
    notes?: string;
  };
  real_time_status: {
    is_active: boolean;
    is_credentialed: boolean;
    days_until_expiry?: number;
    last_activity?: string;
    activity_status: 'ACTIVE' | 'MODERATE' | 'INACTIVE';
  };
  network_health: {
    health_score: number;
    health_status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    documents: {
      total: number;
      approved: number;
      pending: number;
      rejected: number;
      completion_rate: number;
    };
  };
  performance_metrics: {
    period_days: number;
    claims: {
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      approval_rate: number;
    };
    processing?: {
      average_days?: number;
      claims_processed: number;
    };
  };
  alerts: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    action_required: string;
  }>;
}

export interface ProviderNetworkDashboard {
  timestamp: string;
  network_overview: {
    total_memberships: number;
    active_memberships: number;
    pending_memberships: number;
    suspended_memberships: number;
    active_rate: number;
  };
  credentialing_status: {
    approved: number;
    pending: number;
    rejected: number;
    completion_rate: number;
  };
  facility_breakdown: Record<string, number>;
  critical_alerts: Array<{
    type: string;
    provider: string;
    scheme: string;
    days_until_expiry?: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  alerts_count: number;
  average_health_score: number;
}

export interface ProviderDirectory {
  id: number;
  username: string;
  email: string;
  facility_name: string;
  facility_type: 'HOSPITAL' | 'CLINIC' | 'PHARMACY' | 'LAB' | 'IMAGING';
  phone: string;
  address: string;
  city: string;
  network_memberships: Array<{
    scheme_name: string;
    status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    credential_status: 'APPROVED' | 'PENDING' | 'REJECTED';
    effective_from: string;
    effective_to?: string;
  }>;
  performance_metrics: {
    total_claims_90d: number;
    approved_claims_90d: number;
    total_invoices_90d: number;
    active_networks: number;
    approval_rate: number;
  };
  is_active: boolean;
}

export interface ProviderDetail extends ProviderDirectory {
  date_joined: string;
  last_login?: string;
  network_memberships: Array<{
    scheme_name: string;
    scheme_category: string;
    status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    credential_status: 'APPROVED' | 'PENDING' | 'REJECTED';
    effective_from: string;
    effective_to?: string;
    notes?: string;
    documents_count: number;
    pending_documents: number;
  }>;
  recent_claims: Array<{
    reference_number: string;
    patient_member_id: string;
    service_type: string;
    cost: string;
    status: string;
    created_at: string;
  }>;
  performance_summary: {
    period_days: number;
    claims: {
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      approval_rate: number;
    };
    invoices: {
      total: number;
      paid: number;
      payment_rate: number;
    };
  };
  credentialing_status: {
    total_memberships: number;
    approved_credentials: number;
    pending_credentials: number;
    rejected_credentials: number;
    completion_rate: number;
  };
}

// Credentialing Types
export interface ProviderNetworkMembership {
  id: number;
  provider: number;
  provider_username: string;
  scheme: number;
  scheme_name: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REVOKED';
  credential_status: 'APPROVED' | 'PENDING' | 'REJECTED';
  effective_from: string;
  effective_to?: string;
  credentialed_at?: string;
  notes?: string;
  meta?: Record<string, any>;
}

export interface CredentialingDocument {
  id: number;
  membership: number;
  uploaded_by: number;
  uploaded_by_username: string;
  file: string;
  doc_type: string;
  notes?: string;
  status: 'PENDING' | 'REVIEWED' | 'REJECTED';
  created_at: string;
}

export interface CredentialingReview {
  id: number;
  document: number;
  document_type: string;
  document_file_name: string;
  provider_name: string;
  scheme_name: string;
  reviewer?: number;
  reviewer_name?: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  validation_score?: number;
  review_notes?: string;
  rejection_reason?: string;
  auto_checks_passed?: number;
  manual_checks_required?: number;
  assigned_at?: string;
  reviewed_at?: string;
  due_date?: string;
  escalated_to?: number;
  escalated_to_name?: string;
  escalation_reason?: string;
  review_history?: any;
  days_overdue?: number;
  is_overdue?: boolean;
}

export interface DocumentExpiryAlert {
  id: number;
  document: number;
  document_type: string;
  provider_name: string;
  alert_type: 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';
  days_until_expiry?: number;
  message: string;
  is_acknowledged: boolean;
  acknowledged_by?: number;
  acknowledged_by_name?: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface CredentialingDashboard {
  timestamp: string;
  user_role: 'ADMIN' | 'PROVIDER' | string;
  // Admin
  overview?: {
    total_memberships: number;
    pending_credentialing: number;
    approved_credentialing: number;
    rejected_credentialing: number;
    credentialing_completion_rate: number;
  };
  documents?: {
    total: number;
    pending_reviews: number;
    reviewed: number;
    rejected: number;
    review_completion_rate: number;
  };
  reviews?: {
    total_reviews: number;
    pending: number;
    in_review: number;
    completed: number;
    overdue: number;
  };
  activity?: {
    recent_uploads: number;
    recent_reviews: number;
    period_days: number;
  };
  // Provider
  memberships?: Array<{
    scheme: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    documents: {
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      completion_rate: number;
    };
  }>;
  recent_uploads?: Array<{
    id: number;
    doc_type: string;
    status: string;
    uploaded_at: string;
    notes?: string;
  }>;
  // Reviewer (fallback)
  assigned_reviews?: {
    pending: number;
    in_review: number;
    overdue: number;
    total: number;
  };
  recent_completed?: Array<{
    id: number;
    document_type: string;
    action: string;
    completed_at: string;
    notes?: string;
  }>;
}
