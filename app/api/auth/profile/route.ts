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
  const hasAssignedIndustries = Boolean(body && Object.prototype.hasOwnProperty.call(body, "assignedIndustries"))
  const hasAvatarEmoji = Boolean(body && Object.prototype.hasOwnProperty.call(body, "avatarEmoji"))
  const hasTestIdEntries = Boolean(body && Object.prototype.hasOwnProperty.call(body, "testIdEntries"))

  if (!hasAssignedIndustries && !hasAvatarEmoji && !hasTestIdEntries) {
    return NextResponse.json({ ok: false, error: "변경할 프로필 항목이 없습니다." }, { status: 400 })
  }

  const assignedIndustries = hasAssignedIndustries
    ? normalizeAssignedIndustries(body?.assignedIndustries)
    : undefined
  const avatarEmoji = hasAvatarEmoji
    ? String(body?.avatarEmoji || "").trim().slice(0, 4) || null
    : undefined
  const testIdEntries = hasTestIdEntries
    ? (Array.isArray(body?.testIdEntries)
        ? body.testIdEntries
            .map((entry: any) => {
              const testId = String(entry?.testId || "").trim().toUpperCase()
              if (!testId) return null
              const now = new Date().toISOString()
              return {
                id: String(entry?.id || `test-id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim(),
                testId,
                companyName: String(entry?.companyName || "").trim(),
                departmentName: String(entry?.departmentName || "").trim(),
                assigneeName: String(entry?.assigneeName || "").trim(),
                contact: String(entry?.contact || "").trim(),
                note: String(entry?.note || "").trim(),
                createdAt: String(entry?.createdAt || now).trim(),
                updatedAt: now,
              }
            })
            .filter(Boolean)
        : [])
    : undefined

  let nextAssignedIndustries: string[] = []
  let nextAvatarEmoji: string | null = null
  let nextTestIdEntries: any[] = []

  await updateAuthState((state) => {
    const target = findUserById(state, session.user.id)
    if (!target) throw new Error("사용자 정보를 찾을 수 없습니다.")
    if (assignedIndustries) target.assignedIndustries = assignedIndustries
    if (hasAvatarEmoji) target.avatarEmoji = avatarEmoji ?? null
    if (hasTestIdEntries) target.testIdEntries = testIdEntries || []
    target.updatedAt = new Date().toISOString()
    nextAssignedIndustries = normalizeAssignedIndustries(target.assignedIndustries)
    nextAvatarEmoji = target.avatarEmoji ? String(target.avatarEmoji).trim() : null
    nextTestIdEntries = Array.isArray(target.testIdEntries) ? target.testIdEntries : []
    appendActivityLog(state, {
      actorUserId: session.user.id,
      actorName: session.user.name,
      actionType: "profile_update",
      targetType: "user",
      targetId: session.user.id,
      pageKey: "me",
      beforeValue: "",
      afterValue: JSON.stringify({
        assignedIndustries: nextAssignedIndustries,
        avatarEmoji: nextAvatarEmoji,
        testIdEntryCount: nextTestIdEntries.length,
      }),
      ipAddress: getRequestIp(request),
      sessionId: session.sessionId,
      success: true,
    })
  })

  return NextResponse.json({
    ok: true,
    assignedIndustries: nextAssignedIndustries,
    avatarEmoji: nextAvatarEmoji,
    testIdEntries: nextTestIdEntries,
  })
}
