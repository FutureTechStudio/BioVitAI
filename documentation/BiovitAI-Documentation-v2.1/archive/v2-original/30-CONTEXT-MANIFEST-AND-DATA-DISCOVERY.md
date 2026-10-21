# Health Context Manifest and Data Discovery

## Purpose
Give the AI a compact, up-to-date inventory of available authorized information so it knows which tools are useful without loading full records.

## Manifest schema

    {
      "profile_id": "p_123",
      "display_name": "Alex",
      "relationship": "self",
      "timezone": "Asia/Kolkata",
      "authorization": {
        "read_reports": true,
        "read_observations": true,
        "read_device_data": true,
        "read_plans": false
      },
      "reports": {
        "verified_count": 8,
        "pending_count": 1,
        "latest_observed_at": "2026-10-14",
        "categories": ["blood", "thyroid"]
      },
      "domains": {
        "glucose": {"count": 7, "first": "2025-01-12", "last": "2026-10-14"},
        "lipids": {"count": 4, "first": "2025-03-05", "last": "2026-10-14"}
      },
      "devices": {
        "blood_pressure": {"connected": true, "last_sync": "2026-10-19"}
      },
      "conditions": ["blood_pressure_tracking"],
      "data_version": 104,
      "generated_at": "2026-10-20T08:00:00Z"
    }

This is synthetic example data.

## Generation
Compute from database metadata and permission filters. Do not use a free-form LLM to generate the manifest. Maintain a bounded response and omit sensitive details not needed for routing.

## Refresh
Invalidate on report verification/retraction, observation correction, device sync, condition change, plan update, grant change and profile switch.

## Caching
Cache key must include tenant/profile, actor/grant scope, manifest schema version and data version. Apply short TTL and explicit invalidation. A revoked grant must bypass stale cached manifests.

## Temporal semantics
- "Last month" = previous calendar month in profile's timezone.
- "Past month" = rolling one-month window only if specified.
- "Latest report" = latest verified report by clinical observation date.
- "Previous report" = prior clinically relevant comparable report; explain choice.
- Ambiguous "my" = selected profile only, unless UI asks to switch.

## Empty context
Tell user what is available, what is absent and what they can upload/connect. Never imply missing data proves health.
