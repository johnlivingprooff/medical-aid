export type DashboardStats = {
  kpis: {
    active_members: number;
    total_claims_period: number;
    claim_value_approved: number;
    pending_claim_value: number;
    utilization_rate: number;
    avg_processing_days: number;
    data_period?: '30_days' | 'all_time' | 'custom';
  };
  status_snapshot: Record<string, { count: number; amount: number }>;
  scheme_utilization: Array<{ patient__scheme__name: string; total_amount: number; total_claims: number }>;
};

export type ActivityFeed = {
  results: Array<{
    id: number;
    type: 'CLAIM_SUBMITTED' | 'CLAIM_APPROVED';
    title: string;
    member: string;
    provider: string;
    status?: string;
    amount: number;
    timestamp: string;
  }>;
};

export type ProvidersAnalytics = {
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
};
