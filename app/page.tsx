import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center bg-muted/30 p-6 md:p-10">
      <div className="mx-auto grid w-full max-w-5xl gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <section className="grid gap-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">CultureMatch foundation</p>
          <h1 className="max-w-2xl font-heading text-5xl font-semibold tracking-tight md:text-7xl">Find creators through culture, not guesswork.</h1>
          <p className="max-w-xl text-lg leading-8 text-muted-foreground">Create a campaign brief, persist the analysis state, and keep provider evidence traceable as the workflow grows.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/campaigns/new" />}>Start a campaign</Button>
            <Button size="lg" variant="outline" render={<Link href="/auth/login" />}>Sign in</Button>
          </div>
        </section>
        <section className="grid gap-3 rounded-3xl border bg-background p-5 shadow-sm">
          {[
            ["01", "Brief", "Capture market, objective, budget, and creator constraints."],
            ["02", "Evidence", "Keep Qloo and creator-provider signals separate from model text."],
            ["03", "Workflow", "Persist progress so a refresh never loses the campaign state."],
          ].map(([number, title, description]) => (
            <div className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl p-4 hover:bg-muted/60" key={number}>
              <span className="font-mono text-sm text-muted-foreground">{number}</span>
              <div><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
