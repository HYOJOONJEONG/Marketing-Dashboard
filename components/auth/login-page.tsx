"use client"

import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, Smartphone, UserRound } from "lucide-react"
import { useState } from "react"

type TwoFactorState = {
  required: boolean
  setupRequired: boolean
  qrDataUrl: string | null
  manualSecret: string | null
}

const EMPTY_TWO_FACTOR: TwoFactorState = {
  required: false,
  setupRequired: false,
  qrDataUrl: null,
  manualSecret: null,
}

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [twoFactor, setTwoFactor] = useState<TwoFactorState>(EMPTY_TWO_FACTOR)
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
        body: JSON.stringify({ loginId, password, otpCode }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (payload?.requiresTwoFactor) {
        setTwoFactor({
          required: true,
          setupRequired: Boolean(payload.twoFactorSetupRequired),
          qrDataUrl: payload.qrDataUrl || null,
          manualSecret: payload.manualSecret || null,
        })
        setError(payload?.error || "인증앱의 6자리 코드를 입력해주세요.")
        return
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "로그인에 실패했습니다.")
        return
      }
      window.location.replace("/daily-report")
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
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-slate-200 bg-slate-950 p-6 text-white sm:p-10 lg:border-b-0 lg:border-r">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-100 ring-1 ring-blue-300/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-[-0.04em]">인포Biz본부 로그인</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">비밀번호 확인 후 인증앱의 6자리 코드를 한 번 더 확인합니다.</p>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/8 p-5">
              {twoFactor.qrDataUrl ? (
                <div className="rounded-2xl bg-white p-4">
                  <img src={twoFactor.qrDataUrl} alt="2FA QR 코드" className="mx-auto h-[220px] w-[220px]" />
                </div>
              ) : (
                <div className="flex h-[252px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5">
                  <div className="text-center">
                    <Smartphone className="mx-auto h-10 w-10 text-blue-200" />
                    <div className="mt-4 text-sm font-bold text-white">2FA 인증 대기</div>
                    <div className="mt-1 text-xs text-slate-400">비밀번호 확인 후 QR 또는 코드 입력창이 표시됩니다.</div>
                  </div>
                </div>
              )}
              {twoFactor.setupRequired ? (
                <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-xs leading-5 text-slate-300">
                  Google Authenticator, Microsoft Authenticator 등으로 QR을 스캔한 뒤 6자리 코드를 입력하세요.
                  {twoFactor.manualSecret ? <div className="mt-2 break-all font-mono text-blue-100">{twoFactor.manualSecret}</div> : null}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-xs leading-5 text-slate-300">
                  등록된 인증앱에서 현재 6자리 코드를 확인해 입력하세요.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Secure Login</div>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">계정 인증</h2>

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
                      onChange={(event) => {
                        setLoginId(event.target.value)
                        setTwoFactor(EMPTY_TWO_FACTOR)
                        setOtpCode("")
                      }}
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
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setTwoFactor(EMPTY_TWO_FACTOR)
                        setOtpCode("")
                      }}
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

                {twoFactor.required ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">2FA 인증번호</span>
                    <div className="flex h-12 items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 focus-within:border-blue-400 focus-within:bg-white">
                      <KeyRound className="h-4 w-4 text-blue-500" />
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                        className="h-full w-full bg-transparent text-center font-mono text-[18px] tracking-[0.3em] text-slate-900 outline-none"
                        placeholder="000000"
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        aria-label="2FA 인증번호"
                      />
                    </div>
                  </label>
                ) : null}

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
                  {isSubmitting ? "확인 중..." : twoFactor.required ? "2FA 확인 후 로그인" : "다음"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
