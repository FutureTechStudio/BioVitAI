import { z } from 'zod';
import type { Actor } from '../../../../modules/identity/src/contracts/auth.js';
import { ProfileError } from '../../../../modules/identity/src/application/profiles.js';
import type { ProfileService } from '../../../../modules/identity/src/application/profiles.js';

export function createProfileController(service: ProfileService) {
  return async (request: Request, actor: Actor): Promise<Response> => {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const method = request.method;
    const json = (data: unknown, status = 200) =>
      Response.json(data, { status });
    try {
      if (url.pathname === '/v1/profile-context') {
        if (method === 'GET') return json(await service.current(actor));
        if (method === 'POST')
          return json(await service.select(actor, await request.json()));
      }
      if (
        url.pathname === '/v1/profile-invitations/accept' &&
        method === 'POST'
      )
        return json(await service.accept(actor, await request.json()));
      if (url.pathname === '/v1/profiles') {
        if (method === 'GET')
          return json({ profiles: await service.list(actor) });
        if (method === 'POST')
          return json(
            { profile: await service.create(actor, await request.json()) },
            201,
          );
      }
      if (parts[0] === 'v1' && parts[1] === 'profiles' && parts[2]) {
        const id = parts[2];
        if (parts.length === 3 && method === 'GET') {
          const purpose = z
            .enum(['care', 'wellness'])
            .parse(url.searchParams.get('purpose') ?? 'care');
          return json({ profile: await service.read(actor, id, purpose) });
        }
        if (parts.length === 4) {
          if (parts[3] === 'contact') {
            if (method === 'GET') return json(await service.contact(actor, id));
            if (method === 'POST') {
              await service.setContact(actor, id, await request.json());
              return json({ recorded: true });
            }
          }
          if (parts[3] === 'sharing' && method === 'GET')
            return json({
              sharing: await service.history(actor, id, 'sharing'),
            });
          if (parts[3] === 'consents') {
            if (method === 'GET')
              return json({
                consents: await service.history(actor, id, 'consents'),
              });
            if (method === 'POST') {
              await service.consent(actor, id, await request.json());
              return json({ recorded: true });
            }
          }
          if (parts[3] === 'audit' && method === 'GET')
            return json({ events: await service.history(actor, id, 'audit') });
          if (parts[3] === 'invitations' && method === 'POST')
            return json(
              await service.invite(actor, id, await request.json()),
              201,
            );
        }
        if (
          parts.length === 6 &&
          parts[3] === 'sharing' &&
          parts[5] === 'revoke' &&
          method === 'POST'
        ) {
          z.object({})
            .strict()
            .parse(await request.json());
          await service.revoke(actor, id, parts[4]!);
          return json({ revoked: true });
        }
      }
      return json({ error: { code: 'NOT_FOUND' } }, 404);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ error: { code: 'INVALID_REQUEST' } }, 400);
      if (error instanceof ProfileError)
        return json({ error: { code: error.code } }, error.status);
      throw error;
    }
  };
}
