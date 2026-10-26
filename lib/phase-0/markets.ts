import type {
  LaunchAnalysisBrief,
  LaunchOpportunityType,
} from "../domain/types.ts"

export type MarketScope = "city" | "region" | "country"

export type MarketValidationStatus =
  | "pending_live_validation"
  | "validated"
  | "rejected"

export interface DemoCampaignBrief {
  brandName: string
  productCategory: string
  targetMarket: {
    country: string
    region?: string
    city?: string
    marketScope: MarketScope
  }
  objective: string
  culturalReferences: string[]
  preferredLanguages: string[]
  minFollowers?: number
  maxFollowers?: number
  maxBudget?: number
  currency?: string
  creatorLimit: number
}

export interface DemoMarket {
  id: string
  label: string
  country: string
  region?: string
  city?: string
  scope: MarketScope
  validationStatus: MarketValidationStatus
  validationNotes: string[]
}

export const phase0DemoMarket = {
  id: "india-country",
  label: "India",
  country: "India",
  scope: "country",
  validationStatus: "pending_live_validation",
  validationNotes: [
    "Qloo entity and location behavior must be verified with live credentials.",
    "Creator audience geography is not assumed from the selected market.",
  ],
} satisfies DemoMarket

export const phase0DemoBrief = {
  brandName: "Northstar",
  productCategory: "streetwear",
  targetMarket: {
    country: "India",
    marketScope: "country",
  },
  objective: "Launch awareness for a limited regional streetwear collection.",
  culturalReferences: ["Nike", "Adidas"],
  preferredLanguages: ["English", "Hindi"],
  maxFollowers: 500000,
  maxBudget: 5000,
  currency: "INR",
  creatorLimit: 5,
} satisfies DemoCampaignBrief

export const phase0Markets: readonly DemoMarket[] = [phase0DemoMarket]

export function getPhase0Market(id: string): DemoMarket | undefined {
  return phase0Markets.find((market) => market.id === id)
}

export const phase0LaunchCities = [
  "Mumbai",
  "Bengaluru",
  "Delhi",
] as const

export const phase0LaunchOpportunityTypes: readonly LaunchOpportunityType[] = [
  "urn:entity:brand",
  "urn:entity:place",
]

export const phase0LaunchBriefs: readonly LaunchAnalysisBrief[] = [
  {
    brandName: "Aesop",
    product: "premium facial cleanser",
    country: "India",
    city: "Mumbai",
    opportunityType: "urn:entity:brand",
    culturalReferences: ["Tata", "The Bombay Canteen"],
    launchIntent: "Find culturally adjacent brand partners for a premium skincare launch.",
  },
  {
    brandName: "Forest Essentials",
    product: "ayurvedic body care",
    country: "India",
    city: "Bengaluru",
    opportunityType: "urn:entity:place",
    culturalReferences: ["Yoga", "Theobroma"],
    launchIntent: "Find places that could host a culturally relevant wellness launch.",
  },
  {
    brandName: "Clinique",
    product: "daily moisturizer",
    country: "India",
    city: "Delhi",
    opportunityType: "urn:entity:brand",
    culturalReferences: ["Khan Market", "Fabindia"],
    launchIntent: "Find complementary lifestyle brands for a city launch.",
  },
]

export function isPhase0LaunchCity(value: string): boolean {
  return phase0LaunchCities.some(
    (city) => city.toLocaleLowerCase() === value.trim().toLocaleLowerCase()
  )
}
