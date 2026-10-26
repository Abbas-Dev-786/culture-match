import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import process from "node:process"
import { phase0LaunchBriefs } from "./markets.ts"
import { sanitizeErrorMessage, sanitizeForFixture } from "./redaction.ts"
import { analyzeLaunchCulture } from "../tools/qloo/analyze-launch.ts"
import { createQlooClient } from "../tools/qloo/client.ts"
import { discoverOpportunities } from "../tools/qloo/discover-opportunities.ts"
import { withProviderRetry } from "../workflow/retry.ts"

type JsonObject = Record<string, unknown>

const rootDirectory = join(process.cwd(), "lib", "phase-0")
const fixtureDirectory = join(rootDirectory, "fixtures")
const qlooFixtureDirectory = join(fixtureDirectory, "qloo")

async function main(): Promise<void> {
  await mkdir(qlooFixtureDirectory, { recursive: true })

  const summary: JsonObject = {
    generatedAt: new Date().toISOString(),
    scenario: phase0LaunchBriefs,
    configuration: {
      qlooBaseUrlConfigured: Boolean(process.env.QLOO_BASE_URL?.trim()),
      qlooApiKeyConfigured: Boolean(process.env.QLOO_API_KEY?.trim()),
      qlooSearchUrlConfigured: Boolean(process.env.QLOO_SEARCH_URL?.trim()),
      qlooInsightsUrlConfigured: Boolean(process.env.QLOO_INSIGHTS_URL?.trim()),
      qlooTagsUrlConfigured: Boolean(process.env.QLOO_TAGS_URL?.trim()),
      qlooCompareUrlConfigured: Boolean(process.env.QLOO_COMPARE_URL?.trim()),
      opportunityTake: readPositiveInteger(process.env.QLOO_OPPORTUNITY_TAKE, 10),
    },
    qloo: await runQlooSpike(),
  }

  await writeJson(join(fixtureDirectory, "phase-0-run-summary.json"), summary)
  await writeFieldMatrix(summary)

  const qlooResult = summary.qloo
  if (isRecord(qlooResult) && qlooResult.status !== "completed") {
    process.exitCode = 2
  }
}

async function runQlooSpike(): Promise<JsonObject> {
  const missing = [
    !process.env.QLOO_BASE_URL?.trim() && "QLOO_BASE_URL",
    !process.env.QLOO_API_KEY?.trim() && "QLOO_API_KEY",
    !process.env.QLOO_SEARCH_URL?.trim() && "QLOO_SEARCH_URL",
    !process.env.QLOO_INSIGHTS_URL?.trim() && "QLOO_INSIGHTS_URL",
  ].filter((value): value is string => Boolean(value))

  if (missing.length > 0) {
    return {
      status: "blocked_missing_configuration",
      missing,
      note: "Configure the server-side Qloo credentials and verified endpoint URLs before running the live feasibility gate.",
    }
  }

  try {
    const client = createQlooClient()
    const briefs: JsonObject[] = []
    for (const brief of phase0LaunchBriefs) {
      const slug = slugify(`${brief.brandName}-${brief.city}`)
      try {
        const scenario = await withProviderRetry("qloo", async () => {
          const observedAt = new Date().toISOString()
          const culture = await analyzeLaunchCulture(brief, client, observedAt)
          const opportunities = await discoverOpportunities(
            brief,
            culture.fingerprint,
            client,
            observedAt
          )
          return { culture, opportunities }
        })
        const culture = scenario.culture
        const opportunities = scenario.opportunities
        const result = {
          brief,
          status: "completed",
          location: culture.location,
          resolvedReferences: culture.resolvedReferences,
          resolvedTags: culture.resolvedTags,
          fingerprint: culture.fingerprint,
          opportunities: opportunities.opportunities,
          providerSummary: {
            culture: culture.providerSummary,
            opportunities: opportunities.providerSummary,
          },
        }
        await writeJson(
          join(qlooFixtureDirectory, `launch-${slug}.json`),
          sanitizeForFixture(result)
        )
        briefs.push({
          brandName: brief.brandName,
          city: brief.city,
          status: "completed",
          signalCount: culture.signals.length,
          opportunityCount: opportunities.opportunities.length,
          fixture: `qloo/launch-${slug}.json`,
        })
      } catch (error) {
        briefs.push({
          brandName: brief.brandName,
          city: brief.city,
          status: "failed",
          error: safeError(error),
        })
      }
    }
    const failedCount = briefs.filter((brief) => brief.status === "failed").length
    return {
      status: failedCount === 0 ? "completed" : "failed",
      briefCount: briefs.length,
      failedCount,
      briefs,
      notes: [
        "Review whether each resolved reference is semantically relevant to the launch brief.",
        "Review opportunity types, affinity, popularity, and evidence paths before enabling customer-facing ranking.",
      ],
    }
  } catch (error) {
    return {
      status: "failed",
      error: safeError(error),
    }
  }
}

async function writeFieldMatrix(summary: JsonObject): Promise<void> {
  const qloo = isRecord(summary.qloo) ? summary.qloo : {}
  const content = `# Phase 0 provider field matrix

Generated: ${String(summary.generatedAt)}

This matrix records the fields used by the narrowed launch-intelligence spike. A field remains provisional until a live response is manually reviewed.

## Qloo

Status: ${String(qloo.status ?? "unknown")}

| Application field | Provider path | Classification |
| --- | --- | --- |
| resolved reference id | entity search result entity_id/id | provider-reported |
| cultural signal id | insights results tags[].tag_id or entities[].entity_id | provider-reported |
| cultural affinity | insights result query.affinity | provider-reported; semantics require review |
| opportunity id | recommendation result entity_id/id | provider-reported |
| opportunity name | recommendation result name/title | provider-reported |
| opportunity type | recommendation result types[] | provider-reported |
| evidence | normalized result field path and observed timestamp | derived traceability |
| launch fit | no provider field | unavailable in Phase 0 |

## Acceptance notes

- Qloo is the only external provider in the narrowed MVP.
- Raw payloads are retained only when PROVIDER_RETAIN_RAW=true and must remain access-controlled.
- No language, audience geography, budget fit, or launch success is inferred from Qloo results.
`
  await writeFile(join(rootDirectory, "provider-field-matrix.md"), content, "utf8")
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function safeError(error: unknown): string {
  if (error instanceof Error) return sanitizeErrorMessage(error.message)
  return "The Qloo spike failed with an unknown error"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

void main().catch((error: unknown) => {
  process.stderr.write(`${safeError(error)}\n`)
  process.exitCode = 2
})
