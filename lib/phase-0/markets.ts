export type MarketScope = "city" | "region" | "country"

export type MarketValidationStatus =
  | "pending_live_validation"
  | "validated"
  | "rejected"

export interface DemoCampaignBrief {
  brandName: string
  productCategory: string
  productDescription: string
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
  productDescription: "Streetwear for urban audiences",
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
