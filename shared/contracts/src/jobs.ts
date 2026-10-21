export interface PrivateObjectJob {
  id: string;
  profileId: string;
  actorId: string;
  objectId: string;
  leaseToken: string;
  attempts: number;
  maxAttempts: number;
}
export type JobFailure =
  | 'ACCESS_REVOKED'
  | 'OBJECT_UNAVAILABLE'
  | 'INTEGRITY_FAILURE'
  | 'RETRYABLE_FAILURE';
export interface DurableJobs {
  dispatch(limit?: number): Promise<number>;
  claim(): Promise<PrivateObjectJob | null>;
  complete(job: PrivateObjectJob, sha256: string): Promise<boolean>;
  fail(
    job: PrivateObjectJob,
    code: JobFailure,
    terminal?: boolean,
  ): Promise<boolean>;
  ready(): Promise<void>;
}
