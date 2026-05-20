import { listOnlinePresence, listPresenceUsers, listUnreadPopupMessages, readAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRESENCE_STREAM_RUSH_INTERVAL_MS = 5 * 1000
const PRESENCE_STREAM_DEFAULT_INTERVAL_MS = 20 * 1000
const AUTH_STATE_CACHE_TTL_MS = 1500
let authStateCache: { expiresAt: number; value: Awaited<ReturnType<typeof readAuthState>> } | null = null

function getKstHour() {
  const formattedHour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  }).format(new Date())
  return Number(formattedHour) % 24
}

function isDailyReportRushHourKst() {
  const hour = getKstHour()
  return hour >= 16 && hour < 18
}

function getPresenceStreamIntervalMs() {
  return isDailyReportRushHourKst() ? PRESENCE_STREAM_RUSH_INTERVAL_MS : PRESENCE_STREAM_DEFAULT_INTERVAL_MS
}

function encode(payload: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

async function readCachedAuthState() {
  const now = Date.now()
  if (authStateCache && authStateCache.expiresAt > now) return authStateCache.value
  const value = await readAuthState()
  authStateCache = { expiresAt: now + AUTH_STATE_CACHE_TTL_MS, value }
  return value
}

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const abortController = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        if (closed || abortController.signal.aborted) return
        try {
          const state = await readCachedAuthState()
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
          if (timer) clearTimeout(timer)
        }
      }

      const scheduleSend = () => {
        if (closed || abortController.signal.aborted) return
        timer = setTimeout(() => {
          void send().finally(scheduleSend)
        }, getPresenceStreamIntervalMs())
      }

      void send()
      scheduleSend()
    },
    cancel() {
      closed = true
      if (timer) clearTimeout(timer)
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
