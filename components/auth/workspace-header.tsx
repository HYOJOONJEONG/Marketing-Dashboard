"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useTransition } from "react"

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
}

export function WorkspaceHeader({ currentPage, currentSection, currentUser }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const logout = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
      router.refresh()
    })
  }

  return (
    <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${currentUser.color.border} ${currentUser.color.bg} ${currentUser.color.text} text-[20px] font-black`}>
            {currentUser.name.slice(0, 1)}
          </div>
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden text-[14px]">
            <span className="shrink-0 text-[17px] font-black tracking-[-0.03em] text-slate-950">{currentUser.name}</span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">{currentUser.role}</span>
            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{currentUser.teamName}</span>
            <span className="shrink-0 text-slate-300">|</span>
            <div className="min-w-0 truncate text-[14px] text-slate-500">
              <span className="font-semibold text-slate-700">{currentPage}</span>
              {currentSection ? <> / <span className="font-semibold text-slate-700">{currentSection}</span></> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
    </div>
  )
}
