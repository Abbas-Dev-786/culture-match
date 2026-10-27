"use client"

import { useEffect } from "react"

export function SessionRefresh() {
  useEffect(() => {
    void fetch("/api/auth/refresh", {
      credentials: "same-origin",
      cache: "no-store",
    })
  }, [])

  return null
}
