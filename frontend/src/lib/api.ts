export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;
}

type RequestInitExtended = RequestInit & { noAuth?: boolean };

async function request<T>(method: HttpMethod, path: string, body?: any, init?: RequestInitExtended): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.noAuth ? {} : authHeader()),
  };
  if (init?.headers) {
    const h = init.headers as HeadersInit;
    if (h instanceof Headers) {
      h.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(h)) {
      for (const [k, v] of h) headers[k] = String(v);
    } else {
      Object.assign(headers, h as Record<string, string>);
    }
  }
  const { noAuth, ...rest } = init ?? {};
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: rest.credentials ?? 'include',
    ...rest,
  });
  if (!res.ok) {
    let errText = await res.text().catch(() => '');
    try {
      const json = JSON.parse(errText);
      errText = json.detail || errText;
    } catch {}
    throw new Error(`${res.status} ${res.statusText}${errText ? `: ${errText}` : ''}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInitExtended) => request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: any, init?: RequestInitExtended) => request<T>('POST', path, body, init),
  put: <T>(path: string, body?: any, init?: RequestInitExtended) => request<T>('PUT', path, body, init),
  patch: <T>(path: string, body?: any, init?: RequestInitExtended) => request<T>('PATCH', path, body, init),
  delete: <T>(path: string, init?: RequestInitExtended) => request<T>('DELETE', path, undefined, init),
};

// Convenience typed calls for core endpoints
export async function getDashboardStats(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const query = params.toString();
  return api.get<import('../types/api').DashboardStats>(`/api/core/dashboard/stats/${query ? `?${query}` : ''}`);
}

export async function getActivityFeed() {
  return api.get<import('../types/api').ActivityFeed>('/api/core/dashboard/activity/');
}

export async function getProvidersAnalytics() {
  return api.get<import('../types/api').ProvidersAnalytics>('/api/core/analytics/providers/');
}

export async function globalSearch(query: string, entityType: string = 'all', limit: number = 10) {
  const params = new URLSearchParams({
    q: query,
    type: entityType,
    limit: limit.toString()
  });
  return api.get<import('../types/api').SearchResponse>(`/api/core/search/?${params.toString()}`);
}

// Subscription API functions
export const subscriptionApi = {
  // Benefit Categories
  getBenefitCategories: () => api.get<import('../types/api').SubscriptionTierListResponse>('/api/schemes/benefit-categories/'),
  createBenefitCategory: (data: Partial<import('../types/models').BenefitCategory>) =>
    api.post<import('../types/models').BenefitCategory>('/api/schemes/benefit-categories/', data),
  updateBenefitCategory: (id: number, data: Partial<import('../types/models').BenefitCategory>) =>
    api.put<import('../types/models').BenefitCategory>(`/api/schemes/benefit-categories/${id}/`, data),
  deleteBenefitCategory: (id: number) =>
    api.delete(`/api/schemes/benefit-categories/${id}/`),

  // Subscription Tiers
  getSubscriptionTiers: (params?: { scheme?: number; tier_type?: string; is_active?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.scheme) queryParams.append('scheme', params.scheme.toString());
    if (params?.tier_type) queryParams.append('tier_type', params.tier_type);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    const query = queryParams.toString();
    return api.get<import('../types/api').SubscriptionTierListResponse>(
      `/api/schemes/subscription-tiers/${query ? `?${query}` : ''}`
    );
  },
  getAvailableTiers: (schemeId: number) =>
    api.get<import('../types/models').SubscriptionTier[]>(`/api/schemes/subscription-tiers/available/?scheme_id=${schemeId}`),
  createSubscriptionTier: (data: Partial<import('../types/models').SubscriptionTier>) =>
    api.post<import('../types/models').SubscriptionTier>('/api/schemes/subscription-tiers/', data),
  updateSubscriptionTier: (id: number, data: Partial<import('../types/models').SubscriptionTier>) =>
    api.put<import('../types/models').SubscriptionTier>(`/api/schemes/subscription-tiers/${id}/`, data),
  deleteSubscriptionTier: (id: number) =>
    api.delete(`/api/schemes/subscription-tiers/${id}/`),

  // Member Subscriptions
  getMemberSubscriptions: (params?: { status?: string; subscription_type?: string; patient?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.subscription_type) queryParams.append('subscription_type', params.subscription_type);
    if (params?.patient) queryParams.append('patient', params.patient.toString());
    const query = queryParams.toString();
    return api.get<import('../types/api').MemberSubscriptionListResponse>(
      `/api/schemes/subscriptions/${query ? `?${query}` : ''}`
    );
  },
  getMemberSubscription: (id: number) =>
    api.get<import('../types/models').MemberSubscription>(`/api/schemes/subscriptions/${id}/`),
  createMemberSubscription: (data: import('../types/models').SubscriptionCreateRequest) =>
    api.post<import('../types/models').MemberSubscription>('/api/schemes/subscriptions/create_subscription/', data),
  updateMemberSubscription: (id: number, data: Partial<import('../types/models').MemberSubscription>) =>
    api.put<import('../types/models').MemberSubscription>(`/api/schemes/subscriptions/${id}/`, data),
  deleteMemberSubscription: (id: number) =>
    api.delete(`/api/schemes/subscriptions/${id}/`),
  upgradeSubscription: (id: number, data: import('../types/models').SubscriptionUpgradeRequest) =>
    api.post<import('../types/models').MemberSubscription>(`/api/schemes/subscriptions/${id}/upgrade/`, data),
  getSubscriptionUsage: (id: number) =>
    api.get<import('../types/api').SubscriptionUsageResponse>(`/api/schemes/subscriptions/${id}/usage/`),
  getSubscriptionAnalytics: (schemeId?: number) =>
    api.get<import('../types/api').SubscriptionAnalyticsResponse>(
      `/api/schemes/subscriptions/analytics/${schemeId ? `?scheme_id=${schemeId}` : ''}`
    ),
};

// Notification API Client
export const notificationApi = {
  // Notification CRUD operations
  getNotifications: (params?: {
    page?: number;
    page_size?: number;
    notification_type?: string;
    channel?: string;
    status?: string;
    priority?: string;
    created_after?: string;
    created_before?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return api.get<{
      count: number;
      next: string | null;
      previous: string | null;
      results: import('../types/models').Notification[];
    }>(`/api/accounts/notifications/${queryString ? `?${queryString}` : ''}`);
  },

  getNotification: (id: number) =>
    api.get<import('../types/models').Notification>(`/api/accounts/notifications/${id}/`),

  createNotification: (data: {
    recipient_id: number;
    notification_type: string;
    title: string;
    message: string;
    html_message?: string;
    channel?: string;
    priority?: string;
    scheduled_for?: string;
    metadata?: Record<string, any>;
  }) =>
    api.post<import('../types/models').Notification>('/api/accounts/notifications/', data),

  updateNotification: (id: number, data: Partial<import('../types/models').Notification>) =>
    api.patch<import('../types/models').Notification>(`/api/accounts/notifications/${id}/`, data),

  deleteNotification: (id: number) =>
    api.delete(`/api/accounts/notifications/${id}/`),

  // Bulk operations
  markRead: (notificationIds: number[]) =>
    api.post<{ message: string; updated_count: number }>('/api/accounts/notifications/mark-read/', {
      notification_ids: notificationIds,
    }),

  markAllRead: () =>
    api.post<{ message: string; updated_count: number }>('/api/accounts/notifications/mark-all-read/'),

  // Quick actions
  getUnreadCount: () =>
    api.get<{ unread_count: number }>('/api/accounts/notifications/unread-count/'),

  getStats: () =>
    api.get<import('../types/models').NotificationStats>('/api/accounts/notifications/stats/'),

  resendNotification: (id: number) =>
    api.post<{ message: string; notification_id: number }>(`/api/accounts/notifications/${id}/resend/`),

  // Preferences
  getPreferences: () =>
    api.get<import('../types/models').NotificationPreference>('/api/accounts/preferences/my/'),

  updatePreferences: (data: Partial<import('../types/models').NotificationPreference>) =>
    api.patch<import('../types/models').NotificationPreference>('/api/accounts/preferences/my/', data),

  // Management (Admin only)
  sendBulkNotification: (data: import('../types/models').BulkNotificationRequest) =>
    api.post<{
      message: string;
      notification_count: number;
      notification_ids: number[];
    }>('/api/accounts/management/send-bulk/', data),

  sendSystemAnnouncement: (data: import('../types/models').SystemAnnouncementRequest) =>
    api.post<{
      message: string;
      notification_count: number;
    }>('/api/accounts/management/send-announcement/', data),

  processScheduledNotifications: () =>
    api.post<{
      message: string;
      processed_count: number;
    }>('/api/accounts/management/process-scheduled/'),

  cleanupOldNotifications: (daysOld: number = 90) =>
    api.post<{
      message: string;
      deleted_count: number;
    }>('/api/accounts/management/cleanup/', { days_old: daysOld }),

  // Logs
  getNotificationLogs: (params?: {
    page?: number;
    page_size?: number;
    action?: string;
    notification__notification_type?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return api.get<{
      count: number;
      next: string | null;
      previous: string | null;
      results: import('../types/models').NotificationLog[];
    }>(`/api/accounts/logs/${queryString ? `?${queryString}` : ''}`);
  },

  // Dashboard
  getDashboardData: () =>
    api.get<import('../types/models').NotificationDashboardData>('/api/accounts/dashboard/data/'),
};
