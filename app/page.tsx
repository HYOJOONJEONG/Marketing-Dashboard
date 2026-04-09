import fs from "fs/promises"
import path from "path"

import { DashboardShell } from "@/components/dashboard-shell"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; tab?: string }>
}) {
  const params = (await searchParams) || {}
  const content = await fs.readFile(DATA_PATH, "utf8")
  let data: any
  try {
    data = JSON.parse(content.replace(/^\uFEFF/, ""))
  } catch (error) {
    try {
      const fallback = await fs.readFile(FALLBACK_PATH, "utf8")
      data = JSON.parse(fallback.replace(/^\uFEFF/, ""))
      await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8")
    } catch (fallbackError) {
      console.error("Failed to parse app-state.json and fallback.", error, fallbackError)
      data = { ui: {}, contracts: [], termination: {} }
    }
  }

  return (
    <DashboardShell
      initialData={data}
      initialView={(params.view as any) || "weekly-report"}
      initialCollectionTab={(params.tab as any) || "integrated"}
    />
  )
}
