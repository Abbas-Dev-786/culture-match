import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SafeLaunchActivationReport } from "@/lib/domain/types"

export function LaunchActivationBrief({ report }: { report: SafeLaunchActivationReport }) {
  const { brief } = report
  return (
    <Card className="border-primary/20 shadow-lg shadow-primary/5">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Activation brief</CardTitle><CardDescription>Evidence-backed directions for the next validation conversation.</CardDescription></div><Badge variant="secondary">{report.generationMode === "openrouter" ? "Model-assisted" : "Deterministic"}</Badge></div>
      </CardHeader>
      <CardContent className="grid gap-7">
        <section className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Cultural territory</p><h3 className="font-heading text-2xl font-medium">{brief.culturalTerritory.title}</h3><p className="leading-7 text-muted-foreground">{brief.culturalTerritory.description}</p><EvidenceKeys keys={brief.culturalTerritory.evidenceKeys} /></section>
        <section className="rounded-2xl bg-muted/50 p-4"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Recommended launch context</p><p className="mt-2 leading-7">{brief.recommendedLaunchContext}</p></section>
        <section className="grid gap-3"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Activation directions</p>{brief.activationDirections.map((direction) => <div className="rounded-2xl border p-4" key={direction.title}><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{direction.title}</h3><Badge variant="outline">Hypothesis</Badge></div><p className="mt-2 leading-6 text-muted-foreground">{direction.description}</p><p className="mt-2 text-sm leading-6">{direction.rationale}</p><EvidenceKeys keys={direction.evidenceKeys} /></div>)}</section>
        <div className="grid gap-6 md:grid-cols-2"><section className="grid gap-3"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Questions to validate</p>{brief.openQuestions.map((question) => <p className="text-sm leading-6" key={question}>↳ {question}</p>)}</section><section className="grid gap-3"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Caveats</p>{brief.caveats.map((caveat) => <p className="text-sm leading-6 text-muted-foreground" key={caveat}>{caveat}</p>)}</section></div>
      </CardContent>
    </Card>
  )
}

function EvidenceKeys({ keys }: { keys: string[] }) {
  return <div className="mt-3 flex flex-wrap gap-2">{keys.map((key) => <Badge key={key} variant="outline">Evidence {key}</Badge>)}</div>
}
