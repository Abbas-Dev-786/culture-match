import type { JsonObject } from "../domain/types.ts"

export type ProviderName = "qloo" | "apify" | "openrouter"

export interface ProviderUsageSnapshot {
  qlooRequests: number
  apifyRequests: number
  modelRequests: number
}

export interface ProviderRequestMeter {
  record(provider: ProviderName): void
  recordModelCall(): void
  snapshot(): ProviderUsageSnapshot
  toJson(): JsonObject
}

export function createProviderRequestMeter(): ProviderRequestMeter {
  const counts: ProviderUsageSnapshot = {
    qlooRequests: 0,
    apifyRequests: 0,
    modelRequests: 0,
  }

  return {
    record(provider) {
      if (provider === "qloo") counts.qlooRequests += 1
      if (provider === "apify") counts.apifyRequests += 1
    },
    recordModelCall() {
      counts.modelRequests += 1
    },
    snapshot() {
      return { ...counts }
    },
    toJson() {
      return { ...counts }
    },
  }
}

