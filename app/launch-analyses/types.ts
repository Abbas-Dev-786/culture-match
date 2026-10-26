import type { Json } from "@/lib/db/database.types"
import type {
  QlooFingerprint,
  SafeLaunchActivationReport,
  SafeLaunchAnalysis,
  SafeLaunchOpportunity,
  SafeLaunchRun,
} from "@/lib/domain/types"

export interface LaunchStatusResponse {
  analysis: SafeLaunchAnalysis
  run: SafeLaunchRun
}

export interface LaunchResultsResponse extends LaunchStatusResponse {
  culturalProfile: {
    fingerprint: QlooFingerprint
    providerSummary: Json
    observedAt: string
  } | null
  opportunities: SafeLaunchOpportunity[]
  activationReport: SafeLaunchActivationReport | null
}

export interface LaunchApiError {
  error?: {
    message?: string
  }
}
