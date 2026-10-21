import { z } from 'zod';
import type { Actor } from '../../../identity/src/contracts/auth.js';
import type { ActiveProfileRef } from '../../../../shared/contracts/src/profile-context.js';
export const HealthToolInputSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('verified_reports') }).strict(),
  z.object({ name: z.literal('verified_observations') }).strict(),
  z.object({ name: z.literal('trends') }).strict(),
  z.object({ name: z.literal('organ_evidence') }).strict(),
  z
    .object({
      name: z.literal('compare_reports'),
      left: z.uuid(),
      right: z.uuid(),
    })
    .strict(),
]);
export function createHealthToolRegistry(service: {
  list(
    actor: Actor,
    context: ActiveProfileRef,
  ): Promise<{ id: string; state: string }[]>;
  observations(actor: Actor, context: ActiveProfileRef): Promise<unknown[]>;
  intelligence(
    actor: Actor,
    context: ActiveProfileRef,
    left?: string,
    right?: string,
  ): Promise<{ organs: unknown[] }>;
}) {
  return {
    async call(actor: Actor, context: ActiveProfileRef, raw: unknown) {
      const input = HealthToolInputSchema.parse(raw);
      switch (input.name) {
        case 'verified_reports':
          return (await service.list(actor, context))
            .filter((r) => r.state === 'verified')
            .map((r) => ({ id: r.id, state: r.state }));
        case 'verified_observations':
          return service.observations(actor, context);
        case 'organ_evidence':
          return (await service.intelligence(actor, context)).organs;
        case 'trends':
          return service.intelligence(actor, context);
        case 'compare_reports':
          return service.intelligence(actor, context, input.left, input.right);
      }
    },
  };
}
