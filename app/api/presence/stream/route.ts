import { listOnlinePresence, listPresenceUsers, readAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function encodeEvent(payload: unknown) {
  return new TextEncoder().encode(`retry: 60000\ndata: ${JSON.stringify(payload)}\n\n`)
}

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
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

  return new Response(
    encodeEvent({
      onlineUsers,
      presenceUsers,
      samePageUsers,
      recentActivities,
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      },
    },
  )
}
