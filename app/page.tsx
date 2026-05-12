import path from "path"

import { LoginPage } from "@/components/auth/login-page"
import { DashboardWorkspace } from "@/components/auth/dashboard-workspace"
import { DashboardShell } from "@/components/dashboard-shell"
import { buildPermissionIndex, filterContractsForUser, hasPermission } from "@/lib/auth/permissions"
import { requirePageAuth } from "@/lib/auth/server"
import { getUserColorToken } from "@/lib/auth/model"
import { ensureDailyDirectoryUsers, isDailyReportTeam, sortDailyDirectoryUsers } from "@/lib/daily-report"
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
  const isCollectionTab = (value: unknown): value is "integrated" | "long-term" | "delivery" =>
    value === "integrated" || value === "long-term" || value === "delivery"
  const requestedCollectionTab = isCollectionTab(params.tab) ? params.tab : undefined
  const savedCollectionTab = isCollectionTab(safeData?.collection?.tab) ? safeData.collection.tab : undefined
  const directoryUsers = ensureDailyDirectoryUsers(
    sortDailyDirectoryUsers(
      auth.state.users
        .filter((user) => !user.deletedAt && user.active)
        .map((user) => {
          const team = auth.state.teams.find((item) => item.id === user.teamId)
          return {
            id: user.id,
            loginId: user.loginId,
            name: user.name,
            title: user.title || user.role,
            teamId: user.teamId,
            teamName: team?.name || auth.teamName,
            teamOrder: Number(team?.teamOrder ?? 99),
            displayOrder: Number(user.displayOrder ?? 99),
            avatarEmoji: user.avatarEmoji || null,
          }
        })
        .filter((user) => isDailyReportTeam(user.teamName)),
    ),
  )

  const initialView =
    (params.view as any) ||
    (requestedCollectionTab || savedCollectionTab
      ? "collection"
      : undefined) ||
    (hasPermission(permissionIndex, "dailyReport", "view")
      ? "daily-report"
      : hasPermission(permissionIndex, "weeklyReport", "view")
        ? "weekly-report"
        : hasPermission(permissionIndex, "newContractsList", "view")
        ? "contracts"
        : "daily-report")

  return (
    <DashboardWorkspace
      initialData={safeData}
      initialView={initialView}
      initialCollectionTab={requestedCollectionTab || savedCollectionTab || "integrated"}
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.title || auth.user.role,
        teamName: auth.teamName,
        avatarEmoji: auth.user.avatarEmoji || null,
        color: getUserColorToken(auth.user.id),
      }}
      directoryUsers={directoryUsers}
      permissions={permissionIndex as any}
    />
  )
}
