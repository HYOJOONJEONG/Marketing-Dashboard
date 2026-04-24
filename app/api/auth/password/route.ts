import { NextResponse } from "next/server"
import { verifyPasswordForUser } from "@/lib/auth/auth-service"
import { createIndividualPassword, appendActivityLog, findUserById, updateAuthState } from "@/lib/auth/store"
import { getRequestIp } from "@/lib/auth/server"
import { resolveRequestSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const currentPassword = String(body?.currentPassword || "")
  const nextPassword = String(body?.nextPassword || "")

  if (!currentPassword || !nextPassword) {
    return NextResponse.json({ ok: false, error: "현재 비밀번호와 새 비밀번호를 입력해주세요." }, { status: 400 })
  }

  if (nextPassword.length < 4) {
    return NextResponse.json({ ok: false, error: "새 비밀번호는 4자 이상으로 입력해주세요." }, { status: 400 })
  }

  const currentPasswordCheck = verifyPasswordForUser(session.user, currentPassword)
  if (!currentPasswordCheck.ok) {
    return NextResponse.json({ ok: false, error: currentPasswordCheck.error }, { status: 400 })
  }

  const passwordData = createIndividualPassword(nextPassword)

  await updateAuthState((state) => {
    const target = findUserById(state, session.user.id)
    if (!target) throw new Error("사용자 정보를 찾을 수 없습니다.")
    target.authStrategy = "individual"
    target.passwordSalt = passwordData.salt
    target.passwordHash = passwordData.hash
    target.updatedAt = new Date().toISOString()
    appendActivityLog(state, {
      actorUserId: session.user.id,
      actorName: session.user.name,
      actionType: "password_change",
      targetType: "user",
      targetId: session.user.id,
      pageKey: "me",
      beforeValue: "",
      afterValue: "password-updated",
      ipAddress: getRequestIp(request),
      sessionId: session.sessionId,
      success: true,
    })
  })

  return NextResponse.json({ ok: true })
}
