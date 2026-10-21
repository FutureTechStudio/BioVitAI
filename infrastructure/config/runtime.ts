import { z } from 'zod';

const loopback = z.enum(['127.0.0.1', 'localhost', '::1']);
const positivePort = z.coerce.number().int().min(1).max(65535);
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test']).default('development'),
  DATA_MODE: z.literal('synthetic').default('synthetic'),
  API_HOST: loopback.default('127.0.0.1'),
  API_PORT: positivePort.default(3001),
  PGHOST: loopback.default('127.0.0.1'),
  PGPORT: positivePort.default(54329),
  PGDATABASE: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,62}$/)
    .default('biovitai_dev'),
  PGUSER: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,62}$/)
    .default('biovitai_dev'),
  PGPASSWORD: z.string().min(24).max(256),
});

export type RuntimeConfig = z.infer<typeof schema>;

export function readRuntimeConfig(
  env: Record<string, string | undefined>,
): RuntimeConfig {
  const result = schema.safeParse(env);
  // Never include values or Zod's full issue objects in configuration errors.
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(
      `Invalid runtime configuration fields: ${fields.join(', ')}`,
    );
  }
  return result.data;
}
