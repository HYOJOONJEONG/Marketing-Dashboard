import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { appendPopupMessage, getTeamName, updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TARGET_TEAMS = new Set(["인포Biz1팀", "인포Biz2팀"])

function safeText(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max)
}

function isComplete(entry: any) {
  return Boolean(safeText(entry?.submittedAt))
}

export async function POST(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 })
  }

  const date = safeText(body?.date, 20)
  const reports = Array.isArray(body?.reports) ? body.reports : []
  if (!date || !reports.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  await updateAuthState((state) => {
    const activeUsersByTeam = new Map<string, string[]>()
    state.users
      .filter((user) => user.active && !user.deletedAt)
      .forEach((user) => {
        const teamName = getTeamName(state, user.teamId)
        if (!TARGET_TEAMS.has(teamName)) return
        const users = activeUsersByTeam.get(teamName) || []
        users.push(user.id)
        activeUsersByTeam.set(teamName, users)
      })

    for (const [teamName, userIds] of activeUsersByTeam.entries()) {
      if (!userIds.length) continue
      const teamReports = reports.filter(
        (entry: any) =>
          safeText(entry?.date, 20) === date &&
          safeText(entry?.teamName, 40) === teamName &&
          userIds.includes(safeText(entry?.userId, 120)),
      )
      const completedUserIds = new Set(teamReports.filter(isComplete).map((entry: any) => safeText(entry?.userId, 120)))
      const isTeamComplete = userIds.every((userId) => completedUserIds.has(userId))
      if (!isTeamComplete) continue

      const managers = state.users.filter(
        (user) =>
          user.active &&
          !user.deletedAt &&
          user.role === "team_manager" &&
          getTeamName(state, user.teamId) === teamName,
      )
      managers.forEach((manager) => {
        const created = appendPopupMessage(state, {
          senderUserId: session.user.id,
          senderName: "업무일지 알림",
          recipientUserId: manager.id,
          title: "팀 업무일지 제출 완료",
          body: `${teamName} 업무일지가 모두 올라왔습니다.`,
          dedupeKey: `daily-complete:${date}:${teamName}`,
        })
        if (created) sent += 1
      })
    }
  })

  return NextResponse.json({ ok: true, sent })
}
