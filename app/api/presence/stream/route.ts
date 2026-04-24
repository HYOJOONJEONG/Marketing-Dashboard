import { listOnlinePresence, listPresenceUsers, readAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function encode(payload: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const stream = new ReadableStream({
    start(controller) {
      let timer: ReturnType<typeof setInterval> | null = null

      const send = async () => {
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
        controller.enqueue(
          encode({
            onlineUsers,
            presenceUsers,
            samePageUsers,
            recentActivities,
          }),
        )
      }

      void send()
      timer = setInterval(() => {
        void send()
      }, 5000)

      return () => {
        if (timer) clearInterval(timer)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
