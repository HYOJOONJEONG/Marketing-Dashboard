import { NextResponse } from "next/server"
import { validateCredentials } from "@/lib/auth/auth-service"
import { createUserSession } from "@/lib/auth/session"
import { getRequestIp, getRequestUserAgent } from "@/lib/auth/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 })
  }

  const loginId = String(body?.loginId || "").trim()
  const password = String(body?.password || "")
  if (!loginId || !password) {
    return NextResponse.json({ ok: false, error: "이름(ID)과 비밀번호를 입력해주세요." }, { status: 400 })
  }

  const result = await validateCredentials(loginId, password)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
  }

  await createUserSession(result.user, {
    ipAddress: getRequestIp(request),
    userAgent: getRequestUserAgent(request),
  })

  return NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      role: result.user.role,
      teamId: result.user.teamId,
    },
  })
}
