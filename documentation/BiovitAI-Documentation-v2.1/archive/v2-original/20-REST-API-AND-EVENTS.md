# REST APIs and Domain Events

## Core endpoints
POST /v1/reports/uploads
GET /v1/reports
GET /v1/reports/{id}
POST /v1/reports/{id}/verify
GET /v1/profiles/{id}/observations
GET /v1/profiles/{id}/trends
GET /v1/profiles/{id}/organ-evidence
GET /v1/profiles/{id}/conditions
POST /v1/profile-invitations
POST /v1/profile-invitations/{id}/accept
DELETE /v1/profile-grants/{id}

## AI endpoints
POST /v1/chat/sessions
POST /v1/chat/sessions/{id}/messages
GET /v1/chat/sessions/{id}
GET /v1/profiles/{id}/health-context
GET /v1/reports/compare

## Common requirements
Authenticated actor, validated request, scoped authorization, pagination, idempotency for writes, correlation ID, consistent errors and versioned contracts.

## Event types
report.uploaded; report.verified; report.analysis_ready; profile.grant_created; profile.grant_revoked; device.synced; health_context.invalidated; ai.tool_executed.

## Further detail
See 41-API-CONTRACTS-AND-EXAMPLE-PAYLOADS.md.
