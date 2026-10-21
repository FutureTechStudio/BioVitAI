import { z } from 'zod';
import type { Actor } from '../../../../modules/identity/src/contracts/auth.js';
import type { ReportService } from '../../../../modules/health/src/application/reports.js';
import { ReportError } from '../../../../modules/health/src/contracts/ingestion.js';
import { ProfileError } from '../../../../modules/identity/src/contracts/profiles.js';
import { ActiveProfileRefSchema } from '../../../../shared/contracts/src/profile-context.js';
import { REPORT_MAX_BYTES } from '../../../../shared/contracts/src/reports.js';

export function createReportController(service: ReportService) {
  return async (request: Request, actor: Actor): Promise<Response> => {
    const url = new URL(request.url),
      parts = url.pathname.split('/').filter(Boolean);
    const context = () =>
      ActiveProfileRefSchema.parse({
        profileId:
          request.headers.get('x-profile-id') ??
          url.searchParams.get('profileId'),
        revision: Number(
          request.headers.get('x-context-revision') ??
            url.searchParams.get('revision') ??
            -1,
        ),
      });
    try {
      if (
        url.pathname === '/v1/health/reports/upload' &&
        request.method === 'POST'
      ) {
        const ref = context();
        await service.authorizeUpload(actor, ref);
        const key = z.uuid().parse(request.headers.get('idempotency-key'));
        if (!request.body) throw new ReportError('EMPTY_UPLOAD');
        const reader = request.body.getReader(),
          parts: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > REPORT_MAX_BYTES) {
              await reader.cancel();
              throw new ReportError('REPORT_SIZE_LIMIT', 413);
            }
            parts.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) {
          bytes.set(part, offset);
          offset += part.length;
        }
        return Response.json(
          {
            report: await service.upload(
              actor,
              ref,
              bytes,
              key,
              decodeURIComponent(
                request.headers.get('x-file-name') ?? 'report',
              ),
            ),
          },
          { status: 201 },
        );
      }
      if (url.pathname === '/v1/health/reports' && request.method === 'GET')
        return Response.json({ reports: await service.list(actor, context()) });
      if (
        url.pathname === '/v1/health/observations' &&
        request.method === 'GET'
      )
        return Response.json({
          observations: await service.observations(actor, context()),
        });
      if (
        url.pathname === '/v1/health/intelligence' &&
        request.method === 'GET'
      )
        return Response.json(
          await service.intelligence(
            actor,
            context(),
            url.searchParams.get('left') ?? undefined,
            url.searchParams.get('right') ?? undefined,
          ),
        );
      if (
        url.pathname === '/v1/health/comparisons' &&
        request.method === 'POST'
      ) {
        const data = z
          .object({
            context: ActiveProfileRefSchema,
            left: z.uuid(),
            right: z.uuid(),
          })
          .strict()
          .refine((v) => v.left !== v.right)
          .parse(await request.json());
        return Response.json(
          await service.intelligence(
            actor,
            data.context,
            data.left,
            data.right,
          ),
        );
      }
      const id = z.uuid().parse(parts[3]);
      if (parts.length === 4 && request.method === 'GET')
        return Response.json(await service.detail(actor, context(), id));
      if (
        request.method === 'GET' &&
        parts[4] === 'pages' &&
        parts.length === 6
      ) {
        const bytes = await service.preview(
          actor,
          context(),
          id,
          Number(parts[5]),
        );
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': 'image/png',
            'content-disposition': 'inline',
            'cache-control': 'no-store',
          },
        });
      }
      if (request.method === 'GET' && parts[4] === 'original') {
        const result = await service.original(actor, context(), id);
        return new Response(new Uint8Array(result.bytes), {
          headers: {
            'content-type': result.mediaType,
            'content-disposition': 'attachment; filename="report"',
            'cache-control': 'no-store',
          },
        });
      }
      if (request.method === 'POST') {
        const data: unknown = await request.json();
        if (parts[4] === 'candidates')
          return Response.json(await service.manualCandidate(actor, id, data));
        if (parts[4] === 'relationships')
          return Response.json(await service.relate(actor, id, data));
        if (parts[4] === 'identity')
          return Response.json({
            report: await service.identity(actor, id, data),
          });
        if (parts[4] === 'verify')
          return Response.json(await service.verify(actor, id, data));
        if (parts[4] === 'retry' || parts[4] === 'cancel')
          return Response.json({
            report: await service.act(actor, id, data, parts[4]),
          });
      }
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    } catch (error) {
      if (error instanceof ReportError || error instanceof ProfileError)
        return Response.json(
          { error: { code: error.code } },
          { status: error.status },
        );
      if (
        error instanceof z.ZodError ||
        error instanceof SyntaxError ||
        error instanceof URIError
      )
        return Response.json(
          { error: { code: 'INVALID_REQUEST' } },
          { status: 400 },
        );
      throw error;
    }
  };
}
