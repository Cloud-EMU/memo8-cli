import type { GlobalConfig, LocalConfig, User } from '../types/index.js';
export declare function loadGlobalConfig(): GlobalConfig;
export declare function saveGlobalConfig(config: GlobalConfig): void;
export declare function loadLocalConfig(): LocalConfig;
export declare function saveLocalConfig(config: LocalConfig): void;
export declare function getToken(): string | null;
export declare function getApiUrl(): string;
export declare function getProjectId(): number | null;
export declare function setAuth(token: string, user: User): void;
export declare function clearAuth(): void;
//# sourceMappingURL=config.d.ts.map