import { z } from 'zod';
import type { Actor } from '../../../identity/src/contracts/auth.js';
import { ProfileError } from '../../../identity/src/contracts/profiles.js';
import type { ProfilePolicy } from '../../../identity/src/contracts/profiles.js';
import {
  JourneyQuerySchema,
  JourneySnapshotSchema,
  ReviewJourneySchema,
  SaveStorySchema,
} from '../../../../shared/contracts/src/journey.js';
import type { ActiveProfileRef } from '../../../../shared/contracts/src/profile-context.js';
import type {
  JourneyData,
  JourneyRepository,
  StoryManifest,
} from '../contracts/journey.js';
import { JourneyError } from '../contracts/journey.js';
import {
  changedStory,
  currentStoryRecords,
  dateOverlaps,
  orderJourney,
} from '../domain/journey.js';

export function createJourneyService(
  policy: ProfilePolicy,
  repo: JourneyRepository,
) {
  const read = { category: 'health', action: 'read', purpose: 'care' } as const;
  const write = { ...read, action: 'write' } as const;
  function manifest(data: JourneyData): StoryManifest {
    const entries: [string, string][] = [
      ...data.events.map(
        (e) =>
          [
            e.id,
            repo.hash([
              e.revision,
              e.date,
              e.endDate,
              e.reportId,
              e.rawFieldId,
              e.recordedAt,
              e.status,
            ]),
          ] as [string, string],
      ),
      ...data.records.map(
        (r) =>
          [
            'context:' + r.id,
            repo.hash([r.versionId, r.unavailableReason]),
          ] as [string, string],
      ),
      ...data.reports.map(
        (r) =>
          ['report:' + r.id, repo.hash([r.state, r.revision])] as [
            string,
            string,
          ],
      ),
    ];
    return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
  }
  return {
    async query(actor: Actor, raw: unknown) {
      const input = JourneyQuerySchema.parse(raw),
        context = input.context;
      // UI hint only; the actual save always re-authorizes. Denial does not poison the read transaction.
      let canWrite = false;
      try {
        await policy.withActiveAccess(actor, context, write, async () => {
          canWrite = true;
        });
      } catch (error) {
        if (!(error instanceof ProfileError)) throw error;
      }
      return policy.withActiveAccess(actor, context, read, async (profile) => {
        const data = await repo.read(
            profile.id,
            actor.id,
            profile.ownerId === actor.id,
          ),
          current = manifest(data),
          snapshot = repo.hash(current);
        if (input.expectedSnapshot && input.expectedSnapshot !== snapshot)
          throw new JourneyError('JOURNEY_CHANGED');
        const checkpoint = await repo.checkpoint(profile.id, actor.id);
        const changes = changedStory(current, checkpoint?.manifest ?? null);
        const filtered = orderJourney(
          data.events.filter(
            (e) =>
              (input.filter === 'all' || e.kind === input.filter) &&
              dateOverlaps(
                e.date.value,
                input.from,
                input.to,
                e.endDate?.value,
              ),
          ),
          input.order,
        );
        const dates = data.events
          .flatMap((e) => (e.date.value ? [e.date.value] : []))
          .sort();
        const records = currentStoryRecords(data.records);
        const conflicts = new Set(
          records.flatMap((r) => r.content?.conflictsWith ?? []),
        );
        return JourneySnapshotSchema.parse({
          schemaVersion: 1,
          snapshot,
          generatedAt: new Date().toISOString(),
          canWrite,
          firstReview: !checkpoint,
          reviewedAt: checkpoint?.reviewedAt ?? null,
          records: data.records,
          events: filtered.slice(input.offset, input.offset + 40),
          nextOffset:
            input.offset + 40 < filtered.length ? input.offset + 40 : null,
          totalEvents: filtered.length,
          summary: {
            observations: data.events.filter((e) => e.kind === 'observation')
              .length,
            contextRecords: records.length,
            undated: data.events.filter((e) => !e.date.value).length,
            earliest: dates[0] ?? null,
            latest: dates.at(-1) ?? null,
          },
          changes: changes.slice(0, 20).map((change) => {
            const event = data.events.find((e) => e.id === change.id),
              report = data.reports.find((r) => 'report:' + r.id === change.id),
              record = data.records.find(
                (r) => 'context:' + r.id === change.id,
              );
            return {
              ...change,
              title:
                change.kind === 'removed'
                  ? 'A previously recorded item is no longer current'
                  : (event?.title ??
                    report?.fileName ??
                    record?.content?.information.label ??
                    'Context availability changed'),
              detail:
                change.kind === 'removed'
                  ? 'The current source or permission state has changed.'
                  : report
                    ? `Report record ${change.kind}; this is not a medical change.`
                    : event?.date.value
                      ? `Evidence dated ${event.date.value}; ${change.kind === 'added' ? 'historical evidence added or confirmed' : 'record corrected or updated'}.`
                      : 'Recorded context changed; event date may be unknown.',
              reportId: event?.reportId ?? report?.id ?? null,
              recordId: event?.recordId ?? record?.id ?? null,
            };
          }),
          totalChanges: changes.length,
          tasks: [
            ...data.reports
              .filter((r) =>
                ['review_needed', 'quarantined', 'failed'].includes(r.state),
              )
              .sort(
                (a, b) =>
                  ['quarantined', 'failed', 'review_needed'].indexOf(a.state) -
                    ['quarantined', 'failed', 'review_needed'].indexOf(
                      b.state,
                    ) || a.id.localeCompare(b.id),
              )
              .map((r) => ({
                id: 'report:' + r.id,
                title:
                  r.state === 'failed'
                    ? 'Review processing failure'
                    : r.state === 'quarantined'
                      ? 'Resolve report identity'
                      : 'Review extracted details',
                reason: `${r.fileName}: ${r.state.replaceAll('_', ' ')}. This is a record task.`,
                reportId: r.id,
                recordId: null,
              })),
            ...records
              .filter(
                (r) =>
                  r.content &&
                  (r.content.state === 'disputed' ||
                    r.content.conflictsWith.length ||
                    conflicts.has(r.id)),
              )
              .map((r) => ({
                id: 'context:' + r.id,
                title: 'Clarify recorded guidance or context',
                reason: `${r.content!.information.label}: a dispute or possible conflict was recorded. The app does not choose which instruction to follow.`,
                reportId: null,
                recordId: r.id,
              })),
            ...records
              .filter(
                (r) =>
                  r.content?.state === 'current' &&
                  r.content.information.kind === 'care_guidance' &&
                  r.content.information.followUp.value,
              )
              .map((r) => ({
                id: 'follow-up:' + r.id,
                title: 'Review your recorded follow-up',
                reason: `${r.content!.information.label}: follow-up date as recorded ${r.content!.information.kind === 'care_guidance' ? r.content!.information.followUp.value : ''}. This is a documented/reported task, not a new testing recommendation.`,
                reportId: null,
                recordId: r.id,
              })),
            ...records
              .filter(
                (r) =>
                  r.content?.information.kind === 'condition' &&
                  r.content.information.assertion === 'concern' &&
                  ['current', 'uncertain'].includes(r.content.state),
              )
              .map((r) => ({
                id: 'question:' + r.id,
                title: 'Prepare your recorded question',
                reason: r.content!.information.details,
                reportId: null,
                recordId: r.id,
              })),
          ].slice(0, 30),
        });
      });
    },
    save(actor: Actor, raw: unknown) {
      const input = SaveStorySchema.parse(raw);
      return policy.withActiveAccess(actor, input.context, write, (profile) =>
        repo.save(
          actor.id,
          profile.kind === 'self' && profile.ownerId === actor.id
            ? 'self'
            : 'caregiver',
          input,
        ),
      );
    },
    history(actor: Actor, context: ActiveProfileRef, id: string) {
      return policy.withActiveAccess(actor, context, read, (profile) =>
        repo.history(profile.id, actor.id, z.uuid().parse(id)),
      );
    },
    review(actor: Actor, raw: unknown) {
      const input = ReviewJourneySchema.parse(raw);
      return policy.withActiveAccess(
        actor,
        input.context,
        read,
        async (profile) => {
          const data = await repo.read(
            profile.id,
            actor.id,
            profile.ownerId === actor.id,
          );
          await repo.review(actor.id, input, manifest(data));
          return { reviewed: true };
        },
      );
    },
  };
}
export type JourneyService = ReturnType<typeof createJourneyService>;
