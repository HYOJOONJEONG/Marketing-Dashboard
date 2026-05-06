import { listOnlinePresence, listPresenceUsers, listUnreadPopupMessages, readAuthState } from "@/lib/auth/store"
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

  const abortController = new AbortController()
  let timer: ReturnType<typeof setInterval> | null = null
  let closed = false
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        if (closed || abortController.signal.aborted) return
        try {
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
          if (closed || abortController.signal.aborted) return
          controller.enqueue(
            encode({
              onlineUsers,
              presenceUsers,
              samePageUsers,
              recentActivities,
              popupMessages,
            }),
          )
        } catch {
          closed = true
          if (timer) clearInterval(timer)
        }
      }

      void send()
      timer = setInterval(() => {
        void send()
      }, 5000)
    },
    cancel() {
      closed = true
      if (timer) clearInterval(timer)
      abortController.abort()
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
