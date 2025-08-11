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
export async function getDashboardStats() {
  return api.get<import('../types/api').DashboardStats>('/api/core/dashboard/stats/');
}

export async function getActivityFeed() {
  return api.get<import('../types/api').ActivityFeed>('/api/core/dashboard/activity/');
}

export async function getProvidersAnalytics() {
  return api.get<import('../types/api').ProvidersAnalytics>('/api/core/analytics/providers/');
}
