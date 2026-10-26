import { LaunchView } from "./launch-view"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LaunchAnalysisPage({ params }: PageProps) {
  const { id } = await params
  return <LaunchView analysisId={id} />
}
