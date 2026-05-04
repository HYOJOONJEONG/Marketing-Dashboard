import { NextResponse } from "next/server"
import { requireApiPermission } from "@/lib/auth/server"
import { getSharedDbEnvironmentStatus, readDashboardState, readOptionsMock } from "@/lib/shared-db-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
