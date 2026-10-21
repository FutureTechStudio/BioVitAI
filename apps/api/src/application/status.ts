import type {
  DatabaseProbe,
  StatusService,
} from '../../../../shared/contracts/src/runtime.js';

export function createStatusService(
  database: DatabaseProbe,
  timeoutMs = 2500,
): StatusService {
  return {
    live: () => ({ status: 'ok', service: 'biovitai-api' }),
    async ready() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          database.check(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Probe deadline')),
              timeoutMs,
            );
          }),
        ]);
        return { status: 'ok', service: 'biovitai-api' };
      } catch {
        return { status: 'unavailable', service: 'biovitai-api' };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
