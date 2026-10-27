"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

type MarketScope = "country" | "region" | "city"
type QlooAgeRange = "25_to_34" | "35_and_younger" | "36_to_55" | "55_and_older"
type QlooGender = "male" | "female"

interface CreateCampaignResponse {
  campaign?: { id: string }
  error?: { message: string }
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function CampaignForm() {
  const router = useRouter()
  const [brandName, setBrandName] = useState("")
  const [productCategory, setProductCategory] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [country, setCountry] = useState("")
  const [region, setRegion] = useState("")
  const [city, setCity] = useState("")
  const [marketScope, setMarketScope] = useState<MarketScope>("country")
  const [objective, setObjective] = useState("")
  const [culturalReferences, setCulturalReferences] = useState("")
  const [preferredLanguages, setPreferredLanguages] = useState("")
  const [qlooAgeRange, setQlooAgeRange] = useState<QlooAgeRange | "">("")
  const [qlooGender, setQlooGender] = useState<QlooGender | "">("")
  const [minFollowers, setMinFollowers] = useState("")
  const [maxFollowers, setMaxFollowers] = useState("")
  const [minBudget, setMinBudget] = useState("")
  const [maxBudget, setMaxBudget] = useState("")
  const [currency, setCurrency] = useState("")
  const [creatorLimit, setCreatorLimit] = useState("5")
  const [consentGiven, setConsentGiven] = useState(false)
  const [message, setMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const validationMessage = validateForm({
      brandName,
      productCategory,
      productDescription,
      country,
      region,
      city,
      marketScope,
      objective,
      minFollowers,
      maxFollowers,
      minBudget,
      maxBudget,
      currency,
      creatorLimit,
      consentGiven,
    })
    if (validationMessage) {
      setMessage(validationMessage)
      return
    }

    setIsSubmitting(true)
    setMessage(undefined)

    const targetMarket = {
      country: country.trim(),
      marketScope,
      ...(marketScope !== "country" && region.trim() ? { region: region.trim() } : {}),
      ...(marketScope === "city" && city.trim() ? { city: city.trim() } : {}),
    }

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `campaign:${crypto.randomUUID()}`,
          brief: {
            brandName: brandName.trim(),
            productCategory: productCategory.trim(),
            productDescription: productDescription.trim(),
            targetMarket,
            objective: objective.trim(),
            culturalReferences: splitList(culturalReferences),
            preferredLanguages: splitList(preferredLanguages),
            ...(qlooAgeRange ? { qlooAgeRange } : {}),
            ...(qlooGender ? { qlooGender } : {}),
            minFollowers: optionalNumber(minFollowers),
            maxFollowers: optionalNumber(maxFollowers),
            minBudget: optionalNumber(minBudget),
            maxBudget: optionalNumber(maxBudget),
            currency: currency.trim().toUpperCase() || undefined,
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
            <p className="text-sm text-muted-foreground">CultureMatch / Campaigns</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Build a campaign brief</h1>
          </div>
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>Home</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Campaign brief</CardTitle>
            <CardDescription>Give CultureMatch enough context to find creators who fit the market, not just the category.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-7" onSubmit={handleSubmit} noValidate>
              <section className="grid gap-5" aria-labelledby="campaign-basics-heading">
                <div>
                  <h2 id="campaign-basics-heading" className="font-medium">Campaign basics</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Required information for the creator search.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="brandName">Brand name</FieldLabel>
                    <Input id="brandName" value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Northstar" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="productCategory">Product name</FieldLabel>
                    <Input id="productCategory" value={productCategory} onChange={(event) => setProductCategory(event.target.value)} placeholder="Streetwear" required />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="productDescription">Product description</FieldLabel>
                  <Textarea id="productDescription" value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="Sustainable shoes for urban runners" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="objective">Campaign goal</FieldLabel>
                  <Textarea id="objective" value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Launch awareness for a limited regional collection" required />
                </Field>
              </section>

              <section className="grid gap-5" aria-labelledby="market-heading">
                <div>
                  <h2 id="market-heading" className="font-medium">Target market</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Qloo researches this market; it does not verify creator audience geography.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="country">Country</FieldLabel>
                    <Input id="country" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="India" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="marketScope">Market scope</FieldLabel>
                    <Select value={marketScope} onValueChange={(value) => setMarketScope(value as MarketScope)}>
                      <SelectTrigger id="marketScope" className="w-full" aria-label="Market scope">
                        <SelectValue placeholder="Select market scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="country">Country</SelectItem>
                        <SelectItem value="region">Region or state</SelectItem>
                        <SelectItem value="city">City</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {marketScope !== "country" ? (
                  <Field>
                    <FieldLabel htmlFor="region">Region or state</FieldLabel>
                    <Input id="region" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Maharashtra" required />
                  </Field>
                ) : null}
                {marketScope === "city" ? (
                  <Field>
                    <FieldLabel htmlFor="city">City</FieldLabel>
                    <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Mumbai" required />
                  </Field>
                ) : null}
                <Alert>
                  <AlertTitle>Validated-market limitation</AlertTitle>
                  <AlertDescription>The initial demo is validated around India. Other markets remain extensible but may require live provider verification before reliable results.</AlertDescription>
                </Alert>
              </section>

              <section className="grid gap-5" aria-labelledby="signals-heading">
                <div>
                  <h2 id="signals-heading" className="font-medium">Cultural signals</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Comma-separated values are resolved through Qloo when possible.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="culturalReferences">Cultural references</FieldLabel>
                    <Input id="culturalReferences" value={culturalReferences} onChange={(event) => setCulturalReferences(event.target.value)} placeholder="Minimalism, eco-conscious, outdoor" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="preferredLanguages">Language needs</FieldLabel>
                    <Input id="preferredLanguages" value={preferredLanguages} onChange={(event) => setPreferredLanguages(event.target.value)} placeholder="German, English" />
                  </Field>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="qlooAgeRange">Target age range</FieldLabel>
                    <Select value={qlooAgeRange || "none"} onValueChange={(value) => setQlooAgeRange(value === "none" ? "" : value as QlooAgeRange)}>
                      <SelectTrigger id="qlooAgeRange" className="w-full" aria-label="Explicit Qloo age conditioning"><SelectValue placeholder="No age conditioning" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No age conditioning</SelectItem>
                        <SelectItem value="25_to_34">25 to 34</SelectItem>
                        <SelectItem value="35_and_younger">35 and younger</SelectItem>
                        <SelectItem value="36_to_55">36 to 55</SelectItem>
                        <SelectItem value="55_and_older">55 and older</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="qlooGender">Target gender</FieldLabel>
                    <Select value={qlooGender || "none"} onValueChange={(value) => setQlooGender(value === "none" ? "" : value as QlooGender)}>
                      <SelectTrigger id="qlooGender" className="w-full" aria-label="Explicit Qloo gender conditioning"><SelectValue placeholder="No gender conditioning" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No gender conditioning</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">These inputs condition cultural research. They are not verified creator audience demographics.</p>
              </section>

              <section className="grid gap-5" aria-labelledby="constraints-heading">
                <div>
                  <h2 id="constraints-heading" className="font-medium">Creator constraints</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Unknown provider fields remain unavailable instead of being guessed.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="minFollowers">Minimum followers</FieldLabel>
                    <Input id="minFollowers" type="number" min="0" value={minFollowers} onChange={(event) => setMinFollowers(event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="maxFollowers">Maximum followers</FieldLabel>
                    <Input id="maxFollowers" type="number" min="1" value={maxFollowers} onChange={(event) => setMaxFollowers(event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="creatorLimit">Creators per search</FieldLabel>
                    <Input id="creatorLimit" type="number" min="1" max="100" value={creatorLimit} onChange={(event) => setCreatorLimit(event.target.value)} required />
                  </Field>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="minBudget">Minimum campaign budget</FieldLabel>
                    <Input id="minBudget" type="number" min="1" value={minBudget} onChange={(event) => setMinBudget(event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="maxBudget">Maximum campaign budget</FieldLabel>
                    <Input id="maxBudget" type="number" min="1" value={maxBudget} onChange={(event) => setMaxBudget(event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="currency">Currency</FieldLabel>
                    <Input id="currency" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="INR" />
                    <FieldDescription>Required when either budget value is provided.</FieldDescription>
                  </Field>
                </div>
              </section>

              <Field orientation="horizontal" className="items-start">
                <Checkbox id="consentGiven" checked={consentGiven} onCheckedChange={(checked) => setConsentGiven(checked === true)} />
                <FieldLabel htmlFor="consentGiven" className="font-normal">I understand this brief and its analysis state will be persisted to my private campaign workspace.</FieldLabel>
              </Field>
              {message ? <Alert variant="destructive" role="alert"><AlertDescription>{message}</AlertDescription></Alert> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">You must be signed in to create a private campaign.</p>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Spinner /> Creating...</> : "Create campaign"}</Button>
              </div>
              <p className="text-sm text-muted-foreground">Need access? <Link className="text-foreground underline underline-offset-4" href="/auth/login">Sign in</Link> or <Link className="text-foreground underline underline-offset-4" href="/auth/sign-up">create an account</Link>.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function validateForm(input: {
  brandName: string
  productCategory: string
  productDescription: string
  country: string
  region: string
  city: string
  marketScope: MarketScope
  objective: string
  minFollowers: string
  maxFollowers: string
  minBudget: string
  maxBudget: string
  currency: string
  creatorLimit: string
  consentGiven: boolean
}): string | undefined {
  if (!input.brandName.trim() || !input.productCategory.trim() || !input.productDescription.trim() || !input.country.trim() || !input.objective.trim()) return "Brand, product name, product description, country, and campaign goal are required."
  if (input.marketScope !== "country" && !input.region.trim()) return "Add a region or state for this market scope."
  if (input.marketScope === "city" && !input.city.trim()) return "Add a city for a city-level market."
  const min = optionalNumber(input.minFollowers)
  const max = optionalNumber(input.maxFollowers)
  if (input.minFollowers.trim() && min === undefined) return "Minimum followers must be a valid number."
  if (input.maxFollowers.trim() && max === undefined) return "Maximum followers must be a valid number."
  if (min !== undefined && max !== undefined && min > max) return "Minimum followers cannot exceed maximum followers."
  const minBudget = optionalNumber(input.minBudget)
  const maxBudget = optionalNumber(input.maxBudget)
  if (input.minBudget.trim() && minBudget === undefined) return "Minimum budget must be a valid number."
  if (input.maxBudget.trim() && maxBudget === undefined) return "Maximum budget must be a valid number."
  if (minBudget !== undefined && maxBudget !== undefined && minBudget > maxBudget) return "Minimum budget cannot exceed maximum budget."
  if ((input.minBudget.trim() || input.maxBudget.trim()) && !/^[A-Za-z]{3}$/.test(input.currency.trim())) return "Enter a three-letter currency when setting a budget."
  const creatorLimit = optionalNumber(input.creatorLimit)
  if (creatorLimit === undefined || !Number.isInteger(creatorLimit) || creatorLimit < 1 || creatorLimit > 100) return "Creator limit must be an integer from 1 to 100."
  if (!input.consentGiven) return "Confirm that you understand the campaign brief will be persisted."
  return undefined
}
