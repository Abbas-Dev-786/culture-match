## Major blockers

1. Database migrations are inconsistent.

The application uses the schema in lib/db/migrations/0001_foundation.sql (/C:/Users/abbas/Desktop/culture-match/lib/db/migrations/0001_foundation.sql:42), but the actual Supabase migration folder contains an older incompatible schema using fields such as current_stage, target_demographics, handle, and audience_size in supabase/migrations/20261023053521_foundation.sql (/C:/Users/abbas/Desktop/culture-match/supabase/migrations/20261023053521_foundation.sql:42).

The README also instructs users to apply the nonstandard lib/db/migrations path README.md (/C:/Users/abbas/Desktop/culture-match/README.md:28). A clean Supabase deployment can therefore fail or run against the wrong schema.

2. The workflow is not safely production-oriented.

The analyze route executes Qloo, optional AI generation, and two Apify runs directly inside one request app/api/campaigns/[id]/analyze/route.ts (/C:/Users/abbas/Desktop/culture-match/app/api/campaigns/[id]/analyze/route.ts:31). On serverless hosting, that can exceed the function timeout and leave runs stuck in a running state.

It needs a durable queue/worker or a clearly split asynchronous workflow.

3. The authentication session middleware is not wired.

There is an updateSession helper in lib/middleware.ts (/C:/Users/abbas/Desktop/culture-match/lib/middleware.ts:4), but no root middleware.ts or proxy.ts. The API still checks authentication, but session refresh and redirect behavior may become unreliable after token expiry.

4. The “cultural matching” score is currently weak.

Cultural alignment is calculated using lexical overlap between Qloo signal names and the creator’s bio lib/matching/score-creators.ts (/C:/Users/abbas/Desktop/culture-match/lib/matching/score-creators.ts:90). Audience geography, language, fees, and actual cultural audience affinity are unavailable.

That makes this primarily a keyword-based creator-ranking tool, not yet a reliable cultural-intelligence product.