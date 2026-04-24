import path from "path"

import { LoginPage } from "@/components/auth/login-page"
import { DashboardWorkspace } from "@/components/auth/dashboard-workspace"
import { DashboardShell } from "@/components/dashboard-shell"
import { buildPermissionIndex, filterContractsForUser, hasPermission } from "@/lib/auth/permissions"
import { requirePageAuth } from "@/lib/auth/server"
import { getUserColorToken } from "@/lib/auth/model"
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
  const auth = await requirePageAuth()

  try {
    data = await readDashboardState<any>(DATA_PATH)
    if (!data) {
      data = await readDashboardState<any>(FALLBACK_PATH)
    }
  } catch (error) {
    console.error("Failed to read dashboard state.", error)
  }

  if (!auth) return <LoginPage />

  const permissionIndex = buildPermissionIndex(auth.state, auth.user)
  const safeData = {
    ...(data || { ui: {}, contracts: [], termination: {} }),
    contracts: filterContractsForUser((data?.contracts || []) as any[], auth.user, permissionIndex),
  }

  const initialView =
    (params.view as any) ||
    (hasPermission(permissionIndex, "dashboard", "view")
      ? "weekly-report"
      : hasPermission(permissionIndex, "newContractsList", "view")
        ? "contracts"
        : "weekly-report")

  return (
    <DashboardWorkspace
      initialData={safeData}
      initialView={initialView}
      initialCollectionTab={(params.tab as any) || "integrated"}
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.title || auth.user.role,
        teamName: auth.teamName,
        color: getUserColorToken(auth.user.id),
      }}
      permissions={permissionIndex as any}
    />
  )
}
