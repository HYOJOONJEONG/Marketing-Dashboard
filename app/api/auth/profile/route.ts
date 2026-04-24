import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, findUserById, updateAuthState } from "@/lib/auth/store"
import { normalizeAssignedIndustries } from "@/lib/industry-groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const assignedIndustries = normalizeAssignedIndustries(body?.assignedIndustries)

  await updateAuthState((state) => {
    const target = findUserById(state, session.user.id)
    if (!target) throw new Error("사용자 정보를 찾을 수 없습니다.")
    target.assignedIndustries = assignedIndustries
    target.updatedAt = new Date().toISOString()
    appendActivityLog(state, {
      actorUserId: session.user.id,
      actorName: session.user.name,
      actionType: "profile_update",
      targetType: "user",
      targetId: session.user.id,
      pageKey: "me",
      beforeValue: "",
      afterValue: JSON.stringify({ assignedIndustries }),
      ipAddress: getRequestIp(request),
      sessionId: session.sessionId,
      success: true,
    })
  })

  return NextResponse.json({ ok: true, assignedIndustries })
}
