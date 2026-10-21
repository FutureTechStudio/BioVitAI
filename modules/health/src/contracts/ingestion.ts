import type { Ingestion } from '../../../../shared/contracts/src/reports.js';
import type { StoredObject } from './private-objects.js';
export class ReportError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}
export interface UploadInput extends StoredObject {
  mediaType: string;
  fileName: string;
}
export interface ReportLease {
  id: string;
  profileId: string;
  actorId: string;
  token: string;
}
export interface ExtractedLine {
  text: string;
  box: { x0: number; y0: number; x1: number; y1: number };
  confidence: number | null;
}
export interface ExtractedPage {
  png: Uint8Array;
  width: number;
  height: number;
  lines: ExtractedLine[];
}
export interface ReportProcessor {
  scan(bytes: Uint8Array): Promise<'clean' | 'infected'>;
  extract(bytes: Uint8Array, mediaType: string): Promise<ExtractedPage[]>;
}
export interface ReportRecord extends UploadInput {
  ingestion: Ingestion;
}
export interface ReportRepository {
  transaction<T>(profileId: string, work: () => Promise<T>): Promise<T>;
  register(input: UploadInput): Promise<Ingestion>;
  find(profileId: string, id: string): Promise<ReportRecord | null>;
  byRequest(
    profileId: string,
    actorId: string,
    key: string,
  ): Promise<ReportRecord | null>;
  byDigest(profileId: string, sha256: string): Promise<ReportRecord | null>;
  list(profileId: string): Promise<Ingestion[]>;
  act(
    profileId: string,
    id: string,
    revision: number,
    action: 'retry' | 'cancel',
    actorId: string,
  ): Promise<Ingestion>;
  claim(): Promise<ReportLease | null>;
  advance(lease: ReportLease): Promise<boolean>;
  finish(lease: ReportLease, work: () => Promise<void>): Promise<boolean>;
  failed(lease: ReportLease, code: string, scanState?: string): Promise<void>;
  recordExtraction(
    record: ReportRecord,
    pages: { page: ExtractedPage; id: string; hash: string }[],
    actorId: string,
  ): Promise<void>;
  detail(profileId: string, id: string): Promise<unknown>;
  preview(
    profileId: string,
    ingestionId: string,
    page: number,
  ): Promise<StoredObject | null>;
  reviewIdentity(
    profileId: string,
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<Ingestion>;
  verify(
    profileId: string,
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<unknown>;
  observations(profileId: string): Promise<unknown[]>;
  relate(
    profileId: string,
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<unknown>;
  manualCandidate(
    profileId: string,
    id: string,
    actorId: string,
    data: unknown,
  ): Promise<unknown>;
  ready(): Promise<void>;
}
