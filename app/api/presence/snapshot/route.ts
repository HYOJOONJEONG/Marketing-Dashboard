import { listOnlinePresence, listPresenceUsers, readAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"
import { buildPermissionIndex, hasPermission } from "@/lib/auth/permissions"
import { dailyActivityRows } from "@/lib/daily-activity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const state = await readAuthState()
  const onlineUsers = listOnlinePresence(state)
  const presenceUsers = listPresenceUsers(state)
  const currentUserPresence = presenceUsers.find((row) => row.userId === session.user.id)
  const samePageUsers = presenceUsers.filter(
    (user) =>
      user.status !== "offline" &&
      user.currentPage &&
      user.currentPage === currentUserPresence?.currentPage,
  )
  const canViewAll = hasPermission(buildPermissionIndex(state, session.user), "activityLog", "view")
  const dailyActivities = dailyActivityRows(state.activityLogs, session.user.id, canViewAll)

  return Response.json({
    ok: true,
    onlineUsers,
    presenceUsers,
    samePageUsers,
    dailyActivities,
    activityScope: canViewAll ? "all" : "own",
  })
}
