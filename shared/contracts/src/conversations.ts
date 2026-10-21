import { z } from 'zod';
import { ActiveProfileRefSchema } from './profile-context.js';
export const CitationSchema = z
  .object({ observationId: z.uuid(), revision: z.number().int().positive() })
  .strict();
export const ExplanationSchema = z
  .object({
    cards: z
      .array(
        z
          .object({
            kind: z.enum(['summary', 'limitation']),
            text: z.string().min(1).max(2000),
            citations: z.array(CitationSchema).min(1).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();
export type Explanation = z.infer<typeof ExplanationSchema>;
export const MessageInputSchema = z
  .object({
    context: ActiveProfileRefSchema,
    requestKey: z.uuid(),
    conversationId: z.uuid(),
    question: z.string().trim().min(1).max(2000),
  })
  .strict();
export type HealthModelInput = {
  question: string;
  evidence: {
    id: string;
    reportId: string;
    revision: number;
    name: string;
    value: string;
    unit: string | null;
    date: string | null;
  }[];
  analysis?: {
    version: string;
    omittedObservations: number;
    cohorts: { observationIds: string[] }[];
    exclusions: { observationId: string; reason: string }[];
    organs: { name: string; state: string }[];
  };
};
export interface HealthExplanationGateway {
  generate(
    input: HealthModelInput,
    dispatch?: { beforeDispatch: () => Promise<boolean> },
  ): Promise<
    | { status: 'ok'; answer: Explanation }
    | { status: 'unavailable'; code: string }
  >;
}
export interface ConversationStore {
  claim(profileId: string, key: string, fingerprint: string): Promise<boolean>;
  list(profileId: string): Promise<{ id: string; createdAt: string }[]>;
  messages(
    profileId: string,
    id: string,
  ): Promise<
    {
      question: string;
      answer: Explanation | null;
      code: string | null;
      evidenceRevision: string;
    }[]
  >;
  prior(
    profileId: string,
    key: string,
  ): Promise<{
    conversationId: string;
    question: string;
    answer: Explanation | null;
    code: string | null;
    evidenceRevision: string;
  } | null>;
  save(input: {
    profileId: string;
    actorId: string;
    conversationId: string;
    requestKey: string;
    question: string;
    answer: Explanation | null;
    code: string | null;
    evidenceRevision: string;
  }): Promise<void>;
  digest(value: unknown): string;
}
export function validateHealthExplanation(
  raw: unknown,
  input: HealthModelInput,
): Explanation {
  const result = ExplanationSchema.parse(raw),
    allowed = new Map(input.evidence.map((e) => [e.id, e.revision]));
  for (const card of result.cards) {
    if (
      /<\s*[A-Za-z/!?]|https?:|www\.|\b[\w.+-]+@[\w.-]+\./i.test(card.text) ||
      [...card.text].some(
        (c) => c.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(c),
      )
    )
      throw new Error('INVALID_OUTPUT');
    for (const citation of card.citations)
      if (allowed.get(citation.observationId) !== citation.revision)
        throw new Error('INVALID_CITATION');
  }
  return result;
}
