import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import type { BetterAuthOptions } from 'better-auth';
import type pg from 'pg';
import type {
  Actor,
  IdentityMailer,
  SessionReader,
} from '../contracts/auth.js';

export interface AuthConfig {
  origin: string;
  secret: string;
  webOrigin?: string;
}

export function createIdentityAuth(
  pool: pg.Pool,
  config: AuthConfig,
  mailer: IdentityMailer,
) {
  const options = {
    appName: 'BiovitAI',
    database: pool,
    baseURL: config.origin,
    basePath: '/api/auth',
    secret: config.secret,
    plugins: [expo()],
    trustedOrigins: [
      config.origin,
      'biovitai://',
      ...(config.webOrigin ? [config.webOrigin] : []),
    ],
    telemetry: { enabled: false },
    logger: {
      log: (level) => {
        if (level === 'error')
          console.error(JSON.stringify({ event: 'identity.provider_error' }));
      },
    },
    user: { modelName: 'identity_user' },
    account: {
      modelName: 'identity_account',
      accountLinking: { enabled: false },
    },
    verification: {
      modelName: 'identity_verification',
      storeIdentifier: 'hashed',
    },
    session: {
      modelName: 'identity_session',
      expiresIn: 60 * 60 * 24,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.deliver({
          kind: 'password-reset',
          recipient: user.email,
          url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 30,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.deliver({
          kind: 'verification',
          recipient: user.email,
          url,
        });
      },
    },
    advanced: {
      cookiePrefix: 'biovitai',
      database: { generateId: 'uuid' },
      useSecureCookies: false, // Loopback HTTP only; remote/prod rejected by runtime config.
      ipAddress: { ipAddressHeaders: ['x-biovitai-remote-address'] },
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    rateLimit: {
      enabled: true,
      modelName: 'identity_rate_limit',
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/send-verification-email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 5 },
      },
    },
  } satisfies BetterAuthOptions;
  const auth = betterAuth(options);
  const sessions: SessionReader = {
    async currentActor(headers) {
      const cookie = headers.cookie;
      if (!cookie) return null;
      const result = await auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      });
      if (!result?.user.emailVerified) return null;
      return {
        id: result.user.id,
        sessionId: result.session.id,
        email: result.user.email,
        emailVerified: true,
      } satisfies Actor;
    },
  };

  const methods = new Map([
    ['sign-up/email', 'POST'],
    ['sign-in/email', 'POST'],
    ['sign-out', 'POST'],
    ['get-session', 'GET'],
    ['verify-email', 'GET'],
    ['send-verification-email', 'POST'],
    ['request-password-reset', 'POST'],
    ['reset-password', 'POST'],
    ['revoke-sessions', 'POST'],
    ['revoke-session', 'POST'],
  ]);
  const handler = async (request: Request) => {
    const route = new URL(request.url).pathname.slice('/api/auth/'.length);
    const method =
      methods.get(route) ??
      (/^reset-password\/[A-Za-z0-9_-]{16,256}$/.test(route)
        ? 'GET'
        : undefined);
    if (!method)
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    if (request.method !== method)
      return Response.json(
        { error: { code: 'METHOD_NOT_ALLOWED' } },
        { status: 405 },
      );
    const response = await auth.handler(request);
    // Client sessions are cookie-based. Never expose opaque session tokens in JSON.
    if (response.headers.get('content-type')?.includes('application/json')) {
      const raw = await response.text();
      // Better Auth redirects can retain a JSON content type with an empty body.
      // Preserve those redirects instead of attempting to parse an absent payload.
      if (!raw.trim())
        return new Response(null, {
          status: response.status,
          headers: response.headers,
        });
      const data: unknown = JSON.parse(raw);
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const clean = { ...data } as Record<string, unknown>;
        delete clean.token;
        if (typeof clean.session === 'object' && clean.session !== null) {
          const session = { ...clean.session } as Record<string, unknown>;
          delete session.token;
          clean.session = session;
        }
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        return Response.json(clean, { status: response.status, headers });
      }
      return Response.json(data, {
        status: response.status,
        headers: response.headers,
      });
    }
    return response;
  };
  return {
    options,
    sessions,
    handler,
    async ready() {
      await pool.query(
        'SELECT 1 FROM identity_user, identity_session, identity_account, identity_verification, identity_rate_limit LIMIT 0',
      );
    },
  };
}
