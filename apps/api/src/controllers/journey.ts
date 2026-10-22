import { z } from 'zod';
import type { Actor } from '../../../../modules/identity/src/contracts/auth.js';
import { ProfileError } from '../../../../modules/identity/src/contracts/profiles.js';
import type { JourneyService } from '../../../../modules/health/src/application/journey.js';
import { JourneyError } from '../../../../modules/health/src/contracts/journey.js';
import { ActiveProfileRefSchema } from '../../../../shared/contracts/src/profile-context.js';

export function createJourneyController(service: JourneyService) {
  return async (request: Request, actor: Actor): Promise<Response> => {
    try {
      const path = new URL(request.url).pathname;
      const context = () =>
        ActiveProfileRefSchema.parse({
          profileId: request.headers.get('x-profile-id'),
          revision: Number(request.headers.get('x-context-revision') ?? -1),
        });
      if (path === '/v1/health/journey' && request.method === 'GET')
        return Response.json(
          await service.query(actor, { context: context() }),
        );
      if (path === '/v1/health/journey/query' && request.method === 'POST')
        return Response.json(await service.query(actor, await request.json()));
      if (path === '/v1/health/journey/records' && request.method === 'POST')
        return Response.json(await service.save(actor, await request.json()));
      if (path === '/v1/health/journey/review' && request.method === 'POST')
        return Response.json(await service.review(actor, await request.json()));
      const match = path.match(
        /^\/v1\/health\/journey\/records\/([a-f0-9-]+)$/i,
      );
      if (match && request.method === 'GET')
        return Response.json({
          versions: await service.history(actor, context(), match[1]!),
        });
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    } catch (error) {
      if (error instanceof JourneyError || error instanceof ProfileError)
        return Response.json(
          { error: { code: error.code } },
          { status: error.status },
        );
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return Response.json(
          { error: { code: 'INVALID_REQUEST' } },
          { status: 400 },
        );
      throw error;
    }
  };
}
