import type {
  JourneyEvent,
  StoryRecord,
} from '../../../../shared/contracts/src/journey.js';
import { storyDateBounds } from '../../../../shared/contracts/src/journey.js';

export function orderJourney(
  events: JourneyEvent[],
  order: 'effective' | 'recorded',
) {
  return [...events].sort((a, b) => {
    if (order === 'recorded')
      return (
        b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id)
      );
    if (!a.date.value && b.date.value) return 1;
    if (a.date.value && !b.date.value) return -1;
    return (
      (b.date.value ?? '').localeCompare(a.date.value ?? '') ||
      b.recordedAt.localeCompare(a.recordedAt) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function changedStory(
  current: Record<string, string>,
  previous: Record<string, string> | null,
) {
  if (!previous) return [];
  return [...new Set([...Object.keys(current), ...Object.keys(previous)])]
    .sort()
    .flatMap((id) =>
      current[id] === previous[id]
        ? []
        : [
            {
              id,
              kind: !current[id]
                ? ('removed' as const)
                : !previous[id]
                  ? ('added' as const)
                  : ('updated' as const),
            },
          ],
    );
}
export function currentStoryRecords(records: StoryRecord[]) {
  return records.filter(
    (r) => r.content && r.content.state !== 'entered_in_error',
  );
}
export function dateOverlaps(
  value: string | null,
  from: string | null,
  to: string | null,
  endValue?: string | null,
) {
  if (!from && !to) return true;
  if (!value) return false;
  // A year/month is an interval; never discard it by assigning a fake exact day.
  const start = storyDateBounds(value)[0],
    end = storyDateBounds(endValue ?? value)[1];
  return (!from || end >= from) && (!to || start <= to);
}
