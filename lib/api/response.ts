import { ZodError } from "zod"
import { ApplicationError, isApplicationError } from "@/lib/errors"
import { isProviderError, safeProviderError } from "@/lib/tools/provider-errors"

export function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request contains invalid fields",
          fields: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    )
  }

  if (isApplicationError(error)) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    )
  }

  if (isProviderError(error)) {
    return Response.json(
      { error: safeProviderError(error) },
      { status: error.status ?? 502 },
    )
  }

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong while processing the request",
      },
    },
    { status: 500 },
  )
}

export function invalidRequest(message: string): ApplicationError {
  return new ApplicationError("INVALID_REQUEST", 400, message)
}
