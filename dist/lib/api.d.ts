import { type AxiosResponse } from 'axios';
export declare class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data?: unknown);
}
export declare class ValidationError extends ApiError {
    errors: Record<string, string[]>;
    constructor(message: string, errors: Record<string, string[]>);
}
export interface ApiClient {
    get: <T = unknown>(url: string, params?: Record<string, unknown>) => Promise<AxiosResponse<T>>;
    post: <T = unknown>(url: string, data?: unknown) => Promise<AxiosResponse<T>>;
    put: <T = unknown>(url: string, data?: unknown) => Promise<AxiosResponse<T>>;
    patch: <T = unknown>(url: string, data?: unknown) => Promise<AxiosResponse<T>>;
    del: <T = unknown>(url: string) => Promise<AxiosResponse<T>>;
}
export declare function createApiClient(): ApiClient;
//# sourceMappingURL=api.d.ts.map