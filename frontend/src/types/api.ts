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

// Search-related types
export type SearchResult = {
  id: string | number;
  type: 'scheme' | 'claim' | 'member' | 'provider' | 'service_type' | 'benefit_type';
  title: string;
  subtitle: string;
  url: string;
  metadata: Record<string, any>;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  query: string;
  entity_type: string;
};

export type SearchFilters = {
  query: string;
  entity_type?: 'all' | 'schemes' | 'claims' | 'members' | 'providers' | 'services' | 'benefits';
  limit?: number;
};

// Subscription API Types
export type SubscriptionTierListResponse = {
  results: import('./models').SubscriptionTier[];
  count: number;
  next?: string;
  previous?: string;
};

export type MemberSubscriptionListResponse = {
  results: import('./models').MemberSubscription[];
  count: number;
  next?: string;
  previous?: string;
};

export type SubscriptionUsageResponse = import('./models').SubscriptionUsageStats;

export type SubscriptionAnalyticsResponse = import('./models').SubscriptionAnalytics;

export type SubscriptionCreateRequest = import('./models').SubscriptionCreateRequest;

export type SubscriptionUpgradeRequest = import('./models').SubscriptionUpgradeRequest;
