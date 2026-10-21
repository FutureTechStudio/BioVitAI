import { ActiveProfileRefSchema } from '../../contracts/src/profile-context.js';
import type { ActiveProfileRef } from '../../contracts/src/profile-context.js';

export interface ProfileViewRequest {
  readonly context: Readonly<ActiveProfileRef>;
  readonly signal: AbortSignal;
}

// Framework-independent view boundary for the future web/mobile profile picker.
// onReset clears report selection, chat context and all profile-specific view/cache state.
// The server remains authoritative; this only prevents stale client rendering.
export function createProfileView(onReset: () => void) {
  let generation = 0;
  let active: Readonly<ActiveProfileRef> | null = null;
  let cancellation = new AbortController();
  const requests = new WeakMap<ProfileViewRequest, number>();
  function beginSelection() {
    generation++;
    cancellation.abort();
    cancellation = new AbortController();
    active = null;
    onReset();
    return generation;
  }
  return {
    beginSelection,
    applySelection(attempt: number, selected: ActiveProfileRef | null) {
      if (attempt !== generation) return false;
      active = selected
        ? Object.freeze(ActiveProfileRefSchema.parse(selected))
        : null;
      return true;
    },
    request(): ProfileViewRequest {
      if (!active) throw new Error('PROFILE_SELECTION_REQUIRED');
      const request = Object.freeze({
        context: active,
        signal: cancellation.signal,
      });
      requests.set(request, generation);
      return request;
    },
    publish(request: ProfileViewRequest, commit: () => void) {
      if (
        !active ||
        request.signal.aborted ||
        requests.get(request) !== generation ||
        request.context !== active
      )
        return false;
      commit();
      return true;
    },
    clear() {
      beginSelection();
    },
  };
}
