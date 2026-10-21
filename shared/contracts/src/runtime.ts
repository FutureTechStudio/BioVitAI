export interface DatabaseProbe {
  check(): Promise<void>;
  close(): Promise<void>;
}

export interface StatusResponse {
  status: 'ok' | 'unavailable';
  service: 'biovitai-api';
}

export interface StatusService {
  live(): StatusResponse;
  ready(): Promise<StatusResponse>;
}
