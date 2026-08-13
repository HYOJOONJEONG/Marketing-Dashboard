import { listOnlinePresence, listPresenceUsers, listUnreadPopupMessages, readAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"

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
  const recentActivities = state.activityLogs.slice(0, 12)
  const popupMessages = listUnreadPopupMessages(state, session.user.id)

  return Response.json({
    ok: true,
    onlineUsers,
    presenceUsers,
    samePageUsers,
    recentActivities,
    popupMessages,
  })
}
