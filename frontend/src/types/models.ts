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
  benefits?: SchemeBenefit[];
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
