const sensitiveKeyPattern =
  /(^|_)(api[-_]?key|authorization|cookie|password|secret|token|access[-_]?token|refresh[-_]?token)(_|$)/i

const sensitiveValuePattern =
  /^(bearer\s+|sk[-_]|pk[-_]|apify_api_|qloo_|eyJ)/i

export function sanitizeForFixture(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFixture(item))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKeyPattern.test(key)
          ? "[REDACTED]"
          : sanitizeForFixture(nestedValue),
      ]),
    )
  }

  if (typeof value === "string" && sensitiveValuePattern.test(value)) {
    return "[REDACTED]"
  }

  return value
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:token|api[_-]?key|password)=)[^&\s]+/gi, "$1[REDACTED]")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
