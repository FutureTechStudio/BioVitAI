import { z } from 'zod';
import type { RuntimeConfig } from './runtime.js';

export function readIdentityConfig(
  env: Record<string, string | undefined>,
  runtime: RuntimeConfig,
) {
  const secret = z.string().min(32).max(256).safeParse(env.AUTH_SECRET);
  if (!secret.success)
    throw new Error('Invalid runtime configuration fields: AUTH_SECRET');
  const host = runtime.API_HOST.includes(':')
    ? `[${runtime.API_HOST}]`
    : runtime.API_HOST;
  return {
    secret: secret.data,
    origin: `http://${host}:${runtime.API_PORT}`,
    webOrigin: `http://${host}:3000`,
  };
}
