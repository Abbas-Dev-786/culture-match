import { Skeleton } from "@/components/ui/skeleton"

export default function CampaignLoading() {
  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto grid max-w-3xl gap-5">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </main>
  )
}
