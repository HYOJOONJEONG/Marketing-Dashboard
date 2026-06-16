import path from "path"
import { NextResponse } from "next/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"
import { getRequestIp, requireApiPermission } from "@/lib/auth/server"
import { ensureManualWeeklyRestore } from "@/lib/manual-weekly-restore"
import { readDashboardState, writeDashboardState } from "@/lib/shared-db-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")
const EMPTY_DASHBOARD = { ui: {}, contracts: [], termination: {} }

function safeText(value: unknown) {
  return String(value ?? "").trim()
}

function parseTimestamp(value: unknown) {
  const time = Date.parse(String(value || ""))
  return Number.isFinite(time) ? time : 0
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
}

function mergeManualSaveHistory(existingHistory: any[] = [], incomingHistory: any[] = []) {
  const map = new Map<string, any>()
  const addRows = (rows: any[]) => {
    ;(Array.isArray(rows) ? rows : []).forEach((row: any) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return
      const id = safeText(row?.id || row?.savedAt || row?.createdAt)
      if (!id) return
      const existing = map.get(id)
      if (!existing || parseTimestamp(row?.savedAt || row?.createdAt) >= parseTimestamp(existing?.savedAt || existing?.createdAt)) {
        map.set(id, row)
      }
    })
  }
  addRows(existingHistory)
  addRows(incomingHistory)
  return Array.from(map.values())
    .sort((a, b) => parseTimestamp(b?.savedAt || b?.createdAt) - parseTimestamp(a?.savedAt || a?.createdAt))
    .slice(0, 5)
}

function buildCompactManualSnapshot(weeklyReport: any, userName: string) {
  if (!weeklyReport || typeof weeklyReport !== "object" || Array.isArray(weeklyReport)) return null
  const savedAt = safeText(weeklyReport?.manualLastSavedAt || weeklyReport?.manualRestoredAt || weeklyReport?.updatedAt)
  const hasManualPayload =
    Array.isArray(weeklyReport?.revenueRows) ||
    Array.isArray(weeklyReport?.goalRows) ||
    Array.isArray(weeklyReport?.terminationOverviewRows) ||
    Array.isArray(weeklyReport?.weeklyIndustryOverviewRows) ||
    Array.isArray(weeklyReport?.additionalSales)
  if (!savedAt && !hasManualPayload) return null
  const stableId = safeText(weeklyReport?.manualSaveVersion || weeklyReport?.manualRestoreId || savedAt || "current")
  return {
    id: `manual-current-${stableId}`,
    savedAt: savedAt || new Date().toISOString(),
    savedBy: safeText(weeklyReport?.manualLastSavedBy) || userName || "server-current",
    revenueRows: cloneJson(weeklyReport?.revenueRows || []),
    goalRows: cloneJson(weeklyReport?.goalRows || []),
    manualSummary: cloneJson(weeklyReport?.manualSummary || {}),
    terminationOverviewRows: cloneJson(weeklyReport?.terminationOverviewRows || []),
    weeklyIndustryOverviewRows: cloneJson(weeklyReport?.weeklyIndustryOverviewRows || []),
    additionalSales: cloneJson(weeklyReport?.additionalSales || []),
  }
}

function mergeManualWeeklyReport(existingWeeklyReport: any, incomingPatch: any, userName: string) {
  if (!incomingPatch || typeof incomingPatch !== "object" || Array.isArray(incomingPatch)) {
    throw new Error("수동입력 저장 데이터가 올바르지 않습니다.")
  }
  const currentSnapshot = buildCompactManualSnapshot(existingWeeklyReport, userName)
  return {
    ...(existingWeeklyReport || {}),
    ...incomingPatch,
    manualRestoreId: incomingPatch?.manualRestoreId || existingWeeklyReport?.manualRestoreId,
    manualRestoredAt: incomingPatch?.manualRestoredAt || existingWeeklyReport?.manualRestoredAt,
    manualSaveHistory: mergeManualSaveHistory(
      existingWeeklyReport?.manualSaveHistory,
      currentSnapshot ? [currentSnapshot] : [],
    ),
  }
}

function buildManualReceipt(data: any) {
  return {
    weeklyReport: {
      manualLastSavedAt: data?.weeklyReport?.manualLastSavedAt,
      manualLastSavedBy: data?.weeklyReport?.manualLastSavedBy,
      manualSaveVersion: data?.weeklyReport?.manualSaveVersion,
    },
  }
}

function isTransientStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return /connect|connection|socket|timeout|timed out|econn|redis/i.test(message)
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("manualInput", "edit")
  if (!auth.ok) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 })
  }

  try {
    let existingData =
      (await readDashboardState<any>(DATA_PATH)) ||
      (await readDashboardState<any>(FALLBACK_PATH)) ||
      EMPTY_DASHBOARD
    existingData = await ensureManualWeeklyRestore(existingData)

    const now = new Date().toISOString()
    const changedKeys: Array<"weeklyReport" | "paidOptionSourceColumns" | "ui"> = ["weeklyReport", "ui"]
    const nextData = {
      ...existingData,
      weeklyReport: mergeManualWeeklyReport(existingData?.weeklyReport, body?.weeklyReport, auth.context.user.name),
      ui: {
        ...(existingData?.ui || {}),
        menuUpdatedAt: {
          ...(existingData?.ui?.menuUpdatedAt || {}),
          "manual-input": now,
          "weekly-report": now,
        },
      },
    }

    if (Array.isArray(body?.paidOptionSourceColumns)) {
      nextData.paidOptionSourceColumns = cloneJson(body.paidOptionSourceColumns)
      changedKeys.push("paidOptionSourceColumns")
    }

    await writeDashboardState(
      nextData,
      { menuLabel: "Manual Input", changeLabel: "수동입력 전용 저장" },
      changedKeys,
    )
    await updateAuthState((state) => {
      appendActivityLog(state, {
        actorUserId: auth.context.user.id,
        actorName: auth.context.user.name,
        actionType: "manual_input_save",
        targetType: "dashboard_state",
        targetId: "weeklyReport",
        pageKey: "weeklyReport",
        beforeValue: "",
        afterValue: JSON.stringify({ detail: "수동입력 리스트 저장", changedKeys }),
        ipAddress: getRequestIp(request),
        sessionId: auth.context.sessionId,
        success: true,
      })
    }).catch((error) => {
      console.error("Failed to append manual input activity log.", error)
    })

    return NextResponse.json({ ok: true, data: buildManualReceipt(nextData) })
  } catch (error) {
    const message = isTransientStoreError(error)
      ? "저장소 연결이 일시적으로 불안정합니다. 다시 저장해주세요."
      : error instanceof Error
        ? error.message
        : "수동입력 저장에 실패했습니다."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
