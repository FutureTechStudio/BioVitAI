import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
const context = new AsyncLocalStorage<string>();
export function withTrace<T>(work: () => T) {
  return context.run(randomUUID(), work);
}
export function traceId() {
  return context.getStore() ?? randomUUID();
}
export function telemetry(
  event:
    | 'api.complete'
    | 'storage.write'
    | 'storage.read'
    | 'report.claim'
    | 'report.event'
    | 'gateway.reserved'
    | 'gateway.complete',
  input: { status?: number; parentTraceId?: string; count?: number } = {},
) {
  console.log(
    JSON.stringify({
      event,
      traceId: traceId(),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.count !== undefined ? { count: input.count } : {}),
      ...(input.parentTraceId && /^[a-f0-9-]{36}$/.test(input.parentTraceId)
        ? { parentTraceId: input.parentTraceId }
        : {}),
    }),
  );
}
