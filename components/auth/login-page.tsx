"use client"

import { Eye, EyeOff, Lock, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setError("")
    setIsSubmitting(true)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId, password }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "로그인에 실패했습니다.")
        return
      }
      router.replace("/daily-report")
      router.refresh()
    } catch (loginError) {
      setError(
        loginError instanceof DOMException && loginError.name === "AbortError"
          ? "로그인 응답이 지연되고 있습니다. 서버 상태를 확인한 뒤 다시 시도해주세요."
          : "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      )
    } finally {
      window.clearTimeout(timeoutId)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_34%,#eef6ff_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/60 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden min-h-[640px] overflow-hidden xl:block">
            <div
              className="absolute inset-0 scale-[1.03] bg-cover bg-center saturate-[1.18] brightness-[1.06] contrast-[1.06]"
              style={{ backgroundImage: "url('/login-yonhapinfomax.jpg')" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.22)_0%,rgba(15,23,42,0.08)_48%,rgba(15,23,42,0.24)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/12 to-transparent" />
          </div>

          <div className="flex items-center p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Login</div>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">인포Biz본부 로그인</h1>

              <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">이름(ID)</span>
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    <input
                      autoComplete="username"
                      className="h-full w-full bg-transparent text-[15px] text-slate-900 outline-none"
                      placeholder="이름 입력"
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
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-[15px] font-bold text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "로그인 중..." : "로그인"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
