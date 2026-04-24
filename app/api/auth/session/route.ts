import { NextResponse } from "next/server"
import { buildPermissionIndex } from "@/lib/auth/permissions"
import { resolveRequestSession } from "@/lib/auth/session"
import { getTeamName, toSafeUser } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false })
  }

  const permissions = buildPermissionIndex(session.state, session.user)
  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: toSafeUser(session.user, session.state),
    teamName: getTeamName(session.state, session.user.teamId),
    permissions,
  })
}
