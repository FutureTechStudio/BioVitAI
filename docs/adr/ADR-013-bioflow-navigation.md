# ADR-013: BioFlow navigation and presentation

Status: Owner-authorized implementation decision, 21 October 2026.

The owner explicitly selected expanded web navigation and web plus Android coverage in the BioFlow planning conversation, then requested implementation after a GitHub checkpoint. This supersedes the older three-entry **web** navigation decision while preserving module ownership and URLs.

Web adds Dashboard, Insights and Labs & Reports; My Health, My Wellness and Community & Trends remain. Root and successful web sign-in open Dashboard. Android retains three bottom tabs with focused health stack screens. Health workflows formerly combined on `/health` remain accessible there and through `/reports` and `/insights`; report query links continue to work.

The screenshot is authoritative for visual language, not illustrative medical content. Existing APIs and clinical rules are unchanged. Unavailable wellness metrics, recommendations, notifications and organ assessments remain explicit. P6/P7 services and human/clinical approvals are not introduced by this presentation decision.
