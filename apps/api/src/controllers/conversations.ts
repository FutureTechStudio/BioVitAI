import { z } from 'zod';
import { ActiveProfileRefSchema } from '../../../../shared/contracts/src/profile-context.js';
import type { Actor } from '../../../../modules/identity/src/contracts/auth.js';
import { ProfileError } from '../../../../modules/identity/src/contracts/profiles.js';
import type { ConversationService } from '../../../../modules/ai/src/application/conversations.js';
export function createConversationController(service: ConversationService) {
  return async (request: Request, actor: Actor) => {
    try {
      const url = new URL(request.url),
        context = () =>
          ActiveProfileRefSchema.parse({
            profileId: request.headers.get('x-profile-id'),
            revision: Number(request.headers.get('x-context-revision') ?? -1),
          });
      if (
        url.pathname === '/v1/health/conversations' &&
        request.method === 'GET'
      )
        return Response.json({
          conversations: await service.list(actor, context()),
        });
      if (url.pathname === '/v1/health/messages' && request.method === 'POST')
        return Response.json(await service.send(actor, await request.json()));
      const id = url.pathname.split('/')[4];
      if (id && request.method === 'GET')
        return Response.json({
          messages: await service.messages(actor, context(), id),
        });
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    } catch (error) {
      if (error instanceof ProfileError)
        return Response.json(
          { error: { code: error.code } },
          { status: error.status },
        );
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return Response.json(
          { error: { code: 'INVALID_REQUEST' } },
          { status: 400 },
        );
      if (error instanceof Error && error.message === 'IDEMPOTENCY_CONFLICT')
        return Response.json(
          { error: { code: error.message } },
          { status: 409 },
        );
      throw error;
    }
  };
}
