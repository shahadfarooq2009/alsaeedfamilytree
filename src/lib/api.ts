import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { AUTH_USER_KEY } from '../constants/authStorage';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

export const AUTH_TOKEN_KEY = 'auth_token';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url ?? '';
      const isLoginRequest = requestUrl.includes('/login');

      if (!isLoginRequest) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);

        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    }

    return Promise.reject(error);
  },
);

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    let message = error.response?.data?.message ?? 'حدث خطأ أثناء الاتصال بالخادم';

    if (status === 403 && message === 'This action is unauthorized.') {
      message = 'ليس لديك صلاحية للوصول إلى هذه العائلة أو تنفيذ هذا الإجراء.';
    }

    return new ApiError(message, status, error.response?.data?.errors);
  }

  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('حدث خطأ غير متوقع', 500);
}

const VALIDATION_MESSAGES_AR: Record<string, string> = {
  'The father must be a male family member.': 'يجب أن يكون الأب رجلاً مسجلاً في العائلة.',
  'The mother must be a female family member.': 'يجب أن تكون الأم امرأة مسجلة في العائلة.',
  'Selected parents must belong to the same family.': 'يجب أن ينتمي الأب والأم إلى نفس العائلة.',
  'This relationship would create a circular ancestry.': 'هذا الربط يُنشئ حلقة في شجرة العائلة.',
  'A person cannot be their own parent.': 'لا يمكن للشخص أن يكون أباً أو أماً لنفسه.',
};

export function formatApiErrorMessage(error: ApiError): string {
  const fieldMessages = error.errors ? Object.values(error.errors).flat() : [];
  for (const message of fieldMessages) {
    if (VALIDATION_MESSAGES_AR[message]) {
      return VALIDATION_MESSAGES_AR[message];
    }
  }

  if (fieldMessages.length > 0) {
    return fieldMessages[0];
  }

  if (error.message === 'The given data was invalid.') {
    return 'البيانات المدخلة غير صالحة. تحقق من حقول الأب والأم.';
  }

  return error.message;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}
