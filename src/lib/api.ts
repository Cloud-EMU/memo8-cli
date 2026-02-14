import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { getToken, getApiUrl, getTeamId, clearAuth } from './config.js';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class ValidationError extends ApiError {
  errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 422, errors);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export interface ApiClient {
  get: <T = unknown>(url: string, params?: Record<string, unknown>) => Promise<AxiosResponse<T>>;
  post: <T = unknown>(url: string, data?: unknown) => Promise<AxiosResponse<T>>;
  put: <T = unknown>(url: string, data?: unknown) => Promise<AxiosResponse<T>>;
  patch: <T = unknown>(url: string, data?: unknown) => Promise<AxiosResponse<T>>;
  del: <T = unknown>(url: string) => Promise<AxiosResponse<T>>;
}

export function createApiClient(): ApiClient {
  const instance: AxiosInstance = axios.create({
    baseURL: getApiUrl(),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30000,
  });

  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const teamId = getTeamId();
    if (teamId) {
      config.headers['X-Team-Id'] = String(teamId);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new ApiError(
          'Cannot connect to API. Is the server running?',
          0
        );
      }

      const status: number | undefined = error.response?.status;
      const data = error.response?.data;

      if (status === 401) {
        clearAuth();
        throw new ApiError(
          'Session expired. Please login again with: memo8 login',
          401,
          data
        );
      }

      if (status === 422) {
        const errors = (data?.errors as Record<string, string[]>) || {};
        const message = (data?.message as string) || 'Validation failed';
        throw new ValidationError(message, errors);
      }

      throw new ApiError(
        (data?.message as string) || error.message || 'An unexpected error occurred',
        status || 0,
        data
      );
    }
  );

  return {
    get: <T = unknown>(url: string, params?: Record<string, unknown>) =>
      instance.get<T>(url, { params }),
    post: <T = unknown>(url: string, data?: unknown) =>
      instance.post<T>(url, data),
    put: <T = unknown>(url: string, data?: unknown) =>
      instance.put<T>(url, data),
    patch: <T = unknown>(url: string, data?: unknown) =>
      instance.patch<T>(url, data),
    del: <T = unknown>(url: string) =>
      instance.delete<T>(url),
  };
}
