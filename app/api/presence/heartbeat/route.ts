import { NextResponse } from "next/server"
import { requireApiPermission } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState, upsertPresenceSession } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireApiPermission("newContractsList", "view")
  if (!auth.ok) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 })
  }

  const currentPage = String(body?.currentPage || "대시보드")
  const currentSection = String(body?.currentSection || currentPage)
  const connectionId = String(body?.connectionId || `conn-${Date.now()}`)

  await updateAuthState((state) => {
    upsertPresenceSession(state, {
      userId: auth.context.user.id,
      currentPage,
      currentSection,
      connectionId,
      sessionId: auth.context.sessionId,
    })
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "presence_heartbeat",
      targetType: "presence",
      targetId: connectionId,
      pageKey: currentPage,
      beforeValue: "",
      afterValue: JSON.stringify({ currentSection }),
      ipAddress: "browser",
      sessionId: auth.context.sessionId,
      success: true,
    })
  })

  return NextResponse.json({ ok: true })
}
