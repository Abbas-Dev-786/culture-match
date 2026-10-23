export class ApplicationError extends Error {
  readonly code: string
  readonly status: number

  constructor(
    code: string,
    status: number,
    message: string,
  ) {
    super(message)
    this.code = code
    this.status = status
    this.name = "ApplicationError"
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  )
}

export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PGRST116"
  )
}
