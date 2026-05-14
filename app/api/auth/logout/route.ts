import { NextResponse } from "next/server"
import { clearUserSession, getRequestCookieSessionId } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const sessionId = await getRequestCookieSessionId()
  await clearUserSession(sessionId)
  return NextResponse.json({ ok: true })
}
