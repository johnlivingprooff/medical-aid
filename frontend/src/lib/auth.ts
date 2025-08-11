import { api } from './api'

export type LoginResponse = {
  access: string;
  refresh: string;
  user?: { username: string; role: string };
};

export async function login(username: string, password: string) {
  const data = await api.post<LoginResponse>('/api/auth/login/', { username, password })
  localStorage.setItem('token', data.access)
  localStorage.setItem('refresh', data.refresh)
  return data
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh')
}

export type MeResponse = { id: number; username: string; role: string };
export async function me() {
  return api.get<MeResponse>('/api/accounts/me/')
}
