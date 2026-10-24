"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

interface CreateCampaignResponse {
  campaign?: { id: string }
  error?: { message: string }
}

export function CampaignForm() {
  const router = useRouter()
  const [brandName, setBrandName] = useState("")
  const [productCategory, setProductCategory] = useState("")
  const [country, setCountry] = useState("")
  const [objective, setObjective] = useState("")
  const [culturalReferences, setCulturalReferences] = useState("")
  const [preferredLanguages, setPreferredLanguages] = useState("")
  const [maxFollowers, setMaxFollowers] = useState("")
  const [maxBudget, setMaxBudget] = useState("")
  const [currency, setCurrency] = useState("")
  const [creatorLimit, setCreatorLimit] = useState("5")
  const [message, setMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(undefined)

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `campaign:${crypto.randomUUID()}`,
          brief: {
            brandName,
            productCategory,
            targetMarket: { country, marketScope: "country" },
            objective,
            culturalReferences: culturalReferences.split(",").map((value) => value.trim()).filter(Boolean),
            preferredLanguages: preferredLanguages.split(",").map((value) => value.trim()).filter(Boolean),
            maxFollowers: optionalNumber(maxFollowers),
            maxBudget: optionalNumber(maxBudget),
            currency: currency.trim() || undefined,
            creatorLimit: optionalNumber(creatorLimit),
          },
        }),
      })
      const body = (await response.json()) as CreateCampaignResponse

      if (!response.ok || !body.campaign) {
        setMessage(body.error?.message ?? "Unable to create campaign")
        return
      }

      router.push(`/campaigns/${body.campaign.id}`)
    } catch {
      setMessage("Unable to reach the campaign service. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">CultureMatch foundation</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Start a campaign</h1>
          </div>
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>Home</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Campaign brief</CardTitle>
            <CardDescription>Capture the constraints that will drive cultural research and creator discovery.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="brandName">Brand name</Label>
                  <Input id="brandName" required value={brandName} onChange={(event) => setBrandName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="productCategory">Product category</Label>
                  <Input id="productCategory" required value={productCategory} onChange={(event) => setProductCategory(event.target.value)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Target country</Label>
                <Input id="country" required value={country} onChange={(event) => setCountry(event.target.value)} placeholder="India" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="objective">Campaign objective</Label>
                <Textarea id="objective" required value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Launch awareness for a limited regional collection" />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="culturalReferences">Cultural references</Label>
                  <Input id="culturalReferences" value={culturalReferences} onChange={(event) => setCulturalReferences(event.target.value)} placeholder="Nike, Adidas" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="preferredLanguages">Preferred languages</Label>
                  <Input id="preferredLanguages" value={preferredLanguages} onChange={(event) => setPreferredLanguages(event.target.value)} placeholder="English, Hindi" />
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="maxFollowers">Maximum followers</Label>
                  <Input id="maxFollowers" type="number" min="1" value={maxFollowers} onChange={(event) => setMaxFollowers(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxBudget">Maximum budget</Label>
                  <Input id="maxBudget" type="number" min="1" value={maxBudget} onChange={(event) => setMaxBudget(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="INR" />
                </div>
              </div>
              <div className="grid gap-2 md:max-w-xs">
                <Label htmlFor="creatorLimit">Creator limit</Label>
                <Input id="creatorLimit" type="number" min="1" max="100" required value={creatorLimit} onChange={(event) => setCreatorLimit(event.target.value)} />
              </div>
              {message ? <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">You must be signed in to create a private campaign.</p>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Spinner /> Creating…</> : "Create campaign"}</Button>
              </div>
              <p className="text-sm text-muted-foreground">Need access? <Link className="text-foreground underline underline-offset-4" href="/auth/login">Sign in</Link> or <Link className="text-foreground underline underline-offset-4" href="/auth/sign-up">create an account</Link>.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
