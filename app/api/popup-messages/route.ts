import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { appendPopupMessage, listUnreadPopupMessages, updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function safeText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max)
}

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }
  const messages = listUnreadPopupMessages(session.state, session.user.id)
  return NextResponse.json({ ok: true, messages })
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

  const action = safeText(body?.action, 40)
  if (action === "read") {
    const ids = new Set((Array.isArray(body?.messageIds) ? body.messageIds : []).map((id: unknown) => safeText(id, 120)).filter(Boolean))
    if (!ids.size) return NextResponse.json({ ok: true })
    await updateAuthState((state) => {
      const now = new Date().toISOString()
      state.popupMessages = (state.popupMessages || []).map((message) =>
        message.recipientUserId === session.user.id && ids.has(message.id)
          ? { ...message, readAt: message.readAt || now }
          : message,
      )
    })
    return NextResponse.json({ ok: true })
  }

  const title = safeText(body?.title || "업무 알림", 80)
  const messageBody = safeText(body?.body, 500)
  if (!messageBody) {
    return NextResponse.json({ ok: false, error: "메시지 내용을 입력해주세요." }, { status: 400 })
  }

  const targetUserIds = Array.from(
    new Set((Array.isArray(body?.targetUserIds) ? body.targetUserIds : []).map((id: unknown) => safeText(id, 120)).filter(Boolean)),
  )
  const sendToAll = body?.target === "all"
  let sent = 0

  await updateAuthState((state) => {
    const recipients = sendToAll
      ? state.users.filter((user) => user.active && !user.deletedAt && user.id !== session.user.id).map((user) => user.id)
      : targetUserIds
    recipients.forEach((recipientUserId) => {
      const recipient = state.users.find((user) => user.id === recipientUserId && user.active && !user.deletedAt)
      if (!recipient) return
      const created = appendPopupMessage(state, {
        senderUserId: session.user.id,
        senderName: session.user.name,
        recipientUserId: recipient.id,
        title,
        body: messageBody,
        dedupeKey: body?.dedupeKey ? safeText(body.dedupeKey, 180) : null,
      })
      if (created) sent += 1
    })
  })

  return NextResponse.json({ ok: true, sent })
}
