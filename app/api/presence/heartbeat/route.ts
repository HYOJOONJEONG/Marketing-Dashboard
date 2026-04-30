import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { updateAuthState, upsertPresenceSession } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  const currentPage = String(body?.currentPage || "대시보드")
  const currentSection = String(body?.currentSection || currentPage)
  const connectionId = String(body?.connectionId || `conn-${Date.now()}`)
  const manualStatus = body?.manualStatus === "away" ? "away" : null
  const lastActivityAt = body?.lastActivityAt ? String(body.lastActivityAt) : new Date().toISOString()

  await updateAuthState((state) => {
    upsertPresenceSession(state, {
      userId: session.user.id,
      currentPage,
      currentSection,
      connectionId,
      sessionId: session.sessionId,
      manualStatus,
      lastActivityAt,
    })
  })

  return NextResponse.json({ ok: true })
}
