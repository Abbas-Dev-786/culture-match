import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center bg-muted/30 p-6 md:p-10">
      <div className="mx-auto grid w-full max-w-5xl gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <section className="grid gap-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">CultureMatch launch intelligence</p>
          <h1 className="max-w-2xl font-heading text-5xl font-semibold tracking-tight md:text-7xl">Launch into culture, not a generic audience.</h1>
          <p className="max-w-xl text-lg leading-8 text-muted-foreground">Use Qloo to map a city’s cultural fingerprint, find adjacent opportunities, and shape a focused launch hypothesis your team can validate.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/launch-analyses/new" />}>Map a launch</Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/campaigns/new" />}>Legacy creator search</Button>
            <Button size="lg" variant="ghost" nativeButton={false} render={<Link href="/auth/login" />}>Sign in</Button>
          </div>
        </section>
        <section className="grid gap-3 rounded-3xl border bg-background p-5 shadow-sm">
          {[
            ["01", "Fingerprint", "See the city through its places, brands, references, and cultural signals."],
            ["02", "Opportunities", "Rank adjacent entities with provider evidence and explicit caveats."],
            ["03", "Activation", "Turn the signal map into testable launch directions, not false certainty."],
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
