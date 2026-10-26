"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { launchOpportunityTypes, type LaunchOpportunityType } from "@/lib/domain/types"

const opportunityLabels: Record<LaunchOpportunityType, string> = {
  "urn:entity:brand": "Brand or retail partner",
  "urn:entity:place": "Place or venue",
  "urn:entity:artist": "Artist or creative",
  "urn:entity:person": "Person or tastemaker",
  "urn:entity:podcast": "Podcast",
  "urn:entity:movie": "Film",
  "urn:entity:tv_show": "TV show",
  "urn:entity:destination": "Destination",
  "urn:entity:book": "Book",
  "urn:entity:videogame": "Video game",
}

const demoLaunchBrief = {
  brandName: "Forest Essentials",
  product: "ayurvedic body care",
  city: "Bengaluru",
  opportunityType: "urn:entity:place" as const,
  references: "Yoga, Theobroma",
  launchIntent: "Find places that could host a culturally relevant wellness launch.",
}

export function LaunchForm() {
  const router = useRouter()
  const [brandName, setBrandName] = useState(demoLaunchBrief.brandName)
  const [product, setProduct] = useState(demoLaunchBrief.product)
  const [city, setCity] = useState(demoLaunchBrief.city)
  const [opportunityType, setOpportunityType] = useState<LaunchOpportunityType>(demoLaunchBrief.opportunityType)
  const [references, setReferences] = useState(demoLaunchBrief.references)
  const [launchIntent, setLaunchIntent] = useState(demoLaunchBrief.launchIntent)
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit() {
    const culturalReferences = references
      .split(",")
      .map((reference) => reference.trim())
      .filter(Boolean)
    if (!brandName.trim() || !product.trim() || !city.trim() || !launchIntent.trim()) {
      setError("Add your brand, product, city, and launch intent to continue.")
      return
    }
    if (culturalReferences.length < 2 || culturalReferences.length > 5) {
      setError("Add 2 to 5 cultural references, separated by commas.")
      return
    }

    setError(undefined)
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/launch-analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `launch:${crypto.randomUUID()}`,
          brief: {
            brandName: brandName.trim(),
            product: product.trim(),
            country: "India",
            city: city.trim(),
            opportunityType,
            culturalReferences,
            launchIntent: launchIntent.trim(),
          },
        }),
      })
      const payload = (await response.json()) as { analysis?: { id: string }; error?: { message?: string } }
      if (!response.ok || !payload.analysis?.id) {
        throw new Error(payload.error?.message ?? "Unable to start the launch analysis.")
      }
      router.push(`/launch-analyses/${payload.analysis.id}`)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to start the launch analysis.")
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-primary/10 bg-background/90 shadow-xl shadow-primary/5">
      <CardHeader>
        <CardTitle>Build a launch brief</CardTitle>
        <CardDescription>A validated Bengaluru demo brief is prefilled. Edit any field before you run it.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {error ? <Alert variant="destructive"><AlertTitle>Check the brief</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="brand">Brand</FieldLabel>
            <Input id="brand" value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Aesop" />
          </Field>
          <Field>
            <FieldLabel htmlFor="product">Product or offer</FieldLabel>
            <Input id="product" value={product} onChange={(event) => setProduct(event.target.value)} placeholder="Premium facial cleanser" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="city">Launch city</FieldLabel>
            <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Mumbai" />
            <FieldDescription>Currently optimized for Indian city launches.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Opportunity type</FieldLabel>
            <Select value={opportunityType} onValueChange={(value) => setOpportunityType(value as LaunchOpportunityType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {launchOpportunityTypes.map((type) => <SelectItem key={type} value={type}>{opportunityLabels[type]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="references">Cultural references</FieldLabel>
          <Input id="references" value={references} onChange={(event) => setReferences(event.target.value)} placeholder="The Bombay Canteen, Tata, Maison Margiela" />
          <FieldDescription>Enter 2–5 brands, places, people, or cultural signals, separated by commas.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="intent">What are you trying to unlock?</FieldLabel>
          <Textarea id="intent" value={launchIntent} onChange={(event) => setLaunchIntent(event.target.value)} placeholder="Find culturally adjacent brands for a launch collaboration." />
        </Field>
        <Button className="w-full" size="lg" onClick={submit} disabled={isSubmitting}>
          {isSubmitting ? <><Spinner /> Building your cultural map</> : "Start launch analysis"}
        </Button>
      </CardContent>
    </Card>
  )
}
