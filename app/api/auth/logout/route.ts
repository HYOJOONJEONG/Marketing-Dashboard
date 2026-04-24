import { NextResponse } from "next/server"
import { clearUserSession, resolveRequestSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await resolveRequestSession()
  await clearUserSession(session?.sessionId)
  return NextResponse.json({ ok: true })
}
