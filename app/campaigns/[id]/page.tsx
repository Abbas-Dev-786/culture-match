import { CampaignView } from "@/app/campaigns/[id]/campaign-view"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignPage({ params }: PageProps) {
  const { id } = await params
  return <CampaignView campaignId={id} />
}
