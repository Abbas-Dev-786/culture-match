"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface NewCampaignErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function NewCampaignError({ reset }: NewCampaignErrorProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="grid w-full max-w-md gap-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load the campaign form</AlertTitle>
          <AlertDescription>Try the request again before creating a campaign.</AlertDescription>
        </Alert>
        <Button className="w-fit" onClick={reset}>Try again</Button>
      </div>
    </main>
  )
}
