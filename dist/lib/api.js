import axios from 'axios';
import { getToken, getApiUrl, clearAuth } from './config.js';
export class ApiError extends Error {
    status;
    data;
    constructor(message, status, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}
export class ValidationError extends ApiError {
    errors;
    constructor(message, errors) {
        super(message, 422, errors);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}
export function createApiClient() {
    const instance = axios.create({
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
        return config;
    });
    instance.interceptors.response.use((response) => response, (error) => {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new ApiError('Cannot connect to API. Is the server running?', 0);
        }
        const status = error.response?.status;
        const data = error.response?.data;
        if (status === 401) {
            clearAuth();
            throw new ApiError('Session expired. Please login again with: memo8 login', 401, data);
        }
        if (status === 422) {
            const errors = data?.errors || {};
            const message = data?.message || 'Validation failed';
            throw new ValidationError(message, errors);
        }
        throw new ApiError(data?.message || error.message || 'An unexpected error occurred', status || 0, data);
    });
    return {
        get: (url, params) => instance.get(url, { params }),
        post: (url, data) => instance.post(url, data),
        put: (url, data) => instance.put(url, data),
        patch: (url, data) => instance.patch(url, data),
        del: (url) => instance.delete(url),
    };
}
//# sourceMappingURL=api.js.map