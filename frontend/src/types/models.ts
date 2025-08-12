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
