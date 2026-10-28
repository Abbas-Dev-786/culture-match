"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Package,
  Sparkles,
  Target,
  Users,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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

interface CampaignFormInput {
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
}

const steps = [
  {
    title: "Campaign",
    description: "What are you promoting?",
    icon: Package,
  },
  {
    title: "Market",
    description: "Where should it resonate?",
    icon: MapPin,
  },
  {
    title: "Audience",
    description: "What cultural signals matter?",
    icon: Target,
  },
  {
    title: "Constraints",
    description: "Shape the creator shortlist.",
    icon: Users,
  },
] as const

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function CampaignForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
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

  const formInput = (): CampaignFormInput => ({
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

  function goToNextStep(): void {
    const validationMessage = validateStep(step, formInput())
    if (validationMessage) {
      setMessage(validationMessage)
      return
    }
    setMessage(undefined)
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  function goToPreviousStep(): void {
    setMessage(undefined)
    setStep((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (step < steps.length - 1) {
      goToNextStep()
      return
    }

    const validationMessage = validateForm(formInput())
    if (validationMessage) {
      setMessage(validationMessage)
      return
    }

    setIsSubmitting(true)
    setMessage(undefined)

    const targetMarket = {
      country: country.trim(),
      marketScope,
      ...(marketScope !== "country" && region.trim()
        ? { region: region.trim() }
        : {}),
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

  const activeStep = steps[step]
  const StepIcon = activeStep.icon
  const progress = ((step + 1) / steps.length) * 100

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">CultureMatch / Campaigns</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Build a campaign brief
            </h1>
          </div>
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
            Home
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <aside className="rounded-2xl border bg-card p-4 lg:sticky lg:top-6">
            <div className="mb-4 flex items-center justify-between lg:block">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  New campaign
                </p>
                <p className="mt-1 text-sm font-medium">
                  Step {step + 1} of {steps.length}
                </p>
              </div>
              <Badge variant="secondary" className="lg:mt-3">
                {Math.round(progress)}% complete
              </Badge>
            </div>
            <Progress value={progress} aria-label="Campaign form progress" className="mb-5 lg:hidden" />
            <nav aria-label="Campaign form steps" className="grid gap-1">
              {steps.map((item, index) => {
                const Icon = item.icon
                const isActive = index === step
                const isComplete = index < step
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (index <= step) {
                        setMessage(undefined)
                        setStep(index)
                      }
                    }}
                    disabled={index > step}
                    aria-current={isActive ? "step" : undefined}
                    className={`flex items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : isComplete
                          ? "text-foreground hover:bg-muted"
                          : "text-muted-foreground opacity-60"
                    }`}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : isComplete
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-muted"
                      }`}
                    >
                      {isComplete ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <span className="hidden min-w-0 lg:block">
                      <span className="block text-sm font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <StepIcon className="size-5" />
                </span>
                <div>
                  <CardTitle>{activeStep.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {activeStep.description} Give CultureMatch enough context
                    to find creators who fit the market, not just the category.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form className="grid gap-7" onSubmit={handleSubmit} noValidate>
                {step === 0 ? (
                  <CampaignStep
                    brandName={brandName}
                    onBrandNameChange={setBrandName}
                    productCategory={productCategory}
                    onProductCategoryChange={setProductCategory}
                    productDescription={productDescription}
                    onProductDescriptionChange={setProductDescription}
                    objective={objective}
                    onObjectiveChange={setObjective}
                  />
                ) : null}

                {step === 1 ? (
                  <MarketStep
                    country={country}
                    onCountryChange={setCountry}
                    marketScope={marketScope}
                    onMarketScopeChange={setMarketScope}
                    region={region}
                    onRegionChange={setRegion}
                    city={city}
                    onCityChange={setCity}
                  />
                ) : null}

                {step === 2 ? (
                  <AudienceStep
                    culturalReferences={culturalReferences}
                    onCulturalReferencesChange={setCulturalReferences}
                    preferredLanguages={preferredLanguages}
                    onPreferredLanguagesChange={setPreferredLanguages}
                    qlooAgeRange={qlooAgeRange}
                    onQlooAgeRangeChange={setQlooAgeRange}
                    qlooGender={qlooGender}
                    onQlooGenderChange={setQlooGender}
                  />
                ) : null}

                {step === 3 ? (
                  <ConstraintsStep
                    minFollowers={minFollowers}
                    onMinFollowersChange={setMinFollowers}
                    maxFollowers={maxFollowers}
                    onMaxFollowersChange={setMaxFollowers}
                    minBudget={minBudget}
                    onMinBudgetChange={setMinBudget}
                    maxBudget={maxBudget}
                    onMaxBudgetChange={setMaxBudget}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                    creatorLimit={creatorLimit}
                    onCreatorLimitChange={setCreatorLimit}
                    consentGiven={consentGiven}
                    onConsentChange={setConsentGiven}
                  />
                ) : null}

                {message ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                  <div>
                    {step > 0 ? (
                      <Button type="button" variant="outline" onClick={goToPreviousStep}>
                        <ArrowLeft /> Back
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        You must be signed in to create a private campaign.
                      </p>
                    )}
                  </div>
                  {step < steps.length - 1 ? (
                    <Button type="submit">
                      Continue <ArrowRight />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Spinner /> Creating...
                        </>
                      ) : (
                        <>
                          Create campaign <ArrowUpRightIcon />
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {step === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Need access?{" "}
                    <Link className="text-foreground underline underline-offset-4" href="/auth/login">
                      Sign in
                    </Link>{" "}
                    or{" "}
                    <Link className="text-foreground underline underline-offset-4" href="/auth/sign-up">
                      create an account
                    </Link>
                    .
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function CampaignStep({
  brandName,
  onBrandNameChange,
  productCategory,
  onProductCategoryChange,
  productDescription,
  onProductDescriptionChange,
  objective,
  onObjectiveChange,
}: {
  brandName: string
  onBrandNameChange: (value: string) => void
  productCategory: string
  onProductCategoryChange: (value: string) => void
  productDescription: string
  onProductDescriptionChange: (value: string) => void
  objective: string
  onObjectiveChange: (value: string) => void
}) {
  return (
    <section className="grid gap-5" aria-labelledby="campaign-basics-heading">
      <div>
        <h2 id="campaign-basics-heading" className="font-medium">Start with the campaign context</h2>
        <p className="mt-1 text-sm text-muted-foreground">These inputs anchor broad creator discovery. Cultural signals are applied after discovery and only used for optional refinement.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="brandName">Brand name</FieldLabel>
          <Input id="brandName" value={brandName} onChange={(event) => onBrandNameChange(event.target.value)} placeholder="Northstar" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="productCategory">Product or category</FieldLabel>
          <Input id="productCategory" value={productCategory} onChange={(event) => onProductCategoryChange(event.target.value)} placeholder="Streetwear" required />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="productDescription">Product description</FieldLabel>
        <Textarea id="productDescription" value={productDescription} onChange={(event) => onProductDescriptionChange(event.target.value)} placeholder="Sustainable shoes for urban runners" required />
        <FieldDescription>Describe the product in the language your team uses internally.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="objective">Campaign goal</FieldLabel>
        <Textarea id="objective" value={objective} onChange={(event) => onObjectiveChange(event.target.value)} placeholder="Launch awareness for a limited regional collection" required />
      </Field>
    </section>
  )
}

function MarketStep({
  country,
  onCountryChange,
  marketScope,
  onMarketScopeChange,
  region,
  onRegionChange,
  city,
  onCityChange,
}: {
  country: string
  onCountryChange: (value: string) => void
  marketScope: MarketScope
  onMarketScopeChange: (value: MarketScope) => void
  region: string
  onRegionChange: (value: string) => void
  city: string
  onCityChange: (value: string) => void
}) {
  return (
    <section className="grid gap-5" aria-labelledby="market-heading">
      <div>
        <h2 id="market-heading" className="font-medium">Choose the cultural market</h2>
        <p className="mt-1 text-sm text-muted-foreground">Qloo researches this market; it does not verify creator audience geography.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="country">Country</FieldLabel>
          <Input id="country" value={country} onChange={(event) => onCountryChange(event.target.value)} placeholder="India" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="marketScope">Market scope</FieldLabel>
          <Select value={marketScope} onValueChange={(value) => onMarketScopeChange(value as MarketScope)}>
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
          <Input id="region" value={region} onChange={(event) => onRegionChange(event.target.value)} placeholder="Maharashtra" required />
        </Field>
      ) : null}
      {marketScope === "city" ? (
        <Field>
          <FieldLabel htmlFor="city">City</FieldLabel>
          <Input id="city" value={city} onChange={(event) => onCityChange(event.target.value)} placeholder="Mumbai" required />
        </Field>
      ) : null}
      <Alert>
        <AlertTitle>Validated-market limitation</AlertTitle>
        <AlertDescription>The initial demo is validated around India. Other markets remain extensible but may require live provider verification before reliable results.</AlertDescription>
      </Alert>
    </section>
  )
}

function AudienceStep({
  culturalReferences,
  onCulturalReferencesChange,
  preferredLanguages,
  onPreferredLanguagesChange,
  qlooAgeRange,
  onQlooAgeRangeChange,
  qlooGender,
  onQlooGenderChange,
}: {
  culturalReferences: string
  onCulturalReferencesChange: (value: string) => void
  preferredLanguages: string
  onPreferredLanguagesChange: (value: string) => void
  qlooAgeRange: QlooAgeRange | ""
  onQlooAgeRangeChange: (value: QlooAgeRange | "") => void
  qlooGender: QlooGender | ""
  onQlooGenderChange: (value: QlooGender | "") => void
}) {
  return (
    <section className="grid gap-5" aria-labelledby="signals-heading">
      <div>
        <h2 id="signals-heading" className="font-medium">Add cultural and audience signals</h2>
        <p className="mt-1 text-sm text-muted-foreground">These inputs shape the Qloo profile and the culture-informed search query.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="culturalReferences">Cultural references</FieldLabel>
          <Input id="culturalReferences" value={culturalReferences} onChange={(event) => onCulturalReferencesChange(event.target.value)} placeholder="Minimalism, eco-conscious, outdoor" />
          <FieldDescription>Separate references with commas. Qloo resolves them when possible.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="preferredLanguages">Language needs</FieldLabel>
          <Input id="preferredLanguages" value={preferredLanguages} onChange={(event) => onPreferredLanguagesChange(event.target.value)} placeholder="German, English" />
          <FieldDescription>Separate languages with commas.</FieldDescription>
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="qlooAgeRange">Target age range</FieldLabel>
          <Select value={qlooAgeRange || "none"} onValueChange={(value) => onQlooAgeRangeChange(value === "none" ? "" : value as QlooAgeRange)}>
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
          <Select value={qlooGender || "none"} onValueChange={(value) => onQlooGenderChange(value === "none" ? "" : value as QlooGender)}>
            <SelectTrigger id="qlooGender" className="w-full" aria-label="Explicit Qloo gender conditioning"><SelectValue placeholder="No gender conditioning" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No gender conditioning</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Age and gender are optional, explicit conditioning inputs. They are not inferred from your product description and do not verify creator audience demographics.</p>
        </div>
      </div>
    </section>
  )
}

function ConstraintsStep({
  minFollowers,
  onMinFollowersChange,
  maxFollowers,
  onMaxFollowersChange,
  minBudget,
  onMinBudgetChange,
  maxBudget,
  onMaxBudgetChange,
  currency,
  onCurrencyChange,
  creatorLimit,
  onCreatorLimitChange,
  consentGiven,
  onConsentChange,
}: {
  minFollowers: string
  onMinFollowersChange: (value: string) => void
  maxFollowers: string
  onMaxFollowersChange: (value: string) => void
  minBudget: string
  onMinBudgetChange: (value: string) => void
  maxBudget: string
  onMaxBudgetChange: (value: string) => void
  currency: string
  onCurrencyChange: (value: string) => void
  creatorLimit: string
  onCreatorLimitChange: (value: string) => void
  consentGiven: boolean
  onConsentChange: (value: boolean) => void
}) {
  return (
    <section className="grid gap-5" aria-labelledby="constraints-heading">
      <div>
        <h2 id="constraints-heading" className="font-medium">Set shortlist constraints</h2>
        <p className="mt-1 text-sm text-muted-foreground">Unknown provider fields remain unavailable instead of being guessed.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="minFollowers">Minimum followers</FieldLabel>
          <Input id="minFollowers" type="number" min="0" value={minFollowers} onChange={(event) => onMinFollowersChange(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="maxFollowers">Maximum followers</FieldLabel>
          <Input id="maxFollowers" type="number" min="1" value={maxFollowers} onChange={(event) => onMaxFollowersChange(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="creatorLimit">Creators per search</FieldLabel>
          <Input id="creatorLimit" type="number" min="1" max="100" value={creatorLimit} onChange={(event) => onCreatorLimitChange(event.target.value)} required />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="minBudget">Minimum campaign budget</FieldLabel>
          <Input id="minBudget" type="number" min="1" value={minBudget} onChange={(event) => onMinBudgetChange(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="maxBudget">Maximum campaign budget</FieldLabel>
          <Input id="maxBudget" type="number" min="1" value={maxBudget} onChange={(event) => onMaxBudgetChange(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <Input id="currency" maxLength={3} value={currency} onChange={(event) => onCurrencyChange(event.target.value.toUpperCase())} placeholder="INR" />
          <FieldDescription>Required when either budget value is provided.</FieldDescription>
        </Field>
      </div>
      <div className="rounded-xl border bg-muted/30 p-4">
        <Field orientation="horizontal" className="items-start">
          <Checkbox id="consentGiven" checked={consentGiven} onCheckedChange={(checked) => onConsentChange(checked === true)} />
          <FieldLabel htmlFor="consentGiven" className="font-normal">I understand this brief and its analysis state will be persisted to my private campaign workspace.</FieldLabel>
        </Field>
      </div>
    </section>
  )
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function validateStep(step: number, input: CampaignFormInput): string | undefined {
  if (step === 0) {
    if (!input.brandName.trim() || !input.productCategory.trim() || !input.productDescription.trim() || !input.objective.trim()) {
      return "Brand, product, description, and campaign goal are required to continue."
    }
    return undefined
  }
  if (step === 1) {
    if (!input.country.trim()) return "Add a country for the target market."
    if (input.marketScope !== "country" && !input.region.trim()) return "Add a region or state for this market scope."
    if (input.marketScope === "city" && !input.city.trim()) return "Add a city for a city-level market."
    return undefined
  }
  if (step === 3) return validateForm(input)
  return undefined
}

function validateForm(input: CampaignFormInput): string | undefined {
  const campaignStepError = validateStep(0, input)
  if (campaignStepError) return campaignStepError
  const marketStepError = validateStep(1, input)
  if (marketStepError) return marketStepError
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

function ArrowUpRightIcon() {
  return <ArrowRight className="rotate-[-45deg]" />
}
