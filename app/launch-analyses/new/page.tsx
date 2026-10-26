import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LaunchForm } from "./launch-form"

export default function NewLaunchAnalysisPage() {
  return (
    <main className="min-h-svh bg-muted/30 px-6 py-10 md:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <section className="grid gap-5 pt-4">
          <Button
            className="w-fit"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/" />}
          >
            ← CultureMatch
          </Button>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Qloo launch intelligence
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
            Find the cultural territory for your next launch.
          </h1>
          <p className="max-w-lg text-lg leading-8 text-muted-foreground">
            Start with a city, a product, and a few cultural references. We will
            turn them into an evidence-backed opportunity map and activation brief.
          </p>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            Phase 3 is intentionally focused on launch discovery. Recommendations
            are hypotheses to validate, not claims of partnership or commercial fit.
          </p>
        </section>
        <LaunchForm />
      </div>
    </main>
  )
}
