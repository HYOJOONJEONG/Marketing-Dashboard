import fs from "fs/promises"
import path from "path"

import { DashboardShell } from "@/components/dashboard-shell"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; sheet?: string; tab?: string }>
}) {
  const params = (await searchParams) || {}
  const content = await fs.readFile(DATA_PATH, "utf8")
  const data = JSON.parse(content)

  return (
    <DashboardShell
      initialData={data}
      initialView={(params.view as any) || "weekly-report"}
      initialCollectionTab={(params.tab as any) || "integrated"}
      initialSheetId={params.sheet}
    />
  )
}
