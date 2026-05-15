import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, findUserById, updateAuthState } from "@/lib/auth/store"
import { UserTestIdEntry } from "@/lib/auth/model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeTestIdEntries(entries: unknown) {
  if (!Array.isArray(entries)) return []
  return entries
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
    .filter((entry): entry is UserTestIdEntry => Boolean(entry))
}

export async function PUT(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const testIdEntries = normalizeTestIdEntries(body?.testIdEntries)
  let nextTestIdEntries: any[] = []

  await updateAuthState((state) => {
    const target = findUserById(state, session.user.id)
    if (!target) throw new Error("사용자 정보를 찾을 수 없습니다.")

    const previousTestIds = Array.isArray(target.testIdEntries) ? target.testIdEntries : []
    const shouldClearAll = previousTestIds.length > 0 && testIdEntries.length === 0
    if (shouldClearAll && !body?.confirmClearTestIds) {
      throw new Error("기존 시험아이디가 있어 빈 목록 저장을 막았습니다. 전체 삭제가 맞으면 다시 확인 후 저장해주세요.")
    }

    target.testIdEntries = testIdEntries
    target.updatedAt = new Date().toISOString()
    nextTestIdEntries = Array.isArray(target.testIdEntries) ? target.testIdEntries : []

    appendActivityLog(state, {
      actorUserId: session.user.id,
      actorName: session.user.name,
      actionType: "profile_update",
      targetType: "user",
      targetId: session.user.id,
      pageKey: "me",
      beforeValue: JSON.stringify({ testIdEntryCount: previousTestIds.length }),
      afterValue: JSON.stringify({ testIdEntryCount: nextTestIdEntries.length }),
      ipAddress: getRequestIp(request),
      sessionId: session.sessionId,
      success: true,
    })
  })

  return NextResponse.json({
    ok: true,
    testIdEntries: nextTestIdEntries,
  })
}
