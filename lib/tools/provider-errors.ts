export type ProviderName = "qloo" | "apify"

export type ProviderErrorCode =
  | "AUTHENTICATION_FAILED"
  | "PAYMENT_REQUIRED"
  | "INVALID_PARAMETERS"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_FAILURE"
  | "EMPTY_RESULT"
  | "SCHEMA_MISMATCH"
  | "UPSTREAM_FAILURE"
  | "RUN_FAILED"
  | "RUN_ABORTED"
  | "RUN_TIMED_OUT"

export class ProviderError extends Error {
  readonly provider: ProviderName
  readonly code: ProviderErrorCode
  readonly status?: number
  readonly retryable: boolean

  constructor(input: {
    provider: ProviderName
    code: ProviderErrorCode
    message: string
    status?: number
    retryable?: boolean
    cause?: unknown
  }) {
    super(input.message, { cause: input.cause })
    this.name = "ProviderError"
    this.provider = input.provider
    this.code = input.code
    this.status = input.status
    this.retryable = input.retryable ?? isTransientProviderCode(input.code)
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError
}

export function classifyProviderError(
  error: unknown,
  provider: ProviderName
): ProviderError {
  if (isProviderError(error)) return error

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderError({
      provider,
      code: "TIMEOUT",
      message: `${provider} request timed out`,
      retryable: true,
      cause: error,
    })
  }

  if (error instanceof TypeError) {
    return new ProviderError({
      provider,
      code: "NETWORK_FAILURE",
      message: `${provider} request failed temporarily`,
      retryable: true,
      cause: error,
    })
  }

  return new ProviderError({
    provider,
    code: "UPSTREAM_FAILURE",
    message: `${provider} request failed`,
    retryable: false,
    cause: error,
  })
}

export function isTransientProviderCode(code: ProviderErrorCode): boolean {
  return [
    "RATE_LIMITED",
    "TIMEOUT",
    "NETWORK_FAILURE",
    "UPSTREAM_FAILURE",
  ].includes(code)
}

export function safeProviderError(error: unknown): {
  code: string
  message: string
} {
  if (isProviderError(error)) {
    return { code: error.code, message: error.message }
  }

  return { code: "PROVIDER_FAILURE", message: "The provider request failed" }
}
