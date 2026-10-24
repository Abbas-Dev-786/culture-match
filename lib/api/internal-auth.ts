import { timingSafeEqual } from "node:crypto"
import { ApplicationError } from "@/lib/errors"

export function requireInternalBearer(
  request: Request,
  environmentVariable: string
): void {
  const expected = process.env[environmentVariable]?.trim()
  if (!expected) {
    throw new ApplicationError(
      "INTERNAL_CONFIGURATION_ERROR",
      500,
      "Internal request authentication is not configured"
    )
  }

  const provided = request.headers.get("authorization")
  if (!provided || !constantTimeEqual(provided, `Bearer ${expected}`)) {
    throw new ApplicationError(
      "AUTH_REQUIRED",
      401,
      "Internal authentication is required"
    )
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  if (leftBytes.length !== rightBytes.length) return false
  return timingSafeEqual(leftBytes, rightBytes)
}
