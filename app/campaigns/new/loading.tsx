import { Skeleton } from "@/components/ui/skeleton"

export default function NewCampaignLoading() {
  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[32rem] w-full rounded-2xl" />
      </div>
    </main>
  )
}
