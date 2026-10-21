// Reviewed browser transport: relative, same-origin requests only; no bearer tokens.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function api(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!/^\/(?:v1\/|api\/auth\/)[A-Za-z0-9/_-]+$/.test(path))
    throw new Error('INVALID_API_PATH');
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.error?.code ?? data?.code ?? 'REQUEST_FAILED',
    );
  return data;
}
export function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Please sign in again.';
    if (error.code === 'EMAIL_NOT_VERIFIED')
      return 'Verify your email before signing in.';
    if (error.code === 'SELF_PROFILE_EXISTS')
      return 'Your own profile already exists. Choose Family member to add someone else.';
    if (error.code === 'PROFILE_CONTEXT_CHANGED')
      return 'The selected profile changed. Refresh the profile selection and try again.';
    if (error.status === 429)
      return 'Too many attempts. Please wait a minute and try again.';
    if (error.status === 403 || error.status === 404)
      return 'This action is unavailable or your access has changed.';
    if (error.status >= 500)
      return 'The service is unavailable. Please try again.';
    return 'Please check your details and try again.';
  }
  return 'Could not reach the service. Check that the local API is running, then try again.';
}

// Report binary/query transport stays inside this reviewed adapter.
export async function reportRequest(
  path: string,
  context: { profileId: string; revision: number },
  options: {
    body?: unknown;
    file?: File;
    signal?: AbortSignal;
    binary?: boolean;
    requestKey?: string;
  } = {},
) {
  if (!/^\/v1\/health\/[A-Za-z0-9/_-]+$/.test(path))
    throw new Error('INVALID_API_PATH');
  const headers: Record<string, string> = {
    'x-profile-id': context.profileId,
    'x-context-revision': String(context.revision),
  };
  if (options.file) {
    headers['content-type'] = 'application/octet-stream';
    headers['idempotency-key'] = options.requestKey ?? crypto.randomUUID();
    headers['x-file-name'] = encodeURIComponent(options.file.name);
  } else if (options.body !== undefined)
    headers['content-type'] = 'application/json';
  const response = await fetch(path, {
    method: options.file || options.body !== undefined ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.file
      ? { body: options.file }
      : options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
  });
  if (!response.ok) {
    const failure = await response.json();
    throw new ApiError(
      response.status,
      failure?.error?.code ?? 'REQUEST_FAILED',
    );
  }
  return options.binary ? response.blob() : response.json();
}
