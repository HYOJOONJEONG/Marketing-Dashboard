"use client"

import { Eye, EyeOff, Lock, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

export function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "로그인에 실패했습니다.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_34%,#eef6ff_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/60 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur xl:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_48%,#22c55e_100%)] p-10 text-white xl:block">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
              INFoBiz Internal Workspace
            </div>
            <div className="mt-8 text-4xl font-black leading-tight tracking-[-0.04em]">
              업무형 로그인
              <br />
              협업 대시보드
            </div>
            <p className="mt-5 max-w-md text-base leading-7 text-white/78">
              로그인 후 권한에 맞는 메뉴만 노출되고, 접속 상태와 활동 로그, 편집 상태까지 함께 추적되는 내부 업무 시스템입니다.
            </p>
            <div className="mt-10 grid gap-4">
              {[
                "이름(ID) + 비밀번호 로그인",
                "역할 기반 메뉴 노출과 서버단 권한 차단",
                "현재 접속자, 편집 중 상태, 감사 로그 지원",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="mx-auto max-w-md">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Login</div>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">인포Biz 업무 로그인</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                일반 사용자는 이름(ID)과 공통 비밀번호로 로그인하고, 관리자 계정은 별도 로그인 정보를 사용합니다.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">이름(ID)</span>
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    <input
                      autoComplete="username"
                      className="h-full w-full bg-transparent text-[15px] text-slate-900 outline-none"
                      placeholder="예: 정효준 / admin"
                      value={loginId}
                      onChange={(event) => setLoginId(event.target.value)}
                      aria-label="이름 또는 로그인 아이디"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">비밀번호</span>
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <input
                      autoComplete="current-password"
                      className="h-full w-full bg-transparent text-[15px] text-slate-900 outline-none"
                      placeholder="비밀번호"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-label="비밀번호"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-slate-400 transition hover:text-slate-600"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-[15px] font-bold text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "로그인 중..." : "로그인"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                비밀번호는 코드에 고정하지 않고 환경변수에서 읽도록 설계되어 있습니다.
                <br />
                예: <code className="font-semibold text-slate-700">INFOBIZ_COMMON_PASSWORD</code>,{" "}
                <code className="font-semibold text-slate-700">INFOBIZ_ADMIN_PASSWORD</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
