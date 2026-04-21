import path from "path"

import { DashboardShell } from "@/components/dashboard-shell"
import { readDashboardState } from "@/lib/shared-db-store"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; tab?: string }>
}) {
  const params = (await searchParams) || {}
  let data: any

  try {
    data = await readDashboardState<any>(DATA_PATH)
    if (!data) {
      data = await readDashboardState<any>(FALLBACK_PATH)
    }
  } catch (error) {
    console.error("Failed to read dashboard state.", error)
  }

  return (
    <DashboardShell
      initialData={data || { ui: {}, contracts: [], termination: {} }}
      initialView={(params.view as any) || "weekly-report"}
      initialCollectionTab={(params.tab as any) || "integrated"}
    />
  )
}
