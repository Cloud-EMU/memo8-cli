#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '..', 'src', 'lib', 'env.ts');

const urls = {
  dev: 'http://localhost:8099/api',
  staging: process.env.MEMO8_STAGING_API_URL || 'https://test-api.memo8.ai/api',
  prod: process.env.MEMO8_PROD_API_URL || 'https://api.memo8.ai/api',
};

const env = process.argv[2] || 'dev';

if (!urls[env]) {
  console.error(`Unknown environment: ${env}. Use: dev, staging, prod`);
  process.exit(1);
}

const content = `// This file is generated at build time. Do not edit manually.
// Use: npm run build:dev | build:staging | build:prod
export const DEFAULT_API_URL = '${urls[env]}';
`;

fs.writeFileSync(envFile, content);
console.log(`[env] ${env} → ${urls[env]}`);
