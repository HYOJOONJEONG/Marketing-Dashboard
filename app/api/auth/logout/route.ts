import { NextResponse } from "next/server"
import {
  getRequestCookieSessionId,
  getSessionCookieName,
  getSessionCookieOptions,
  removeUserSessionRecord,
} from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const sessionId = await getRequestCookieSessionId()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(getSessionCookieName(), "", getSessionCookieOptions(new Date(0)))
  if (sessionId) {
    void removeUserSessionRecord(sessionId).catch(() => undefined)
  }
  return response
}
