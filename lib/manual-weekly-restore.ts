import restorePayload from "@/data/manual-weekly-restore-20260519.json"
import { writeDashboardState } from "@/lib/shared-db-store"

type DashboardState = Record<string, any>

let restorePromise: Promise<DashboardState | null> | null = null

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

function buildManualRestoreSnapshot(weeklyReport: any, appliedAt: string) {
  return {
    id: `${restorePayload.restoreId}-previous-${Date.parse(appliedAt) || Date.now()}`,
    savedAt: appliedAt,
    savedBy: "system-restore",
    revenueRows: clone(weeklyReport?.revenueRows || []),
    goalRows: clone(weeklyReport?.goalRows || []),
    manualSummary: clone(weeklyReport?.manualSummary || {}),
    terminationOverviewRows: clone(weeklyReport?.terminationOverviewRows || []),
    weeklyIndustryOverviewRows: clone(weeklyReport?.weeklyIndustryOverviewRows || []),
    additionalSales: clone(weeklyReport?.additionalSales || []),
  }
}

function parseTimestamp(value: unknown) {
  const time = Date.parse(String(value || ""))
  return Number.isFinite(time) ? time : 0
}

function hasManualUpdateAfterRestoreSource(data: DashboardState | null | undefined) {
  const restoreSourceTime = parseTimestamp(restorePayload.sourceManualUpdatedAt || restorePayload.sourceGeneratedAt)
  if (!restoreSourceTime) return false
  const weeklyReport = data?.weeklyReport || {}
  const ui = data?.ui || {}
  const menuUpdatedAt = ui?.menuUpdatedAt || {}
  const candidates = [
    weeklyReport?.manualLastSavedAt,
    weeklyReport?.manualRestoredAt,
    menuUpdatedAt?.["manual-input"],
    menuUpdatedAt?.["weekly-report"],
    ...(Array.isArray(weeklyReport?.manualSaveHistory)
      ? weeklyReport.manualSaveHistory.map((row: any) => row?.savedAt || row?.createdAt)
      : []),
  ]
  return candidates.some((value) => parseTimestamp(value) > restoreSourceTime)
}

function isManualRestoreApplied(data: DashboardState | null | undefined) {
  if (String(data?.ui?.manualWeeklyRestore?.id || data?.weeklyReport?.manualRestoreId || "") === restorePayload.restoreId) {
    return true
  }
  return hasManualUpdateAfterRestoreSource(data)
}

export async function ensureManualWeeklyRestore(data: DashboardState | null | undefined) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data || null
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production") return data
  if (isManualRestoreApplied(data)) return data

  if (!restorePromise) {
    restorePromise = (async () => {
      const appliedAt = new Date().toISOString()
      const previousWeeklyReport = data.weeklyReport || {}
      const restoredWeeklyReport = {
        ...clone(restorePayload.weeklyReport),
        manualRestoreId: restorePayload.restoreId,
        manualRestoredAt: appliedAt,
        manualSaveHistory: [
          buildManualRestoreSnapshot(previousWeeklyReport, appliedAt),
          ...(Array.isArray(previousWeeklyReport?.manualSaveHistory) ? previousWeeklyReport.manualSaveHistory : []),
        ].slice(0, 10),
      }
      const nextData = {
        ...data,
        weeklyReport: restoredWeeklyReport,
        ui: {
          ...(data.ui || {}),
          manualWeeklyRestore: {
            id: restorePayload.restoreId,
            sourceBackup: restorePayload.sourceBackup,
            sourceManualUpdatedAt: restorePayload.sourceManualUpdatedAt,
            appliedAt,
          },
          menuUpdatedAt: {
            ...(data.ui?.menuUpdatedAt || {}),
            "manual-input": appliedAt,
            "weekly-report": appliedAt,
          },
        },
      }

      await writeDashboardState(
        nextData,
        { menuLabel: "Manual Input", changeLabel: "Restore weekly report from 2026-05-19 backup" },
        ["weeklyReport", "ui"],
      )
      return nextData
    })().finally(() => {
      restorePromise = null
    })
  }

  return restorePromise
}
