import { z } from 'zod';
import type { Actor } from '../../../../modules/identity/src/contracts/auth.js';
import { ProfileError } from '../../../../modules/identity/src/contracts/profiles.js';
import type { PrivateObjects } from '../../../../modules/health/src/application/private-objects.js';
import { PrivateObjectError } from '../../../../modules/health/src/contracts/private-objects.js';

export function createPrivateObjectController(objects: PrivateObjects) {
  return async (request: Request, actor: Actor): Promise<Response> => {
    const url = new URL(request.url),
      parts = url.pathname.split('/').filter(Boolean);
    try {
      if (url.pathname === '/v1/storage/links' && request.method === 'POST')
        return Response.json(await objects.link(actor, await request.json()));
      if (
        parts.length === 4 &&
        parts[0] === 'v1' &&
        parts[1] === 'storage' &&
        request.method === 'GET'
      ) {
        if (parts[2] === 'objects') {
          const bytes = await objects.download(
            actor,
            parts[3]!,
            url.searchParams.get('ticket') ?? '',
          );
          return new Response(new Uint8Array(bytes), {
            headers: {
              'content-type': 'application/octet-stream',
              'content-disposition':
                'attachment; filename="private-object.bin"',
            },
          });
        }
        if (parts[2] === 'jobs') {
          const revision = z
            .string()
            .regex(/^(0|[1-9]\d*)$/)
            .parse(url.searchParams.get('revision'));
          return Response.json(
            await objects.job(
              actor,
              {
                profileId: url.searchParams.get('profileId') ?? '',
                revision: Number(revision),
              },
              parts[3]!,
            ),
          );
        }
      }
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return Response.json(
          { error: { code: 'INVALID_REQUEST' } },
          { status: 400 },
        );
      if (error instanceof ProfileError)
        return Response.json(
          { error: { code: error.code } },
          { status: error.status },
        );
      if (error instanceof PrivateObjectError)
        return Response.json(
          { error: { code: error.code } },
          {
            status:
              error.code === 'IDEMPOTENCY_CONFLICT'
                ? 409
                : error.code === 'OBJECT_TOO_LARGE'
                  ? 413
                  : 404,
          },
        );
      throw error;
    }
  };
}
