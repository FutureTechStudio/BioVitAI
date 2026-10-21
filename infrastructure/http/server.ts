import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { withTrace, telemetry, traceId } from '../observability/tracing.js';
import { Readable } from 'node:stream';
import type { StatusService } from '../../shared/contracts/src/runtime.js';
import type { Actor } from '../../modules/identity/src/contracts/auth.js';

export interface IdentityRoutes {
  origin: string;
  webOrigin?: string;
  handler(request: Request): Promise<Response>;
  currentActor(
    headers: Record<string, string | undefined>,
  ): Promise<Actor | null>;
  profiles?(request: Request, actor: Actor): Promise<Response>;
  storage?(request: Request, actor: Actor): Promise<Response>;
  health?(request: Request, actor: Actor): Promise<Response>;
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let failed = false;
    const parts: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > 16384) {
        failed = true;
        parts.length = 0;
        reject(new Error('BODY_TOO_LARGE'));
        return;
      }
      parts.push(chunk);
    });
    request.once('end', () => {
      if (!failed) resolve(Buffer.concat(parts));
    });
    request.once('error', () => reject(new Error('BODY_READ_FAILED')));
  });
}

// Transport adapter only. Application services own readiness behavior.
export function createApiServer(
  status: StatusService,
  identity?: IdentityRoutes,
) {
  const server = createServer((request, response) =>
    withTrace(async () => {
      response.once('finish', () =>
        telemetry('api.complete', { status: response.statusCode }),
      );
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'",
      );
      response.setHeader('X-Request-Id', traceId());
      try {
        const pathname = new URL(request.url ?? '/', 'http://localhost')
          .pathname;
        const profileRoute =
          pathname === '/v1/profile-context' ||
          pathname === '/v1/profiles' ||
          pathname.startsWith('/v1/profiles/') ||
          pathname.startsWith('/v1/profile-invitations/');
        const storageRoute = pathname.startsWith('/v1/storage/');
        const healthRoute = pathname.startsWith('/v1/health/');
        const uploadRoute =
          pathname === '/v1/health/reports/upload' && request.method === 'POST';
        if (
          identity &&
          (pathname.startsWith('/api/auth/') ||
            (profileRoute && identity.profiles) ||
            (storageRoute && identity.storage) ||
            (healthRoute && identity.health))
        ) {
          if (request.method !== 'GET' && request.method !== 'POST') {
            request.resume();
            response
              .writeHead(405)
              .end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED' } }));
            return;
          }
          if (
            request.method === 'POST' &&
            request.headers.origin !== identity.origin &&
            (!identity.webOrigin ||
              request.headers.origin !== identity.webOrigin)
          ) {
            request.resume();
            response
              .writeHead(403)
              .end(JSON.stringify({ error: { code: 'ORIGIN_FORBIDDEN' } }));
            return;
          }
          if (
            request.method === 'POST' &&
            !(uploadRoute
              ? request.headers['content-type'] === 'application/octet-stream'
              : request.headers['content-type']?.startsWith('application/json'))
          ) {
            request.resume();
            response
              .writeHead(415)
              .end(JSON.stringify({ error: { code: 'JSON_REQUIRED' } }));
            return;
          }
          if (
            Number(request.headers['content-length'] ?? 0) >
            (uploadRoute ? 20971520 : 16384)
          ) {
            request.resume();
            response
              .writeHead(413)
              .end(JSON.stringify({ error: { code: 'BODY_TOO_LARGE' } }));
            return;
          }
          const headers = new Headers();
          for (const name of [
            'cookie',
            'content-type',
            'origin',
            'user-agent',
            'x-profile-id',
            'x-context-revision',
            'idempotency-key',
            'x-file-name',
            'expo-origin',
          ]) {
            const value = request.headers[name];
            if (typeof value === 'string') headers.set(name, value);
          }
          // Rate limiting uses the socket address. Client forwarding/IP headers are ignored.
          headers.set(
            'x-biovitai-remote-address',
            request.socket.remoteAddress ?? '127.0.0.1',
          );
          let body: Buffer | undefined;
          if (request.method === 'POST' && !uploadRoute) {
            try {
              body = await readBody(request);
            } catch {
              response
                .writeHead(413)
                .end(JSON.stringify({ error: { code: 'BODY_TOO_LARGE' } }));
              return;
            }
          } else if (!uploadRoute) request.resume();
          const inputOptions: RequestInit & { duplex?: 'half' } = {
            method: request.method,
            headers,
            ...(uploadRoute
              ? {
                  body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
                  duplex: 'half' as const,
                }
              : body
                ? { body: new Uint8Array(body) }
                : {}),
          };
          const input = new Request(
            new URL(request.url ?? '/', identity.origin),
            inputOptions,
          );
          let result: Response;
          if (
            (profileRoute && identity.profiles) ||
            (storageRoute && identity.storage) ||
            (healthRoute && identity.health)
          ) {
            const actor = await identity.currentActor({
              cookie: request.headers.cookie,
            });
            result = actor
              ? await (
                  healthRoute
                    ? identity.health!
                    : storageRoute
                      ? identity.storage!
                      : identity.profiles!
                )(input, actor)
              : Response.json(
                  { error: { code: 'UNAUTHENTICATED' } },
                  { status: 401 },
                );
            if (!actor) request.resume();
          } else result = await identity.handler(input);
          for (const [name, value] of result.headers) {
            if (
              !['set-cookie', 'content-length', 'cache-control'].includes(name)
            )
              response.setHeader(name, value);
          }
          const cookies = result.headers.getSetCookie();
          if (cookies.length) response.setHeader('Set-Cookie', cookies);
          response
            .writeHead(result.status)
            .end(Buffer.from(await result.arrayBuffer()));
          return;
        }
        request.resume();
        if (identity && pathname === '/v1/me') {
          if (request.method !== 'GET') {
            response
              .writeHead(405)
              .end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED' } }));
            return;
          }
          const actor = await identity.currentActor({
            cookie: request.headers.cookie,
          });
          response.writeHead(actor ? 200 : 401).end(
            JSON.stringify(
              actor
                ? {
                    actor: {
                      id: actor.id,
                      email: actor.email,
                      emailVerified: actor.emailVerified,
                    },
                  }
                : { error: { code: 'UNAUTHENTICATED' } },
            ),
          );
          return;
        }
        const known = ['/health/live', '/health/ready'].includes(pathname);
        if (!known) {
          response
            .writeHead(404)
            .end(JSON.stringify({ error: { code: 'NOT_FOUND' } }));
        } else if (request.method !== 'GET') {
          response.setHeader('Allow', 'GET');
          response
            .writeHead(405)
            .end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED' } }));
        } else {
          const result =
            pathname === '/health/live' ? status.live() : await status.ready();
          response
            .writeHead(result.status === 'ok' ? 200 : 503)
            .end(JSON.stringify(result));
        }
      } catch {
        response
          .writeHead(500)
          .end(JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }));
      }
    }),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 100;
  return server;
}
