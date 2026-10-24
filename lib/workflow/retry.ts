import {
  ProviderError,
  classifyProviderError,
} from "../tools/provider-errors.ts"

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  maxElapsedMs: number
  jitterMs: number
}

export interface RetryRecord {
  provider: "qloo" | "apify"
  attempt: number
  delayClass: "none" | "short" | "long"
  errorCode: string
  message: string
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  maxElapsedMs: 120_000,
  jitterMs: 100,
}

export async function withProviderRetry<T>(
  provider: "qloo" | "apify",
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = defaultRetryPolicy,
  sleep: (milliseconds: number) => Promise<void> = delay,
  onRetry?: (record: RetryRecord) => void
): Promise<T> {
  let attempt = 1
  const startedAt = Date.now()
  while (true) {
    try {
      return await operation(attempt)
    } catch (error) {
      const classified = classifyProviderError(error, provider)
      if (!classified.retryable || attempt >= policy.maxAttempts)
        throw classified
      const delayMs = Math.min(
        policy.maxDelayMs,
        policy.baseDelayMs * 2 ** (attempt - 1) +
          Math.floor(Math.random() * (policy.jitterMs + 1))
      )
      if (Date.now() - startedAt + delayMs > policy.maxElapsedMs) {
        throw classified
      }
      const record: RetryRecord = {
        provider,
        attempt,
        delayClass: delayMs >= 1_000 ? "long" : "short",
        errorCode: classified.code,
        message: classified.message,
      }
      onRetry?.(record)
      await sleep(delayMs)
      attempt += 1
    }
  }
}

export function providerFailureForRun(error: unknown): ProviderError {
  return error instanceof ProviderError
    ? error
    : new ProviderError({
        provider: "qloo",
        code: "UPSTREAM_FAILURE",
        message: "The provider workflow failed",
        retryable: false,
        cause: error,
      })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
