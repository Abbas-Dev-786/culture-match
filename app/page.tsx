import Link from "next/link"
import { ArrowUpRight, Check, MapPin, Sparkles, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const workflow = [
  {
    number: "01",
    title: "Brief",
    description: "Tell us what you are launching, where, and who you want to reach.",
  },
  {
    number: "02",
    title: "Culture map",
    description: "Qloo turns your market and references into a directional taste profile.",
  },
  {
    number: "03",
    title: "Shortlist",
    description: "Apify finds Instagram creators, then CultureMatch ranks the evidence.",
  },
]

const previewMatches = [
  {
    name: "Lena Hoffmann",
    handle: "@lenarunsberlin",
    score: 92,
    tags: ["Minimalism", "Outdoor"],
  },
  {
    name: "Mara Studio",
    handle: "@marastudio",
    score: 84,
    tags: ["Eco-conscious", "Urban"],
  },
  {
    name: "Sofia Klein",
    handle: "@sofiaklein",
    score: 76,
    tags: ["Indie", "Movement"],
  },
]

export default function Page() {
  return (
    <main className="min-h-svh overflow-hidden bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            CultureMatch
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/campaigns" />}
            >
              History
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/trending" />}
            >
              Trends
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/auth/login" />}
            >
              Sign in
            </Button>
            <Button
              className="rounded-full px-5"
              nativeButton={false}
              render={<Link href="/campaigns/new" />}
            >
              Start a brief <ArrowUpRight />
            </Button>
          </div>
        </nav>

        <section className="grid gap-12 pb-20 pt-20 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-20 lg:pt-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Regional creator intelligence
            </div>
            <h1 className="max-w-2xl font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.055em] md:text-7xl">
              Find the creators your market already feels.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              CultureMatch combines Qloo&apos;s cultural intelligence with
              Instagram discovery to turn a campaign brief into a shortlist
              you can actually explain.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="h-12 rounded-full px-6 text-base"
                nativeButton={false}
                render={<Link href="/campaigns/new" />}
              >
                Build a campaign brief <ArrowUpRight />
              </Button>
              <span className="text-sm text-muted-foreground">
                No follower-count guesswork.
              </span>
            </div>
            <div className="mt-12 flex flex-wrap gap-8 border-t border-border pt-6 text-sm text-muted-foreground">
              <span>
                <strong className="text-xl text-foreground">6</strong>{" "}
                transparent score signals
              </span>
              <span>
                <strong className="text-xl text-foreground">2</strong>{" "}
                provider layers
              </span>
              <span>
                <strong className="text-xl text-foreground">0–100</strong>{" "}
                fit score
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-8 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative rounded-[2rem] border border-border bg-card p-4 shadow-xl shadow-primary/5 sm:p-6">
              <div className="flex items-start justify-between border-b border-border pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Live campaign preview
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
                    EcoWear · Berlin
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Urban runners · German + English
                  </p>
                </div>
                <Badge variant="secondary">Culture-led</Badge>
              </div>
              <div className="grid gap-3 pt-5">
                {previewMatches.map((match, index) => (
                  <div
                    key={match.handle}
                    className="rounded-2xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {match.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{match.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {match.handle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-foreground">
                          {match.score}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          fit score
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-muted-foreground/70">
                        0{index + 1}
                      </span>
                      {match.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                  <MapPin className="size-4 text-primary-foreground/80" />
                  <p className="mt-5 text-2xl font-semibold">Berlin</p>
                  <p className="mt-1 text-xs text-primary-foreground/70">
                    Qloo taste profile
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
                  <Users className="size-4 text-primary" />
                  <p className="mt-5 text-2xl font-semibold">38</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    signals analyzed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-16">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                A better way to shortlist
              </p>
              <h2 className="mt-3 max-w-sm font-heading text-3xl font-semibold leading-tight tracking-[-0.04em]">
                Popularity is a signal. Culture is the context.
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {workflow.map((item) => (
                <div
                  key={item.number}
                  className="rounded-3xl border border-border bg-card p-5"
                >
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.number}
                  </p>
                  <h3 className="mt-10 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-8 text-sm text-muted-foreground">
          <span>
            Built for marketers who need a reason behind the recommendation.
          </span>
          <span className="flex items-center gap-2">
            <Check className="size-4 text-primary" /> Evidence-first by design
          </span>
        </footer>
      </div>
    </main>
  )
}
