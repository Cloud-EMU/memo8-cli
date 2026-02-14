import fs from 'fs';
import path from 'path';
import os from 'os';
import type { GlobalConfig, LocalConfig, User } from '../types/index.js';
import { DEFAULT_API_URL } from './env.js';

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.memo8');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_FILE = '.memo8.json';

export function loadGlobalConfig(): GlobalConfig {
  try {
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const data = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
      return JSON.parse(data) as GlobalConfig;
    }
  } catch {
    // Return empty config on error
  }
  return {};
}

export function saveGlobalConfig(config: GlobalConfig): void {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function loadLocalConfig(): LocalConfig {
  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, LOCAL_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      try {
        const data = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(data) as LocalConfig;
      } catch {
        return {};
      }
    }
    dir = path.dirname(dir);
  }
  return {};
}

export function saveLocalConfig(config: LocalConfig): void {
  const configPath = path.join(process.cwd(), LOCAL_CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function getToken(): string | null {
  if (process.env.MEMO8_API_TOKEN) {
    return process.env.MEMO8_API_TOKEN;
  }
  const config = loadGlobalConfig();
  return config.token || null;
}

export function getApiUrl(): string {
  if (process.env.MEMO8_API_URL) {
    return process.env.MEMO8_API_URL;
  }
  const config = loadGlobalConfig();
  return config.apiUrl || DEFAULT_API_URL;
}

export function getProjectId(): number | null {
  const local = loadLocalConfig();
  return local.projectId || null;
}

export function getTeamId(): number | null {
  const config = loadGlobalConfig();
  return config.teamId || null;
}

export function setTeamId(teamId: number): void {
  const config = loadGlobalConfig();
  config.teamId = teamId;
  saveGlobalConfig(config);
}

export function setAuth(token: string, user: User, teamId?: number): void {
  const config = loadGlobalConfig();
  config.token = token;
  config.user = user;
  if (teamId) {
    config.teamId = teamId;
  }
  saveGlobalConfig(config);
}

export function clearAuth(): void {
  const config = loadGlobalConfig();
  delete config.token;
  delete config.user;
  delete config.teamId;
  saveGlobalConfig(config);
}
