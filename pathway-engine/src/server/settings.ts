/**
 * Reads configuration from environment variables (see .env.example).
 * In development, missing secrets are generated once into .data/dev-secrets.json so the app runs with no setup.
 * In production (NODE_ENV=production) the server refuses to start without them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export interface Settings {
  port: number;
  production: boolean;
  databaseUrl?: string;
  dataDir: string;
  encryptionKey: Buffer;
  sessionSecret: string;
  mentorCode: string;
  adminCode: string;
  platformKey: string;
}

/**
 * Secrets come from the environment. In local development, missing secrets are generated once
 * into .data/dev-secrets.json (git-ignored) so the app runs without setup. Production refuses to start without them.
 */
export function loadSettings(env = process.env): Settings {
  const production = env.NODE_ENV === 'production';
  const dataDir = env.DATA_DIR ?? '.data';
  const required = ['DATA_ENCRYPTION_KEY', 'SESSION_SECRET', 'MENTOR_ACCESS_CODE', 'ADMIN_ACCESS_CODE', 'COURSE_PLATFORM_KEY'] as const;
  let dev: Record<string, string> = {};
  if (required.some((k) => !env[k])) {
    if (production) throw new Error(`Missing required settings: ${required.filter((k) => !env[k]).join(', ')}`);
    const file = join(dataDir, 'dev-secrets.json');
    if (existsSync(file)) dev = JSON.parse(readFileSync(file, 'utf8'));
    else {
      mkdirSync(dataDir, { recursive: true });
      dev = {
        DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
        SESSION_SECRET: randomBytes(32).toString('base64url'),
        MENTOR_ACCESS_CODE: `mentor-${randomBytes(4).toString('hex')}`,
        ADMIN_ACCESS_CODE: `admin-${randomBytes(4).toString('hex')}`,
        COURSE_PLATFORM_KEY: randomBytes(24).toString('base64url'),
      };
      writeFileSync(file, JSON.stringify(dev, null, 2), { mode: 0o600 });
    }
  }
  const get = (k: (typeof required)[number]) => env[k] ?? dev[k];
  return {
    port: Number(env.PORT ?? 8787),
    production,
    databaseUrl: env.DATABASE_URL || undefined,
    dataDir,
    encryptionKey: Buffer.from(get('DATA_ENCRYPTION_KEY'), 'base64'),
    sessionSecret: get('SESSION_SECRET'),
    mentorCode: get('MENTOR_ACCESS_CODE'),
    adminCode: get('ADMIN_ACCESS_CODE'),
    platformKey: get('COURSE_PLATFORM_KEY'),
  };
}
