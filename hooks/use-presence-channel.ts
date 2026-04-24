"use client"

import { useEffect, useMemo, useState } from "react"

type PresencePayload = {
  onlineUsers: any[]
  samePageUsers: any[]
  recentActivities: any[]
}

type Params = {
  currentPage: string
  currentSection: string
}

export function usePresenceChannel(params: Params) {
  const [payload, setPayload] = useState<PresencePayload>({
    onlineUsers: [],
    samePageUsers: [],
    recentActivities: [],
  })

  const channelKey = useMemo(() => `${params.currentPage}|${params.currentSection}`, [params.currentPage, params.currentSection])

  useEffect(() => {
    let cancelled = false
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const postHeartbeat = async () => {
      await fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPage: params.currentPage,
          currentSection: params.currentSection,
          connectionId,
        }),
      }).catch(() => null)
    }

    void postHeartbeat()
    const timer = window.setInterval(postHeartbeat, 15000)

    const eventSource = new EventSource("/api/presence/stream")
    eventSource.onmessage = (event) => {
      if (cancelled) return
      try {
        const next = JSON.parse(event.data) as PresencePayload
        setPayload(next)
      } catch {}
    }

    return () => {
      cancelled = true
      window.clearInterval(timer)
      eventSource.close()
    }
  }, [channelKey, params.currentPage, params.currentSection])

  return payload
}
