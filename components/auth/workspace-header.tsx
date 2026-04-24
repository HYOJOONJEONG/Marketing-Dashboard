"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, ShieldCheck } from "lucide-react"
import { useTransition } from "react"
import { usePresenceChannel } from "@/hooks/use-presence-channel"

type Props = {
  currentPage: string
  currentSection: string
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    color: { bg: string; text: string; border: string; hex: string }
  }
  canViewAdmin: boolean
}

export function WorkspaceHeader({ currentPage, currentSection, currentUser, canViewAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { onlineUsers, samePageUsers, recentActivities } = usePresenceChannel({ currentPage, currentSection })

  const logout = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
      router.refresh()
    })
  }

  return (
    <div className="mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${currentUser.color.border} ${currentUser.color.bg} ${currentUser.color.text} text-lg font-black`}>
            {currentUser.name.slice(0, 1)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-black tracking-[-0.03em] text-slate-950">{currentUser.name}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{currentUser.role}</span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{currentUser.teamName}</span>
            </div>
            <div className="mt-1 text-sm text-slate-500">
              현재 화면: <span className="font-semibold text-slate-700">{currentPage}</span>
              {currentSection ? <> / 섹션: <span className="font-semibold text-slate-700">{currentSection}</span></> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canViewAdmin ? (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4" />
              관리자페이지
            </Link>
          ) : null}
          <button
            type="button"
            onClick={logout}
            disabled={isPending}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="mb-2 text-sm font-bold text-slate-700">현재 접속 중</div>
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map((user) => (
              <div key={`${user.sessionId}-${user.connectionId}`} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${user.color.border} ${user.color.bg} ${user.color.text}`}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs font-black">
                  {String(user.userName || "").slice(0, 1)}
                </span>
                <span>{user.userName}</span>
                <span className="text-xs opacity-70">{user.currentSection || user.currentPage}</span>
              </div>
            ))}
            {!onlineUsers.length ? <div className="text-sm text-slate-400">현재 접속 중인 사용자가 없습니다.</div> : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Same Page</div>
            <div className="mt-2 space-y-2">
              {samePageUsers.slice(0, 4).map((user) => (
                <div key={`${user.sessionId}-${user.connectionId}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-700">{user.userName}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                    {user.status === "editing" ? "편집 중" : "조회 중"}
                  </span>
                </div>
              ))}
              {!samePageUsers.length ? <div className="text-sm text-slate-400">같은 화면 접속자가 없습니다.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recent Updates</div>
            <div className="mt-2 space-y-2">
              {recentActivities.slice(0, 4).map((log) => (
                <div key={log.id} className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{log.actorName}</span> · {log.actionType}
                  <div className="text-xs text-slate-400">{log.pageKey}</div>
                </div>
              ))}
              {!recentActivities.length ? <div className="text-sm text-slate-400">최근 활동 로그가 없습니다.</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
