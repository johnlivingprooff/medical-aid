/**
 * Enhanced API Client with Medical Aid Business Logic
 * Handles pagination, error handling, and medical aid specific operations
 */

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Standard API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface StandardResponse<T> {
  data?: T;
  detail?: string;
  message?: string;
}

export interface BusinessError {
  code: string;
  message: string;
  field?: string;
  context?: {
    rule: string;
    suggestion: string;
    recovery_actions?: Array<{
      label: string;
      action: string;
      params?: Record<string, any>;
    }>;
  };
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
  business_errors?: BusinessError[];
  status?: number;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends RequestInit {
  noAuth?: boolean;
  timeout?: number;
  retries?: number;
}

class EnhancedApiClient {
  private baseURL: string;
  private defaultTimeout = 30000;
  private defaultRetries = 2;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private authHeader(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      noAuth = false,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      ...fetchOptions
    } = options;

    const url = `${this.baseURL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(noAuth ? {} : this.authHeader()),
      ...fetchOptions.headers,
    };

    const config: RequestInit = {
      method,
      headers,
      ...fetchOptions,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    // Timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    config.signal = controller.signal;

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, config);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiResponseError(response.status, errorData, response);
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          return {} as T;
        }

        const data = await response.json();
        return this.processResponse<T>(data);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication errors or client errors
        if (error instanceof ApiResponseError && error.status < 500) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === retries) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError!;
  }

  private processResponse<T>(data: any): T {
    // Handle paginated responses consistently
    if (data && typeof data === 'object' && 'results' in data) {
      return data as T;
    }
    
    return data;
  }

  // Standard HTTP methods
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  // Paginated data handling
  async getPaginated<T>(
    path: string,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get<PaginatedResponse<T>>(`${path}${queryString}`);
  }

  async getAllPages<T>(
    path: string,
    params?: Record<string, any>
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextUrl: string | null = path;
    
    while (nextUrl) {
      const queryString = params && nextUrl === path 
        ? `?${new URLSearchParams(params).toString()}` 
        : '';
      
      const response: PaginatedResponse<T> = await this.get<PaginatedResponse<T>>(`${nextUrl}${queryString}`);
      allItems.push(...response.results);
      
      // Extract just the path and query from the next URL
      nextUrl = response.next 
        ? new URL(response.next).pathname + new URL(response.next).search
        : null;
    }
    
    return allItems;
  }
}

// Custom error class for API responses
class ApiResponseError extends Error {
  public status: number;
  public data: any;
  public response: Response;

  constructor(status: number, data: any, response: Response) {
    const message = data.detail || data.message || `HTTP ${status}`;
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.data = data;
    this.response = response;
  }

  get isBusinessError(): boolean {
    return this.status === 400 && Array.isArray(this.data.business_errors);
  }

  get businessErrors(): BusinessError[] {
    return this.data.business_errors || [];
  }
}

// Create singleton instance
export const apiClient = new EnhancedApiClient(API_URL);

// Medical Aid Specific API Operations
export class MedicalAidApi {
  // Claim operations with business logic
  static async validateClaim(claimData: {
    patient: number;
    service_type: number;
    cost: string;
  }): Promise<{
    approved: boolean;
    payable: string;
    reason: string;
    validation_details: {
      benefit_check: any;
      pre_auth_required: boolean;
      patient_responsibility: any;
    };
  }> {
    return apiClient.post('/api/claims/validate/', claimData);
  }

  static async submitClaim(claimData: {
    patient: number;
    service_type: number;
    cost: string;
    notes?: string;
    date_of_service?: string;
    diagnosis_code?: string;
    procedure_code?: string;
  }) {
    return apiClient.post('/api/claims/', claimData);
  }

  // Benefit operations
  static async getBenefitUtilization(
    patientId: number,
    benefitTypeId?: number,
    period?: 'current' | 'year' | 'month'
  ) {
    const params = new URLSearchParams({
      patient: patientId.toString(),
      ...(benefitTypeId && { benefit_type: benefitTypeId.toString() }),
      ...(period && { period })
    });
    
    return apiClient.get(`/api/coverage/balance/?${params}`);
  }

  // Pre-authorization operations
  static async checkPreAuthRequirement(
    patientId: number,
    serviceTypeId: number,
    cost: string
  ) {
    return apiClient.post('/api/claims/preauth-requests/check/', {
      patient: patientId,
      service_type: serviceTypeId,
      cost
    });
  }

  static async requestPreAuthorization(preAuthData: {
    patient: number;
    service_type: number;
    provider: number;
    estimated_cost: string;
    clinical_notes: string;
    urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  }) {
    return apiClient.post('/api/claims/preauth-requests/', preAuthData);
  }

  // Member and scheme operations
  static async getMemberSchemeDetails(patientId: number) {
    return apiClient.get(`/api/patients/${patientId}/scheme-details/`);
  }

  static async getSchemebenefits(schemeId: number) {
    return apiClient.get(`/api/schemes/benefits/?scheme=${schemeId}`);
  }

  // Dashboard and analytics
  static async getDashboardStats(params?: {
    start_date?: string;
    end_date?: string;
    provider?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.provider) searchParams.set('provider', params.provider.toString());
    
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get(`/api/core/dashboard/stats/${queryString}`);
  }

  // Notification operations
  static async getNotifications(params?: {
    unread_only?: boolean;
    notification_type?: string;
    limit?: number;
  }) {
    return apiClient.getPaginated('/api/accounts/notifications/', params);
  }

  static async markNotificationRead(notificationId: number) {
    return apiClient.post(`/api/accounts/notifications/${notificationId}/mark-read/`);
  }

  static async updateNotificationPreferences(preferences: any) {
    return apiClient.put('/api/accounts/notification-preferences/', preferences);
  }
}

// Error handling utilities
export const ErrorHandler = {
  isNetworkError: (error: any): boolean => {
    return error.message?.includes('fetch') || error.message?.includes('network');
  },

  isAuthenticationError: (error: any): boolean => {
    return error instanceof ApiResponseError && error.status === 401;
  },

  isBusinessError: (error: any): boolean => {
    return error instanceof ApiResponseError && error.isBusinessError;
  },

  extractErrorMessage: (error: any): string => {
    if (error instanceof ApiResponseError) {
      return error.message;
    }
    return error.message || 'An unexpected error occurred';
  },

  extractBusinessErrors: (error: any): BusinessError[] => {
    if (error instanceof ApiResponseError && error.isBusinessError) {
      return error.businessErrors;
    }
    return [];
  }
};

export { ApiResponseError };
export default apiClient;