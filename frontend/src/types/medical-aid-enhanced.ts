/**
 * Enhanced Type Definitions for Medical Aid Business Logic
 * Extends existing types with medical aid specific features
 */

// Enhanced User Types with Medical Aid Context
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
  // Enhanced medical aid fields
  mfa_enabled?: boolean;
  session_count?: number;
  last_activity?: string;
}

// Enhanced Patient with Medical Aid Business Logic
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
  
  // Enhanced medical aid business logic
  benefit_period_type: 'CALENDAR_YEAR' | 'BENEFIT_YEAR' | 'ENROLLMENT_ANNIVERSARY';
  current_benefit_period: BenefitPeriod;
  family_coverage: FamilyCoverage;
  waiting_periods: WaitingPeriod[];
  coverage_status: CoverageStatus;
}

// Benefit Period Management
export interface BenefitPeriod {
  id: number;
  patient: number;
  period_type: 'CALENDAR_YEAR' | 'BENEFIT_YEAR' | 'MONTHLY' | 'QUARTERLY' | 'PER_VISIT' | 'LIFETIME';
  start_date: string;
  end_date: string;
  is_current: boolean;
  utilization_summary: BenefitUtilizationSummary;
}

export interface BenefitUtilizationSummary {
  total_coverage: string;
  total_used: string;
  total_remaining: string;
  utilization_percentage: number;
  claims_count: number;
  last_claim_date?: string;
  benefit_details: BenefitUtilizationDetail[];
}

export interface BenefitUtilizationDetail {
  benefit_type: number;
  benefit_type_name: string;
  coverage_amount?: string;
  used_amount: string;
  remaining_amount?: string;
  coverage_limit_count?: number;
  used_count: number;
  remaining_count?: number;
  coverage_period: string;
  last_used_date?: string;
  is_exhausted: boolean;
  warning_threshold_reached: boolean;
}

// Family Coverage and Relationships
export interface FamilyCoverage {
  principal_member: Patient;
  dependents: Patient[];
  family_limit?: string;
  family_used?: string;
  family_remaining?: string;
  shared_benefits: SharedBenefit[];
  coverage_rules: CoverageRule[];
}

export interface SharedBenefit {
  benefit_type: number;
  benefit_type_name: string;
  is_family_shared: boolean;
  family_limit?: string;
  family_used?: string;
  individual_limits: IndividualLimit[];
}

export interface IndividualLimit {
  patient: number;
  patient_name: string;
  relationship: string;
  limit: string;
  used: string;
  remaining: string;
}

// Waiting Periods
export interface WaitingPeriod {
  id: number;
  patient: number;
  benefit_type: number;
  benefit_type_name: string;
  waiting_period_days: number;
  start_date: string;
  completion_date: string;
  is_completed: boolean;
  days_remaining?: number;
  can_claim: boolean;
}

// Coverage Status
export interface CoverageStatus {
  is_active: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'PENDING_RENEWAL';
  status_reason?: string;
  effective_date: string;
  expiry_date?: string;
  grace_period_end?: string;
  renewal_due_date?: string;
  outstanding_payments?: OutstandingPayment[];
  compliance_issues?: ComplianceIssue[];
}

export interface OutstandingPayment {
  id: number;
  amount: string;
  due_date: string;
  payment_type: 'PREMIUM' | 'COPAYMENT' | 'DEDUCTIBLE' | 'PENALTY';
  description: string;
  is_overdue: boolean;
  days_overdue?: number;
}

export interface ComplianceIssue {
  id: number;
  issue_type: 'DOCUMENTATION' | 'ELIGIBILITY' | 'PAYMENT' | 'FRAUD_SUSPICION';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  date_identified: string;
  resolution_required_by?: string;
  is_resolved: boolean;
  resolution_notes?: string;
}

// Enhanced Claim Types with Business Logic
export interface Claim {
  id: number;
  claim_number: string;
  patient: number;
  patient_detail: Patient;
  provider: number;
  provider_username: string;
  service_type: number;
  service_type_name: string;
  cost: string; // Changed to string for decimal precision
  date_submitted: string;
  date_of_service: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_PREAUTH' | 'INVESTIGATING' | 'PROCESSING';
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
  
  // Enhanced business logic fields
  business_validation: ClaimBusinessValidation;
  financial_breakdown: ClaimFinancialBreakdown;
  fraud_alerts?: FraudAlert[];
  pre_auth_status?: PreAuthorizationStatus;
  workflow_history: ClaimWorkflowStep[];
}

export interface ClaimBusinessValidation {
  is_valid: boolean;
  validation_date: string;
  validation_errors: ValidationError[];
  validation_warnings: ValidationWarning[];
  business_rules_applied: BusinessRule[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  recovery_action?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  impact: string;
  can_proceed: boolean;
}

export interface BusinessRule {
  rule_id: string;
  rule_name: string;
  rule_type: 'ELIGIBILITY' | 'COVERAGE' | 'FINANCIAL' | 'CLINICAL' | 'FRAUD_DETECTION';
  applied: boolean;
  result: 'PASS' | 'FAIL' | 'WARNING';
  details?: string;
}

export interface ClaimFinancialBreakdown {
  claim_amount: string;
  eligible_amount: string;
  deductible_amount: string;
  copayment_fixed: string;
  copayment_percentage: string;
  coinsurance_amount: string;
  total_patient_responsibility: string;
  scheme_payable_amount: string;
  calculation_date: string;
  calculation_notes?: string;
}

export interface FraudAlert {
  id: number;
  alert_type: 'DUPLICATE_CLAIM' | 'EXCESSIVE_BILLING' | 'UNUSUAL_PATTERN' | 'PROVIDER_FLAGGED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  risk_score: number;
  date_flagged: string;
  investigation_status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  resolution_notes?: string;
}

export interface ClaimWorkflowStep {
  id: number;
  step_name: string;
  step_type: 'SUBMISSION' | 'VALIDATION' | 'AUTHORIZATION' | 'PROCESSING' | 'PAYMENT' | 'COMPLETION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  started_at: string;
  completed_at?: string;
  performed_by?: number;
  performed_by_name?: string;
  notes?: string;
  duration_minutes?: number;
}

// Pre-Authorization Types
export interface PreAuthorizationRequest {
  id: number;
  request_number: string;
  patient: number;
  patient_detail: Patient;
  provider: number;
  provider_username: string;
  service_type: number;
  service_type_name: string;
  estimated_cost: string;
  clinical_notes: string;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  submitted_date: string;
  review_deadline: string;
  decision_date?: string;
  decision_maker?: number;
  decision_notes?: string;
  approved_amount?: string;
  approval_conditions?: string[];
  expiry_date?: string;
}

export interface PreAuthorizationStatus {
  is_required: boolean;
  threshold_amount: string;
  request_id?: number;
  status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  approved_amount?: string;
  expiry_date?: string;
  conditions?: string[];
}

export interface BenefitType {
  id: number;
  name: string;
  category: string;
  description?: string;
}

// Coverage and Benefit Types with Enhanced Logic
export interface SchemeBenefit {
  id: number;
  scheme: number;
  scheme_name: string;
  benefit_type: number;
  benefit_type_detail: BenefitType;
  coverage_amount?: string;
  coverage_limit_count?: number;
  coverage_period: 'PER_VISIT' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME' | 'BENEFIT_YEAR';
  deductible_amount: string;
  copayment_percentage: string;
  copayment_fixed: string;
  requires_preauth: boolean;
  preauth_limit?: string;
  waiting_period_days: number;
  network_only: boolean;
  is_active: boolean;
  effective_date: string;
  expiry_date?: string;
  
  // Enhanced fields
  benefit_rules: BenefitRule[];
  utilization_current_period: BenefitUtilization;
  clinical_requirements: ClinicalRequirement[];
}

export interface BenefitRule {
  id: number;
  rule_type: 'AGE_RESTRICTION' | 'GENDER_RESTRICTION' | 'FREQUENCY_LIMIT' | 'CLINICAL_CRITERIA' | 'PROVIDER_NETWORK';
  description: string;
  parameters: Record<string, any>;
  is_active: boolean;
}

export interface BenefitUtilization {
  benefit_id: number;
  patient_id: number;
  period_start: string;
  period_end: string;
  used_amount: string;
  used_count: number;
  remaining_amount?: string;
  remaining_count?: number;
  last_claim_date?: string;
  utilization_rate: number;
}

export interface ClinicalRequirement {
  id: number;
  requirement_type: 'DIAGNOSIS_CODE' | 'PROCEDURE_CODE' | 'PROVIDER_SPECIALTY' | 'REFERRAL_REQUIRED';
  description: string;
  criteria: Record<string, any>;
  is_mandatory: boolean;
}

// Enhanced Notification Types
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
  
  // Enhanced business context
  business_context?: NotificationBusinessContext;
  action_required?: NotificationAction[];
}

export interface NotificationBusinessContext {
  context_type: 'CLAIM_PROCESSING' | 'BENEFIT_UTILIZATION' | 'COVERAGE_RENEWAL' | 'PAYMENT_DUE' | 'COMPLIANCE_ISSUE';
  urgency_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline?: string;
  related_entities: Record<string, any>;
  business_impact: string;
}

export interface NotificationAction {
  action_id: string;
  label: string;
  action_type: 'NAVIGATE' | 'API_CALL' | 'DOWNLOAD' | 'EXTERNAL_LINK';
  parameters: Record<string, any>;
  is_primary: boolean;
}

// Form Types for Enhanced Business Logic
export interface ClaimSubmissionForm {
  patient: number;
  service_type: number;
  cost: string; // Changed to string for precision
  date_of_service: string;
  diagnosis_code?: string;
  procedure_code?: string;
  notes?: string;
  preauth_number?: string;
  
  // Enhanced validation
  provider_notes?: string;
  urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  supporting_documents?: File[];
}

export interface BenefitValidationResult {
  is_valid: boolean;
  coverage_available: boolean;
  pre_auth_required: boolean;
  estimated_patient_responsibility: string;
  estimated_scheme_payment: string;
  warnings: string[];
  errors: string[];
  waiting_period_status?: {
    is_waiting: boolean;
    days_remaining?: number;
    completion_date?: string;
  };
}

// Coverage Rule Types
export interface CoverageRule {
  id: number;
  rule_name: string;
  rule_type: 'ELIGIBILITY' | 'COVERAGE_LIMIT' | 'EXCLUSION' | 'SPECIAL_CONDITION';
  conditions: RuleCondition[];
  actions: RuleAction[];
  is_active: boolean;
  priority: number;
}

export interface RuleCondition {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS' | 'IN_RANGE';
  value: any;
  logical_operator?: 'AND' | 'OR';
}

export interface RuleAction {
  action_type: 'APPROVE' | 'DENY' | 'REQUIRE_PREAUTH' | 'APPLY_COPAYMENT' | 'APPLY_DEDUCTIBLE' | 'FLAG_FOR_REVIEW';
  parameters: Record<string, any>;
}

export type NotificationType = 
  | 'CLAIM_SUBMITTED' 
  | 'CLAIM_APPROVED' 
  | 'CLAIM_REJECTED' 
  | 'PREAUTH_REQUIRED' 
  | 'BENEFIT_EXHAUSTED' 
  | 'PAYMENT_DUE' 
  | 'COVERAGE_RENEWAL'
  | 'FRAUD_ALERT'
  | 'SYSTEM_ANNOUNCEMENT';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';