"use client"

import { useRouter } from "next/navigation"
import { ChevronDown, KeyRound, LogOut, Users, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

type Props = {
  currentPage: string
  currentSection: string
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
    color: { bg: string; text: string; border: string; hex: string }
  }
}

export function WorkspaceHeader({ currentPage, currentSection, currentUser }: Props) {
  const router = useRouter()
  const heartbeatIdRef = useRef(`conn-${Math.random().toString(36).slice(2, 10)}`)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isPresenceOpen, setIsPresenceOpen] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{
      userId: string
      userName: string
      avatarEmoji?: string | null
      currentPage: string
      currentSection: string
      title?: string | null
      color: { bg: string; text: string; border: string; hex: string }
    }>
  >([])
  const [isPending, startTransition] = useTransition()
  const avatarLabel = useMemo(() => {
    const emoji = String(currentUser.avatarEmoji || "").trim()
    return emoji || currentUser.name.slice(0, 1)
  }, [currentUser.avatarEmoji, currentUser.name])
  const onlineSummary = useMemo(() => {
    if (!onlineUsers.length) return "현재 접속 없음"
    const firstName = onlineUsers[0]?.userName || "알 수 없음"
    return onlineUsers.length > 1 ? `${firstName} 외 ${onlineUsers.length - 1}명` : firstName
  }, [onlineUsers])

  const logout = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
      router.refresh()
    })
  }

  const changePassword = () => {
    setPasswordMessage("")
    if (!currentPassword || !nextPassword || !confirmPassword) {
      setPasswordMessage("비밀번호 항목을 모두 입력해주세요.")
      return
    }
    if (nextPassword !== confirmPassword) {
      setPasswordMessage("새 비밀번호 확인이 일치하지 않습니다.")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setPasswordMessage(payload?.error || "비밀번호 변경에 실패했습니다.")
        return
      }
      setCurrentPassword("")
      setNextPassword("")
      setConfirmPassword("")
      setPasswordMessage("비밀번호가 변경되었습니다.")
      setTimeout(() => setIsPasswordOpen(false), 700)
    })
  }

  useEffect(() => {
    let alive = true
    let eventSource: EventSource | null = null
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            currentPage,
            currentSection,
            connectionId: heartbeatIdRef.current,
          }),
        })
      } catch {
        // Ignore transient presence errors in the header UI.
      }
    }

    const connect = () => {
      eventSource = new EventSource("/api/presence/stream")
      eventSource.onmessage = (event) => {
        if (!alive) return
        try {
          const payload = JSON.parse(event.data)
          setOnlineUsers(Array.isArray(payload?.onlineUsers) ? payload.onlineUsers : [])
        } catch {
          setOnlineUsers([])
        }
      }
      eventSource.onerror = () => {
        eventSource?.close()
      }
    }

    void sendHeartbeat()
    heartbeatTimer = setInterval(() => {
      void sendHeartbeat()
    }, 15000)
    connect()

    return () => {
      alive = false
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (eventSource) eventSource.close()
    }
  }, [currentPage, currentSection])

  return (
    <div className="workspace-header-shell relative mb-5 overflow-visible rounded-[28px] border border-slate-200/90 bg-white/95 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/me")}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border ${currentUser.color.border} ${currentUser.color.bg} ${currentUser.color.text} text-[21px] font-black shadow-sm transition hover:scale-[1.03]`}
            aria-label="개인페이지 열기"
          >
            {avatarLabel}
          </button>
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden text-[14px]">
            <span className="shrink-0 text-[18px] font-black tracking-[-0.04em] text-slate-950">{currentUser.name}</span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">{currentUser.role}</span>
            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{currentUser.teamName}</span>
            <span className="shrink-0 text-slate-300">|</span>
            <div className="min-w-0 truncate text-[14px] text-slate-500">
              <span className="font-semibold text-slate-700">{currentPage}</span>
              {currentSection ? <> / <span className="font-semibold text-slate-700">{currentSection}</span></> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPresenceOpen((prev) => !prev)}
            className="inline-flex h-10 max-w-[250px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            <Users className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">{onlineSummary}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isPresenceOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPasswordMessage("")
              setIsPasswordOpen((prev) => !prev)
            }}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4" />
            비밀번호 변경
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={isPending}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      </div>

      {isPresenceOpen ? (
        <div className="border-t border-slate-200/90 px-6 py-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">현재 접속 중</div>
          <div className="flex flex-wrap gap-2.5">
            {onlineUsers.length ? (
              onlineUsers.map((user) => {
                const label = String(user.avatarEmoji || "").trim() || String(user.userName || "").slice(0, 1)
                return (
                  <div
                    key={`${user.userId}-${user.currentPage}-${user.currentSection}`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${user.color.border} ${user.color.bg} ${user.color.text} text-[16px] font-black`}
                    >
                      {label}
                    </span>
                    <div className="leading-tight">
                      <div className="font-semibold text-slate-900">{user.userName}</div>
                      <div className="text-xs text-slate-500">{user.currentPage}</div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-sm text-slate-400">현재 접속 중인 사용자가 없습니다.</div>
            )}
          </div>
        </div>
      ) : null}

      {isPasswordOpen ? (
        <div className="absolute right-6 top-[calc(100%+10px)] z-20 w-[360px] rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">비밀번호 변경</div>
              <div className="mt-1 text-[12px] text-slate-500">현재 비밀번호 확인 후 새 비밀번호로 바꿉니다.</div>
            </div>
            <button
              type="button"
              onClick={() => setIsPasswordOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              aria-label="비밀번호 팝업 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="현재 비밀번호"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
            <input
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              placeholder="새 비밀번호"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="새 비밀번호 확인"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
            {passwordMessage ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{passwordMessage}</div>
            ) : null}
            <button
              type="button"
              onClick={changePassword}
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending ? "변경 중..." : "비밀번호 저장"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
