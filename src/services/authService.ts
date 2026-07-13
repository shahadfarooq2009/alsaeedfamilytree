import { api, clearAuthToken, setAuthToken } from '../lib/api';
import { AUTH_USER_KEY } from '../constants/authStorage';
import type { AuthUser, LoginPayload, LoginResponse } from '../types/auth';

export { AUTH_USER_KEY };

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/login', payload);
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/logout');
  } finally {
    clearAuthSession();
  }
}

export function saveSession(accessToken: string, user?: AuthUser): void {
  setAuthToken(accessToken);
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  clearAuthToken();
  localStorage.removeItem(AUTH_USER_KEY);
}
