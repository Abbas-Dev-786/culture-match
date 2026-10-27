export type CreatorTier = "nano" | "micro" | "mid" | "macro" | "mega" | "unknown"

export function creatorTier(followers: number | undefined): CreatorTier {
  if (followers === undefined || followers < 1_000) return "unknown"
  if (followers < 10_000) return "nano"
  if (followers < 100_000) return "micro"
  if (followers < 500_000) return "mid"
  if (followers < 1_000_000) return "macro"
  return "mega"
}

export function creatorTierLabel(tier: CreatorTier): string {
  return tier === "unknown" ? "Unknown" : tier[0].toUpperCase() + tier.slice(1)
}

export function creatorTierBudgetRange(tier: CreatorTier): { min: number; max?: number } | undefined {
  if (tier === "nano") return { min: 0, max: 500 }
  if (tier === "micro") return { min: 500, max: 5_000 }
  if (tier === "mid") return { min: 5_000, max: 25_000 }
  if (tier === "macro") return { min: 25_000, max: 100_000 }
  if (tier === "mega") return { min: 100_000 }
  return undefined
}
