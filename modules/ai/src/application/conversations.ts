import { z } from 'zod';
import { createHealthToolRegistry } from './tools.js';
import type { ProfilePolicy } from '../../../identity/src/contracts/profiles.js';
import type { Actor } from '../../../identity/src/contracts/auth.js';
import type { ActiveProfileRef } from '../../../../shared/contracts/src/profile-context.js';
import {
  MessageInputSchema,
  validateHealthExplanation,
} from '../../../../shared/contracts/src/conversations.js';
import type {
  ConversationStore,
  HealthExplanationGateway,
} from '../../../../shared/contracts/src/conversations.js';
import {
  ObservationEvidenceSchema,
  HealthAnalysisSchema,
} from '../../../../shared/contracts/src/intelligence.js';
// Fixed read adapter; the orchestrator has neither database nor arbitrary network/code access.
export interface HealthReadTools {
  list(
    actor: Actor,
    context: ActiveProfileRef,
  ): Promise<{ id: string; state: string }[]>;
  observations(actor: Actor, context: ActiveProfileRef): Promise<unknown[]>;
  intelligence(
    actor: Actor,
    context: ActiveProfileRef,
  ): Promise<{ organs: unknown[] }>;
}
export function createConversationService(
  policy: ProfilePolicy,
  store: ConversationStore,
  gateway: HealthExplanationGateway,
  health: HealthReadTools,
) {
  const tools = createHealthToolRegistry(health);
  const access = <T>(
    actor: Actor,
    context: ActiveProfileRef,
    work: () => Promise<T>,
  ) =>
    policy.withActiveAccess(
      actor,
      context,
      { category: 'health', action: 'read', purpose: 'care' },
      work,
      'health_ai',
    );
  async function snapshot(actor: Actor, context: ActiveProfileRef) {
    return access(actor, context, async () => {
      const evidence = z
        .array(ObservationEvidenceSchema)
        .parse(
          await tools.call(actor, context, { name: 'verified_observations' }),
        );
      const sorted = evidence.slice().sort((a, b) => a.id.localeCompare(b.id));
      const analysis = HealthAnalysisSchema.parse(
        await tools.call(actor, context, { name: 'trends' }),
      );
      return {
        evidence: sorted,
        analysis,
        revision: store.digest({ evidence: sorted, analysis }),
      };
    });
  }
  return {
    list: (actor: Actor, context: ActiveProfileRef) =>
      access(actor, context, () => store.list(context.profileId)),
    async messages(actor: Actor, context: ActiveProfileRef, id: string) {
      const current = await snapshot(actor, context);
      return access(actor, context, async () => {
        const rows = await store.messages(
          context.profileId,
          z.uuid().parse(id),
        );
        return rows.map((row) =>
          row.evidenceRevision === current.revision
            ? row
            : { ...row, answer: null, code: 'EVIDENCE_CHANGED' },
        );
      });
    },
    async send(actor: Actor, data: unknown) {
      const input = MessageInputSchema.parse(data),
        context = input.context;
      const initial = await snapshot(actor, context),
        prior = await access(actor, context, () =>
          store.prior(context.profileId, input.requestKey),
        );
      if (prior) {
        if (
          prior.question !== input.question ||
          prior.conversationId !== input.conversationId
        )
          throw new Error('IDEMPOTENCY_CONFLICT');
        return prior.evidenceRevision === initial.revision
          ? prior
          : { answer: null, code: 'EVIDENCE_CHANGED' };
      }
      const claimed = await access(actor, context, () =>
        store.claim(
          context.profileId,
          input.requestKey,
          store.digest([input.conversationId, input.question]),
        ),
      );
      if (!claimed)
        return { answer: null, code: 'REQUEST_IN_PROGRESS_OR_INTERRUPTED' };
      const beforeDispatch = async () =>
        (await snapshot(actor, context)).revision === initial.revision;
      if (!(await beforeDispatch()))
        return { answer: null, code: 'EVIDENCE_CHANGED' };
      const response = initial.evidence.length
        ? await gateway.generate(
            {
              question: input.question,
              analysis: {
                version: initial.analysis.version,
                omittedObservations: Math.max(0, initial.evidence.length - 30),
                cohorts: initial.analysis.cohorts
                  .map((cohort) => ({
                    observationIds: cohort.observations
                      .filter((row) =>
                        initial.evidence
                          .slice(0, 30)
                          .some((e) => e.id === row.id),
                      )
                      .map((row) => row.id),
                  }))
                  .filter((cohort) => cohort.observationIds.length > 0),
                exclusions: initial.analysis.exclusions
                  .filter((row) =>
                    initial.evidence
                      .slice(0, 30)
                      .some((e) => e.id === row.observation.id),
                  )
                  .map((row) => ({
                    observationId: row.observation.id,
                    reason: row.reason,
                  })),
                organs: initial.analysis.organs.map(({ name, state }) => ({
                  name,
                  state,
                })),
              },
              evidence: initial.evidence
                .slice(0, 30)
                .map(({ id, reportId, revision, name, value, unit, date }) => ({
                  id,
                  reportId,
                  revision,
                  name,
                  value,
                  unit,
                  date,
                })),
            },
            { beforeDispatch },
          )
        : { status: 'unavailable' as const, code: 'NO_VERIFIED_EVIDENCE' };
      return access(actor, context, async () => {
        const now = await snapshot(actor, context);
        if (now.revision !== initial.revision)
          return { answer: null, code: 'EVIDENCE_CHANGED' };
        let answer = null,
          code: string | null =
            response.status === 'unavailable' ? response.code : null;
        if (response.status === 'ok') {
          try {
            answer = validateHealthExplanation(response.answer, {
              question: input.question,
              evidence: initial.evidence.slice(0, 30),
            });
          } catch {
            code = 'INVALID_OUTPUT';
          }
        }
        await store.save({
          profileId: context.profileId,
          actorId: actor.id,
          conversationId: input.conversationId,
          requestKey: input.requestKey,
          question: input.question,
          answer,
          code,
          evidenceRevision: now.revision,
        });
        return { answer, code };
      });
    },
  };
}
export type ConversationService = ReturnType<typeof createConversationService>;
