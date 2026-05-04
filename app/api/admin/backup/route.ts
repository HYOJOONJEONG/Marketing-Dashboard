import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"
import {
  getSharedDbEnvironmentStatus,
  readDashboardState,
  readOptionsMock,
  writeDashboardState,
  writeOptionsMock,
} from "@/lib/shared-db-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DASHBOARD_RESTORE_KEYS = [
  "ui",
  "currentYear",
  "years",
  "availableYears",
  "dailyReport",
  "weeklyReport",
  "contracts",
  "collection",
  "termination",
  "paidOptionSourceColumns",
] as const

function buildBackupFileName(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `infobiz-dashboard-backup-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readBackupContents(payload: unknown) {
  if (!isRecord(payload)) return null
  const contents = isRecord(payload.contents) ? payload.contents : payload
  return {
    dashboard: isRecord(contents.dashboard) ? contents.dashboard : null,
    options: isRecord(contents.options) ? contents.options : null,
  }
}

export async function GET() {
  try {
    const auth = await requireApiPermission("adminPage", "view")
    if (!auth.ok) return auth.response

    const generatedAt = new Date().toISOString()
    const backup = {
      schemaVersion: 1,
      generatedAt,
      generatedAtSeoul: new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(generatedAt)),
      generatedBy: {
        userId: auth.context.user.id,
        name: auth.context.user.name,
        teamName: auth.context.teamName,
      },
      source: getSharedDbEnvironmentStatus(),
      contents: {
        dashboard: await readDashboardState(),
        options: await readOptionsMock(),
      },
      excluded: {
        authSystem: "로그인/권한 데이터는 로컬 백업 파일 노출 위험을 줄이기 위해 제외했습니다.",
      },
    }
    const body = JSON.stringify(backup, null, 2)

    return new NextResponse(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${buildBackupFileName()}"`,
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "backup failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiPermission("adminPage", "admin")
    if (!auth.ok) return auth.response

    const formData = await request.formData().catch(() => null)
    const file = formData?.get("file")
    if (!file || typeof (file as Blob).text !== "function") {
      return NextResponse.json({ ok: false, error: "복구할 JSON 파일을 선택해주세요." }, { status: 400 })
    }

    const raw = await (file as Blob).text()
    const parsed = JSON.parse(raw)
    const contents = readBackupContents(parsed)
    if (!contents || (!contents.dashboard && !contents.options)) {
      return NextResponse.json({ ok: false, error: "백업 JSON 구조가 올바르지 않습니다." }, { status: 400 })
    }

    const restored: string[] = []
    if (contents.dashboard) {
      const restoreKeys = DASHBOARD_RESTORE_KEYS.filter((key) =>
        Object.prototype.hasOwnProperty.call(contents.dashboard, key),
      )
      if (!restoreKeys.length) {
        return NextResponse.json({ ok: false, error: "대시보드 복구 대상 항목을 찾지 못했습니다." }, { status: 400 })
      }
      await writeDashboardState(
        contents.dashboard,
        { menuLabel: "Admin Backup", changeLabel: "Restore dashboard from backup" },
        restoreKeys as any,
      )
      restored.push("dashboard")
    }

    if (contents.options) {
      await writeOptionsMock(contents.options, {
        menuLabel: "Admin Backup",
        changeLabel: "Restore options from backup",
      })
      restored.push("options")
    }

    void updateAuthState((state) => {
      appendActivityLog(state, {
        actorUserId: auth.context.user.id,
        actorName: auth.context.user.name,
        actionType: "backup_restore",
        targetType: "backup_json",
        targetId: String((file as File).name || "uploaded-json"),
        pageKey: "adminPage",
        beforeValue: "",
        afterValue: JSON.stringify({ restored }),
        ipAddress: getRequestIp(request),
        sessionId: auth.context.sessionId,
        success: true,
      })
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, restored })
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "JSON 파일을 읽지 못했습니다. 백업 파일 형식을 확인해주세요."
        : error instanceof Error
          ? error.message
          : "restore failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
