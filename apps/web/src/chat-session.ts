// Store only an opaque conversation pointer, never medical text, drafts or auth tokens.
const fallback = new Map<string, string>();
const prefix = 'biovitai:active-chat:';
export function sessionConversation(
  scope: string,
  profileId: string,
  next?: string,
) {
  const key = `${prefix}${scope}:${profileId}`;
  let id = next;
  try {
    id ??= window.sessionStorage.getItem(key) ?? undefined;
  } catch {
    /* Storage can be disabled. */
  }
  id ??= fallback.get(key);
  if (!id || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))
    id = crypto.randomUUID();
  fallback.set(key, id);
  try {
    window.sessionStorage.setItem(key, id);
  } catch {
    /* Keep the in-memory session usable. */
  }
  return id;
}
export function clearConversationSession(scope: string) {
  const start = `${prefix}${scope}:`;
  for (const key of fallback.keys())
    if (key.startsWith(start)) fallback.delete(key);
  try {
    for (const key of Object.keys(window.sessionStorage))
      if (key.startsWith(start)) window.sessionStorage.removeItem(key);
  } catch {
    /* No persisted pointer when storage is disabled. */
  }
}
