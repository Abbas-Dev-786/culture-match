## Known issues and current limitations

This file is a living audit of issues found during implementation. Items below distinguish resolved workflow risks from limitations that still need live-provider or deployment validation.

1. Database migrations need one canonical deployment path.

The application uses the schema in `lib/db/migrations/0001_foundation.sql`, while the Supabase migration folder may contain an older incompatible schema. The README now points to the canonical deployment path, but a clean Supabase deployment should still verify migration history, schema compatibility, RLS, and policies before production use.

2. The workflow needs production deployment validation.

The earlier implementation executed Qloo, optional AI generation, and two Apify runs directly inside one request. The current workflow advances persisted stages, starts one broad Apify run, and can launch at most one bounded refinement run through the agentic path. Deployment still needs validation for function limits, callback/polling recovery, and long-running provider behavior.

The current persisted workflow is the split asynchronous path; a durable queue/worker may still be required for production scale.

3. Authentication session refresh needs deployment verification.

The API checks authentication and the repository contains an `updateSession` helper, but session refresh and redirect behavior still need verification in the deployed Next.js runtime.

4. Cultural matching remains evidence-limited.

Cultural alignment now uses Qloo enrichment and observed creator-content evidence where available, with an explicit Qloo ablation. Audience geography, language, fees, and actual cultural audience affinity may still be unavailable depending on the Apify payload.

The product must continue to label unavailable evidence and avoid claiming cultural identity, audience geography, or ROI from inference.
