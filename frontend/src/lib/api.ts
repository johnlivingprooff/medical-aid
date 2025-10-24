export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;
}

type RequestInitExtended = RequestInit & { noAuth?: boolean };

async function request<T>(method: HttpMethod, path: string, body?: any, init?: RequestInitExtended): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {
    ...(init?.noAuth ? {} : authHeader()),
  };
  // Set JSON content-type only when not sending FormData and not already provided
  const providedHeaders = init?.headers as HeadersInit | undefined;
  const hasExplicitContentType = providedHeaders instanceof Headers
    ? providedHeaders.has('Content-Type')
    : Array.isArray(providedHeaders)
      ? providedHeaders.some(([k]) => k.toLowerCase() === 'content-type')
      : providedHeaders
        ? Object.keys(providedHeaders as Record<string, string>).some(k => k.toLowerCase() === 'content-type')
        : false;
  if (!isFormData && !hasExplicitContentType) {
    headers['Content-Type'] = 'application/json';
  }
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
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
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
  getBenefitCategories: () => api.get<import('../types/api').BenefitCategoryListResponse>('/api/schemes/benefit-categories/'),
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

// Billing API Client (for the billing app)
export const billingApi = {
  // Payment Methods
  getPaymentMethods: (params?: { subscription?: number; is_active?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.subscription) queryParams.append('subscription', params.subscription.toString());
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    const query = queryParams.toString();
    return api.get<import('../types/models').PaymentMethod[]>(`/api/billing/payment-methods/${query ? `?${query}` : ''}`);
  },
  getPaymentMethod: (id: number) =>
    api.get<import('../types/models').PaymentMethod>(`/api/billing/payment-methods/${id}/`),
  createPaymentMethod: (data: Partial<import('../types/models').PaymentMethod>) =>
    api.post<import('../types/models').PaymentMethod>('/api/billing/payment-methods/', data),
  updatePaymentMethod: (id: number, data: Partial<import('../types/models').PaymentMethod>) =>
    api.put<import('../types/models').PaymentMethod>(`/api/billing/payment-methods/${id}/`, data),
  deletePaymentMethod: (id: number) =>
    api.delete(`/api/billing/payment-methods/${id}/`),

  // Invoices
  getInvoices: (params?: { subscription?: number; status?: string; date_from?: string; date_to?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.subscription) queryParams.append('subscription', params.subscription.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').Invoice[]>(`/api/billing/invoices/${query ? `?${query}` : ''}`);
  },
  getInvoice: (id: number) =>
    api.get<import('../types/models').Invoice>(`/api/billing/invoices/${id}/`),
  createInvoice: (data: Partial<import('../types/models').Invoice>) =>
    api.post<import('../types/models').Invoice>('/api/billing/invoices/', data),
  updateInvoice: (id: number, data: Partial<import('../types/models').Invoice>) =>
    api.put<import('../types/models').Invoice>(`/api/billing/invoices/${id}/`, data),
  deleteInvoice: (id: number) =>
    api.delete(`/api/billing/invoices/${id}/`),

  // Payments
  getPayments: (params?: { invoice?: number; payment_method?: number; status?: string; date_from?: string; date_to?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.invoice) queryParams.append('invoice', params.invoice.toString());
    if (params?.payment_method) queryParams.append('payment_method', params.payment_method.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').Payment[]>(`/api/billing/payments/${query ? `?${query}` : ''}`);
  },
  getPayment: (id: number) =>
    api.get<import('../types/models').Payment>(`/api/billing/payments/${id}/`),
  createPayment: (data: Partial<import('../types/models').Payment>) =>
    api.post<import('../types/models').Payment>('/api/billing/payments/', data),
  updatePayment: (id: number, data: Partial<import('../types/models').Payment>) =>
    api.put<import('../types/models').Payment>(`/api/billing/payments/${id}/`, data),
  deletePayment: (id: number) =>
    api.delete(`/api/billing/payments/${id}/`),

  // Billing Cycles
  getBillingCycles: (params?: { subscription?: number; status?: string; date_from?: string; date_to?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.subscription) queryParams.append('subscription', params.subscription.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').BillingCycle[]>(`/api/billing/billing-cycles/${query ? `?${query}` : ''}`);
  },
  getBillingCycle: (id: number) =>
    api.get<import('../types/models').BillingCycle>(`/api/billing/billing-cycles/${id}/`),
  retryPayment: (id: number) =>
    api.post<import('../types/models').BillingCycle>(`/api/billing/billing-cycles/${id}/retry_payment/`),

  // Billing Settings
  getBillingSettings: () =>
    api.get<import('../types/models').BillingSettings[]>('/api/billing/settings/'),
  getCurrentBillingSettings: () =>
    api.get<import('../types/models').BillingSettings>('/api/billing/settings/current/'),
  updateBillingSettings: (id: number, data: Partial<import('../types/models').BillingSettings>) =>
    api.put<import('../types/models').BillingSettings>(`/api/billing/settings/${id}/`, data),
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

// Reports API Client
export const reportsApi = {
  // CSV Export functions that handle blob responses
  exportSchemeUsageCSV: async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/core/reports/scheme-usage/?format=csv`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      let errorMsg = `Export failed: ${response.status} ${response.statusText}`;
      try {
        const text = await response.text();
        console.error('Export error response:', text);
        errorMsg += ` - ${text}`;
      } catch (e) {
        console.error('Could not read error response:', e);
      }
      throw new Error(errorMsg);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheme_usage_report.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  exportServiceTypeCSV: async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/core/reports/disease-stats/?format=csv`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      let errorMsg = `Export failed: ${response.status} ${response.statusText}`;
      try {
        const text = await response.text();
        console.error('Export error response:', text);
        errorMsg += ` - ${text}`;
      } catch (e) {
        console.error('Could not read error response:', e);
      }
      throw new Error(errorMsg);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'service_type_stats.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  exportDetailedClaimsCSV: async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/core/reports/detailed-claims/?format=csv`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      let errorMsg = `Export failed: ${response.status} ${response.statusText}`;
      try {
        const text = await response.text();
        console.error('Export error response:', text);
        errorMsg += ` - ${text}`;
      } catch (e) {
        console.error('Could not read error response:', e);
      }
      throw new Error(errorMsg);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detailed_claims_report.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

// Subscription Billing API Client (for subscription management)
export const subscriptionBillingApi = {
  // Payment Methods
  getPaymentMethods: () =>
    api.get<import('../types/models').PaymentMethod[]>('/api/schemes/payment-methods/'),
  createPaymentMethod: (data: import('../types/models').PaymentMethodCreateRequest) =>
    api.post<import('../types/models').PaymentMethod>('/api/schemes/payment-methods/', data),
  updatePaymentMethod: (id: number, data: Partial<import('../types/models').PaymentMethod>) =>
    api.put<import('../types/models').PaymentMethod>(`/api/schemes/payment-methods/${id}/`, data),
  deletePaymentMethod: (id: number) =>
    api.delete(`/api/schemes/payment-methods/${id}/`),
  setDefaultPaymentMethod: (id: number) =>
    api.post<import('../types/models').PaymentMethod>(`/api/schemes/payment-methods/${id}/set-default/`),

  // Invoices
  getInvoices: (params?: { status?: string; subscription?: number; date_from?: string; date_to?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.subscription) queryParams.append('subscription', params.subscription.toString());
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').SubscriptionInvoice[]>(`/api/schemes/invoices/${query ? `?${query}` : ''}`);
  },
  getInvoice: (id: number) =>
    api.get<import('../types/models').SubscriptionInvoice>(`/api/schemes/invoices/${id}/`),
  createInvoice: (data: import('../types/models').SubscriptionInvoiceCreateRequest) =>
    api.post<import('../types/models').SubscriptionInvoice>('/api/schemes/invoices/', data),
  updateInvoice: (id: number, data: Partial<import('../types/models').SubscriptionInvoice>) =>
    api.put<import('../types/models').SubscriptionInvoice>(`/api/schemes/invoices/${id}/`, data),
  deleteInvoice: (id: number) =>
    api.delete(`/api/schemes/invoices/${id}/`),

  // Payments
  getPayments: (params?: { status?: string; invoice?: number; payment_method?: number; date_from?: string; date_to?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.invoice) queryParams.append('invoice', params.invoice.toString());
    if (params?.payment_method) queryParams.append('payment_method', params.payment_method.toString());
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').SubscriptionPayment[]>(`/api/schemes/payments/${query ? `?${query}` : ''}`);
  },
  getPayment: (id: number) =>
    api.get<import('../types/models').SubscriptionPayment>(`/api/schemes/payments/${id}/`),
  createPayment: (data: import('../types/models').SubscriptionPaymentCreateRequest) =>
    api.post<import('../types/models').SubscriptionPayment>('/api/schemes/payments/', data),
  updatePayment: (id: number, data: Partial<import('../types/models').SubscriptionPayment>) =>
    api.put<import('../types/models').SubscriptionPayment>(`/api/schemes/payments/${id}/`, data),
  deletePayment: (id: number) =>
    api.delete(`/api/schemes/payments/${id}/`),
  processPayment: (id: number) =>
    api.post<import('../types/models').SubscriptionPayment>(`/api/schemes/payments/${id}/process/`),
  refundPayment: (id: number, data: import('../types/models').RefundRequest) =>
    api.post<import('../types/models').SubscriptionPayment>(`/api/schemes/payments/${id}/refund/`, data),

  // Billing History
  getBillingHistory: (params?: { subscription?: number; date_from?: string; date_to?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.subscription) queryParams.append('subscription', params.subscription.toString());
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return api.get<import('../types/models').BillingHistory[]>(`/api/schemes/billing-history/${query ? `?${query}` : ''}`);
  },

  // Billing Management
  getBillingOverview: () =>
    api.get<import('../types/models').BillingOverview>('/api/schemes/billing/overview/'),
  generateInvoice: (subscriptionId: number) =>
    api.post<import('../types/models').SubscriptionInvoice>(`/api/schemes/billing/generate-invoice/${subscriptionId}/`),
  processRenewal: (subscriptionId: number) =>
    api.post<import('../types/models').SubscriptionPayment>(`/api/schemes/billing/process-renewal/${subscriptionId}/`),
  getPaymentStats: (params?: { date_from?: string; date_to?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').PaymentStats>(`/api/schemes/billing/payment-stats/${query ? `?${query}` : ''}`);
  },
};

// EDI Integration API
export const ediApi = {
  submitTransaction: (data: { 
    transaction_type: string; 
    x12_content: string; 
    claim?: number; 
    patient?: number; 
  }) =>
    api.post<import('../types/models').EDITransaction>('/api/core/edi/submit/', data),
  
  getTransactions: (params?: {
    transaction_type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.transaction_type) queryParams.append('transaction_type', params.transaction_type);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    const query = queryParams.toString();
    return api.get<import('../types/models').EDITransaction[]>(`/api/core/edi/transactions/${query ? `?${query}` : ''}`);
  },

  getTransaction: (transactionId: string) =>
    api.get<import('../types/models').EDITransaction>(`/api/core/edi/transactions/${transactionId}/`),

  updateTransactionStatus: (transactionId: string, status: string) =>
    api.post<import('../types/models').EDITransaction>(`/api/core/edi/transactions/${transactionId}/update-status/`, { status }),

  getValidationRules: () =>
    api.get<import('../types/models').EDIValidationRule[]>('/api/core/edi/validation-rules/'),
};

// Provider Network API
export const networkApi = {
  getProviderDirectory: (params?: {
    facility_type?: string;
    specialty?: string;
    network_tier?: string;
    search?: string;
    is_accepting_new_patients?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.facility_type) queryParams.append('facility_type', params.facility_type);
    if (params?.specialty) queryParams.append('specialty', params.specialty);
    if (params?.network_tier) queryParams.append('network_tier', params.network_tier);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.is_accepting_new_patients !== undefined) 
      queryParams.append('is_accepting_new_patients', String(params.is_accepting_new_patients));
    const query = queryParams.toString();
    return api.get<import('../types/models').ProviderDirectory[]>(`/api/core/providers/directory/${query ? `?${query}` : ''}`);
  },

  getProviderDetail: (providerId: number) =>
    api.get<import('../types/models').ProviderDetail>(`/api/core/providers/directory/${providerId}/`),

  getNetworkDashboard: (params?: { scheme_id?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.scheme_id) queryParams.append('scheme_id', String(params.scheme_id));
    const query = queryParams.toString();
    return api.get<import('../types/models').ProviderNetworkDashboard>(`/api/core/providers/network/dashboard/${query ? `?${query}` : ''}`);
  },

  getNetworkStatus: (params?: {
    scheme_id?: number;
    provider_id?: number;
    health_status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.scheme_id) queryParams.append('scheme_id', String(params.scheme_id));
    if (params?.provider_id) queryParams.append('provider_id', String(params.provider_id));
    if (params?.health_status) queryParams.append('health_status', params.health_status);
    const query = queryParams.toString();
    return api.get<import('../types/models').ProviderNetworkStatus[]>(`/api/core/providers/network/status/${query ? `?${query}` : ''}`);
  },
};

// Credentialing API
export const credentialingApi = {
  getDashboard: () => api.get<import('../types/models').CredentialingDashboard>('/api/accounts/credentialing/dashboard/'),

  // Reviews
  getReviews: (params?: { status?: string; priority?: string; reviewer?: number; page?: number; page_size?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.append('status', params.status);
    if (params?.priority) sp.append('priority', params.priority);
    if (params?.reviewer) sp.append('reviewer', String(params.reviewer));
    if (params?.page) sp.append('page', String(params.page));
    if (params?.page_size) sp.append('page_size', String(params.page_size));
    const q = sp.toString();
    return api.get<import('../types/models').PaginatedResponse<import('../types/models').CredentialingReview>>(`/api/accounts/credentialing-reviews/${q ? `?${q}` : ''}`);
  },
  assignReview: (id: number, payload?: { priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' }) =>
    api.post<{ message: string }>(`/api/accounts/credentialing-reviews/${id}/assign/`, payload ?? {}),
  completeReview: (id: number, payload: { action: 'APPROVE' | 'REJECT' | 'ESCALATE'; notes?: string; rejection_reason?: string }) =>
    api.post<{ message: string }>(`/api/accounts/credentialing-reviews/${id}/complete/`, payload),

  // Documents
  getDocuments: (params?: { membership?: number; doc_type?: string; status?: string; page?: number; page_size?: number }) => {
    const sp = new URLSearchParams();
    if (params?.membership) sp.append('membership', String(params.membership));
    if (params?.doc_type) sp.append('doc_type', params.doc_type);
    if (params?.status) sp.append('status', params.status);
    if (params?.page) sp.append('page', String(params.page));
    if (params?.page_size) sp.append('page_size', String(params.page_size));
    const q = sp.toString();
    return api.get<import('../types/models').PaginatedResponse<import('../types/models').CredentialingDocument>>(`/api/accounts/provider-credentialing-docs/${q ? `?${q}` : ''}`);
  },
  uploadDocument: (data: { membership: number; doc_type: string; notes?: string; file: File }) => {
    const fd = new FormData();
    fd.append('membership', String(data.membership));
    fd.append('doc_type', data.doc_type);
    if (data.notes) fd.append('notes', data.notes);
    fd.append('file', data.file);
    return api.post<import('../types/models').CredentialingDocument>('/api/accounts/provider-credentialing-docs/', fd, {
      headers: {},
    });
  },

  // Memberships (for provider to pick scheme)
  getMemberships: (params?: { provider?: number; scheme?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.provider) sp.append('provider', String(params.provider));
    if (params?.scheme) sp.append('scheme', String(params.scheme));
    if (params?.status) sp.append('status', params.status);
    const q = sp.toString();
    return api.get<import('../types/models').PaginatedResponse<import('../types/models').ProviderNetworkMembership>>(`/api/accounts/provider-network/${q ? `?${q}` : ''}`);
  },

  // Alerts
  getExpiryAlerts: (params?: { alert_type?: string; is_acknowledged?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.alert_type) sp.append('alert_type', params.alert_type);
    if (params?.is_acknowledged !== undefined) sp.append('is_acknowledged', String(params.is_acknowledged));
    const q = sp.toString();
    return api.get<import('../types/models').PaginatedResponse<import('../types/models').DocumentExpiryAlert>>(`/api/accounts/expiry-alerts/${q ? `?${q}` : ''}`);
  },
  acknowledgeAlert: (id: number) => api.post<{ message: string }>(`/api/accounts/expiry-alerts/${id}/acknowledge/`),
};
