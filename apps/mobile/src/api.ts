import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import type { ActiveProfileRef } from '../../../shared/contracts/src/profile-context';
// adb reverse tcp:3001 tcp:3001 keeps the backend bound to host loopback.
export const API_ORIGIN = 'http://127.0.0.1:3001';
export class NativeRequestError extends Error {
  constructor(
    public status: number,
    code: string,
  ) {
    super(code);
  }
}
export const auth = createAuthClient({
  baseURL: API_ORIGIN,
  fetchOptions: { headers: { origin: API_ORIGIN } },
  plugins: [
    expoClient({
      scheme: 'biovitai',
      storagePrefix: 'biovitai',
      cookiePrefix: 'biovitai',
      storage: SecureStore,
    }),
  ],
});
export async function nativeApi(
  path: string,
  body?: unknown,
  context?: ActiveProfileRef,
  signal?: AbortSignal,
) {
  if (!/^\/(?:v1|api\/auth)\/[a-zA-Z0-9/_-]+$/.test(path))
    throw new Error('Invalid API route');
  const cookie = await auth.getCookie();
  const response = await fetch(API_ORIGIN + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: API_ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(context
        ? {
            'x-profile-id': context.profileId,
            'x-context-revision': String(context.revision),
          }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new NativeRequestError(
      response.status,
      data?.error?.code ?? data?.code ?? 'Request failed',
    );
  return data;
}
export async function uploadReport(
  uri: string,
  name: string,
  key: string,
  context: ActiveProfileRef,
  signal: AbortSignal,
) {
  const file = new File(uri);
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error('Choose a report up to 20 MiB.');
  // Expo fetch replaces Content-Type for Blob/File bodies with file.type.
  // Send the bounded binary buffer so the upload transport stays octet-stream.
  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024)
    throw new Error('Choose a report up to 20 MiB.');
  const cookie = await auth.getCookie();
  const response = await fetch(API_ORIGIN + '/v1/health/reports/upload', {
    method: 'POST',
    headers: {
      origin: API_ORIGIN,
      cookie: cookie ?? '',
      'content-type': 'application/octet-stream',
      'x-profile-id': context.profileId,
      'x-context-revision': String(context.revision),
      'idempotency-key': key,
      'x-file-name': encodeURIComponent(name),
    },
    body: bytes,
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code ?? 'Upload failed');
  return data;
}
export async function previewPage(
  reportId: string,
  page: number,
  context: ActiveProfileRef,
  signal: AbortSignal,
) {
  const cookie = await auth.getCookie();
  const url =
    API_ORIGIN +
    `/v1/health/reports/${reportId}/pages/${page}?profileId=${context.profileId}&revision=${context.revision}`;
  const response = await fetch(url, {
    headers: { cookie: cookie ?? '' },
    signal,
  });
  if (!response.ok) throw new Error('Source page unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let raw = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    raw += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return 'data:image/png;base64,' + btoa(raw);
}
