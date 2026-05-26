import path from "path"

import { LoginPage } from "@/components/auth/login-page"
import { DashboardWorkspace } from "@/components/auth/dashboard-workspace"
import { buildPermissionIndex, filterContractsForUser } from "@/lib/auth/permissions"
import { requirePageAuth } from "@/lib/auth/server"
import { getUserColorToken } from "@/lib/auth/model"
import type { PopupMessageRecord } from "@/lib/auth/model"
import { createEmptyDailyReportState, ensureDailyDirectoryUsers, isDailyReportTeam, sortDailyDirectoryUsers } from "@/lib/daily-report"
import { ensureManualWeeklyRestore } from "@/lib/manual-weekly-restore"
import { readDashboardState } from "@/lib/shared-db-store"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

const allowedDashboardViews = new Set([
  "daily-report",
  "weekly-report",
  "contracts",
  "weekly-selection",
  "type-analysis",
  "manual-input",
  "collection",
  "option-dashboard",
  "termination",
  "admin-page",
  "my-page",
])

function normalizeDashboardView(value: unknown) {
  const text = String(value || "").trim()
  return allowedDashboardViews.has(text) ? text : "daily-report"
}

export default async function DailyReportPageRoute({
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

  data = await ensureManualWeeklyRestore(data)

  const permissionIndex = buildPermissionIndex(auth.state, auth.user)
  const baseData = data && typeof data === "object" ? data : {}
  const defaultData = {
    ui: {},
    contracts: [],
    typeAnalysis: {},
    weeklyReport: {},
    collection: { integrated: [], longTerm: [] },
    termination: { sheets: [] },
    paidOptions: {},
    dailyReport: createEmptyDailyReportState(),
    availableYears: [new Date().getFullYear()],
  }
  const safeData = {
    ...defaultData,
    ...baseData,
    ui: baseData.ui || {},
    contracts: filterContractsForUser(
      Array.isArray(baseData.contracts) ? baseData.contracts : [],
      auth.user,
      permissionIndex,
    ),
    collection: baseData.collection || { integrated: [], longTerm: [] },
    typeAnalysis: baseData.typeAnalysis || {},
    termination: baseData.termination || { sheets: [] },
    paidOptions: baseData.paidOptions || {},
    dailyReport: baseData.dailyReport || createEmptyDailyReportState(),
  }
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
  const personalMessageHistory = (Array.isArray(auth.state.popupMessages) ? auth.state.popupMessages : [])
    .filter((message: PopupMessageRecord) => message.recipientUserId === auth.user.id)
    .sort((a: PopupMessageRecord, b: PopupMessageRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)

  return (
    <DashboardWorkspace
      initialData={safeData}
      initialView={normalizeDashboardView(params.view)}
      initialCollectionTab="integrated"
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.title || auth.user.role,
        teamName: auth.teamName,
        avatarEmoji: auth.user.avatarEmoji || null,
        color: getUserColorToken(auth.user.id),
        assignedIndustries: auth.user.assignedIndustries || [],
        testIdEntries: auth.user.testIdEntries || [],
      }}
      directoryUsers={directoryUsers}
      permissions={permissionIndex as any}
      personalMessageHistory={personalMessageHistory}
    />
  )
}
