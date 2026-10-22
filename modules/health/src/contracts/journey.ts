import type { z } from 'zod';
import type {
  JourneyEvent,
  StoryRecord,
  SaveStory,
  ReviewJourneySchema,
} from '../../../../shared/contracts/src/journey.js';
export class JourneyError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
export type StoryManifest = Record<string, string>;
export interface JourneyData {
  records: StoryRecord[];
  events: JourneyEvent[];
  reports: {
    id: string;
    fileName: string;
    state: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
  }[];
}
export interface JourneyRepository {
  read(profile: string, actor: string, owner: boolean): Promise<JourneyData>;
  save(
    actor: string,
    reporter: 'self' | 'caregiver',
    input: SaveStory,
  ): Promise<{ recordId: string; revision: number }>;
  history(
    profile: string,
    actor: string,
    recordId: string,
  ): Promise<StoryRecord[]>;
  checkpoint(
    profile: string,
    actor: string,
  ): Promise<{ reviewedAt: string; manifest: StoryManifest } | null>;
  review(
    actor: string,
    input: z.infer<typeof ReviewJourneySchema>,
    manifest: StoryManifest,
  ): Promise<void>;
  hash(value: unknown): string;
  ready(): Promise<void>;
}
