import type { ScoreComponent } from "@/lib/domain/types"

export interface ScoredCreatorForPrompt {
  name: string
  username?: string
  platform: string
  bio?: string
  campaignFitScore: number | null
  evidenceCompleteness: number
  components: ScoreComponent[]
  caveats: string[]
}

