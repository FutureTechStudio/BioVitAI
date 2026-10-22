import { StoryContentSchema, storyDate } from '../../contracts/src/journey.js';
import type { StoryContent } from '../../contracts/src/journey.js';

export const storyKinds = {
  condition: 'Conditions & concerns',
  medication: 'Medicines',
  care_guidance: 'Care guidance',
  allergy: 'Allergies',
} as const;
export const storyStates = {
  current: 'Current record',
  historical: 'Historical',
  uncertain: 'Uncertain',
  disputed: 'Disputed',
  entered_in_error: 'Entered in error',
} as const;
export type StoryKind = keyof typeof storyKinds;
export type StoryDraft = {
  kind: StoryKind;
  label: string;
  details: string;
  assertion: 'reported_condition' | 'concern';
  strength: string;
  dose: string;
  route: string;
  schedule: string;
  clinician: string;
  followUp: string;
  reaction: string;
  start: string;
  end: string;
  state: keyof typeof storyStates;
  sourceKind: 'reported' | 'document';
  reportId: string;
  pageNumber: string;
  excerpt: string;
  conflictsWith: string[];
};
export const extraStoryFields: Record<
  StoryKind,
  {
    key:
      | 'strength'
      | 'dose'
      | 'route'
      | 'schedule'
      | 'clinician'
      | 'followUp'
      | 'reaction';
    label: string;
  }[]
> = {
  condition: [],
  medication: [
    { key: 'strength', label: 'Strength as reported' },
    { key: 'dose', label: 'Dose as reported' },
    { key: 'route', label: 'Route as reported' },
    { key: 'schedule', label: 'Schedule as reported' },
  ],
  care_guidance: [
    { key: 'clinician', label: 'Clinician name as recorded' },
    { key: 'followUp', label: 'Follow-up date as recorded' },
  ],
  allergy: [{ key: 'reaction', label: 'Reaction as reported' }],
};
export function newStoryDraft(content?: StoryContent): StoryDraft {
  const info = content?.information,
    source = content?.source;
  return {
    kind: info?.kind ?? 'condition',
    label: info?.label ?? '',
    details: info?.details ?? '',
    assertion: info?.kind === 'condition' ? info.assertion : 'concern',
    strength: info?.kind === 'medication' ? (info.strength ?? '') : '',
    dose: info?.kind === 'medication' ? (info.dose ?? '') : '',
    route: info?.kind === 'medication' ? (info.route ?? '') : '',
    schedule: info?.kind === 'medication' ? (info.schedule ?? '') : '',
    clinician: info?.kind === 'care_guidance' ? (info.clinician ?? '') : '',
    followUp: info?.kind === 'care_guidance' ? (info.followUp.value ?? '') : '',
    reaction: info?.kind === 'allergy' ? (info.reaction ?? '') : '',
    start: content?.start.value ?? '',
    end: content?.end.value ?? '',
    state: content?.state ?? 'uncertain',
    sourceKind: source?.kind ?? 'reported',
    reportId: source?.kind === 'document' ? source.reportId : '',
    pageNumber: source?.kind === 'document' ? String(source.pageNumber) : '1',
    excerpt: source?.kind === 'document' ? source.excerpt : '',
    conflictsWith: content?.conflictsWith ?? [],
  };
}
export function storyContent(d: StoryDraft): StoryContent {
  const optional = (s: string) => s.trim() || null;
  const base = { label: d.label, details: d.details };
  const information =
    d.kind === 'condition'
      ? { ...base, kind: d.kind, assertion: d.assertion }
      : d.kind === 'medication'
        ? {
            ...base,
            kind: d.kind,
            strength: optional(d.strength),
            dose: optional(d.dose),
            route: optional(d.route),
            schedule: optional(d.schedule),
          }
        : d.kind === 'care_guidance'
          ? {
              ...base,
              kind: d.kind,
              clinician: optional(d.clinician),
              followUp: storyDate(d.followUp),
            }
          : { ...base, kind: d.kind, reaction: optional(d.reaction) };
  return StoryContentSchema.parse({
    information,
    start: storyDate(d.start),
    end: storyDate(d.end),
    state: d.state,
    source:
      d.sourceKind === 'reported'
        ? { kind: 'reported' }
        : {
            kind: 'document',
            reportId: d.reportId,
            pageNumber: Number(d.pageNumber),
            excerpt: d.excerpt,
          },
    conflictsWith: d.conflictsWith,
  });
}
