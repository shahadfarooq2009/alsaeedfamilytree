import { api, clearAuthToken, setAuthToken } from '../lib/api';
import type { LoginPayload, LoginResponse } from '../types/auth';

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/login', payload);
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/logout');
  } finally {
    clearAuthToken();
  }
}

export function saveSession(accessToken: string): void {
  setAuthToken(accessToken);
}
