# Managed family profiles and active app context

Owner clarification, 20 October 2026: create family profiles without email, optionally add/link email later, and switch all private app details to the selected person. This extends BV-009 before canonical health schema work.

## User behavior

The profile picker chooses the record subject while the signed-in account remains the authenticated manager. Reports/uploads, measurements, trends, wellness plans, assistant conversations, notifications and future exports must bind to the selected profile. The selected name must stay visible. Account settings remain associated with the login; the read-only public Community feed has no private health context. Selecting a family profile is not impersonating that member's login and cannot enlarge existing access scopes.

Switching clears old profile data immediately, cancels in-flight requests, resets report/chat selection and starts a separate profile-specific conversation context. Do not merge another profile's assistant history into a new context. Cached data must be keyed by account/session and profile, and each retrieval must recheck authorization. Failed selection or lost access leaves an empty view requiring selection; never fall back silently to another person's details.

The [web shell](WEB-SHELL.md) now integrates the visible picker, family management and assistant reset with the API/policy and framework-independent client guard. Clinical screens remain empty until their services are connected.

## Backend contract

Profiles support `kind:self` (one per account) and `kind:family` (multiple per manager). Family creation needs a display name, with contact email optional. Adding an email is contact metadata only. Existing single-use invitations can later give the intended verified account explicit access to that same profile. Acceptance preserves its UUID/history; it does not assert subject identity, transfer management or merge profiles by email. Minor/guardian policy remains a separate unresolved work item.

Selection is persisted per database session, not globally across devices. Internal actor resolution carries the session row ID; clients never supply it. The context table references the session with delete cascade, so logout/session deletion removes saved selection. Resolving the context also checks session ownership and expiry. Session IDs are excluded from `/v1/me` JSON.

`GET /v1/profile-context` returns `{profile:null,revision:0}` initially, or an authorized profile and revision. `POST /v1/profile-context` takes `{profileId,expectedRevision}` and returns the selected profile with the revision incremented. It requires exact Origin/JSON, verified session and current profile/read/care access. Conflicting or delayed switches return `409 PROFILE_CONTEXT_CHANGED`. Refresh the server context before another explicit attempt. Requests cannot set account, session, role or grants.

`ProfilePolicy.withActiveAccess(actor,{profileId,revision},scope,work,consent?)` is the boundary for future user-facing profile data operations. It locks the session/context, checks both reference fields, then rechecks profile permissions and required consent within the same transaction as the protected callback and audit. Changing selection cannot redirect an in-flight operation to a different subject. Delayed requests are rejected even if the user switched away and back to the same profile. A selection does not grant health/write/wellness/AI access by itself. Background jobs with explicit subjects continue to use the profile-bound `withAccess` policy and must not borrow the current UI selection.

If a selected grant is revoked or expired, the next context resolution returns no profile and increments its revision while clearing the pointer. New grants cannot automatically resurrect that selection. Access operations already deny the revoked grant, including before a context refresh. No fallback to the manager's self profile occurs. An earlier operation may finish before the revocation/switch commits; its response must still pass the client guard before rendering.

## Client boundary

`shared/profile-context/src/index.ts` supplies `createProfileView(onReset)` without a framework dependency. Every new selection/resync begins with `beginSelection()`, which clears the active reference, aborts all previous requests and synchronously invokes the app's reset callback. Pass its attempt number to `applySelection` only after a successful server response, or pass null when selection is required. Responses from earlier attempts cannot replace the newest selection.

Each data request captures `view.request()` and passes its profile ID/revision to the future endpoint. Use its AbortSignal for cancellation and `view.publish(request,commit)` for a synchronous state update when the response arrives. Aborted, stale, unknown or previous-profile request tickets cannot publish data. This rendering guard complements server authorization. The web shell owns this guard and clears private forms and the assistant on selection/resync; the browser acceptance test exercises it across two family profiles. Future clinical screens and mobile must use the same boundary.

## Validation

Real PostgreSQL/HTTP tests cover upgrade preservation, email-less family creation, private contact updates, later invitation access to the same ID, session/device isolation, actor identity preservation, stale and concurrent switches, protected-operation ordering, category/action/AI denials, revocation without fallback and logout cleanup. Four client tests cover clearing/cancellation, delayed selection responses, returning to a previously selected profile and lost access.
