"use client"

import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, Smartphone, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type TwoFactorState = {
  required: boolean
  setupRequired: boolean
  qrDataUrl: string | null
  manualSecret: string | null
  resetAvailable: boolean
  issuedAt: string | null
}

const EMPTY_TWO_FACTOR: TwoFactorState = {
  required: false,
  setupRequired: false,
  qrDataUrl: null,
  manualSecret: null,
  resetAvailable: false,
  issuedAt: null,
}

export function LoginPage() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const otpInputRef = useRef<HTMLInputElement | null>(null)
  const submittedOtpRef = useRef("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [twoFactor, setTwoFactor] = useState<TwoFactorState>(EMPTY_TWO_FACTOR)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!twoFactor.required) return
    otpInputRef.current?.focus()
  }, [twoFactor.required])

  useEffect(() => {
    if (!twoFactor.required || isSubmitting || isRedirecting || otpCode.length !== 6) return
    if (submittedOtpRef.current === otpCode) return
    submittedOtpRef.current = otpCode
    formRef.current?.requestSubmit()
  }, [isRedirecting, isSubmitting, otpCode, twoFactor.required])

  const submitLogin = async (resetTwoFactor = false) => {
    if (isSubmitting || isRedirecting) return

    setError("")
    setNotice("")
    setIsSubmitting(true)
    if (resetTwoFactor) {
      setOtpCode("")
      submittedOtpRef.current = ""
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 20000)
    let keepPending = false

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId, password, otpCode: resetTwoFactor ? "" : otpCode, resetTwoFactor }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (payload?.requiresTwoFactor) {
        if (payload.twoFactorSetupRequired) {
          submittedOtpRef.current = ""
        }
        setTwoFactor({
          required: true,
          setupRequired: Boolean(payload.twoFactorSetupRequired),
          qrDataUrl: payload.qrDataUrl || null,
          manualSecret: payload.manualSecret || null,
          resetAvailable: Boolean(payload.twoFactorResetAvailable ?? true),
          issuedAt: payload.issuedAt || null,
        })
        if (response.ok) {
          setNotice(payload?.message || "인증앱의 6자리 코드를 입력해주세요.")
          setError("")
        } else {
          setNotice("")
          setError(payload?.error || "인증번호가 올바르지 않습니다.")
        }
        return
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "로그인에 실패했습니다.")
        return
      }
      keepPending = true
      setIsRedirecting(true)
      setNotice("대시보드로 이동 중입니다.")
      window.location.replace("/daily-report")
    } catch (loginError) {
      setIsRedirecting(false)
      setError(
        loginError instanceof DOMException && loginError.name === "AbortError"
          ? "로그인 응답이 지연되고 있습니다. 서버 상태를 확인한 뒤 다시 시도해주세요."
          : "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      )
    } finally {
      window.clearTimeout(timeoutId)
      if (!keepPending) {
        setIsSubmitting(false)
      }
    }
  }

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitLogin(false)
  }

  const requestTwoFactorReset = () => {
    if (isSubmitting || isRedirecting) return
    const confirmed = window.confirm("새 QR을 발급할까요? 기존 인증앱 코드는 폐기되고, 새 QR 등록 후 6자리 코드를 입력해야 로그인됩니다.")
    if (!confirmed) return
    void submitLogin(true)
  }

  const isEnteringDashboard = isRedirecting || (isSubmitting && twoFactor.required && otpCode.length === 6)
  const submitLabel = isEnteringDashboard ? "대시보드 들어가는 중..." : isSubmitting ? "확인 중..." : twoFactor.required ? "2FA 확인 후 로그인" : "다음"

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
                  <div>Google Authenticator, Microsoft Authenticator 등으로 QR을 스캔한 뒤 6자리 코드를 입력하세요.</div>
                  {twoFactor.issuedAt ? <div className="mt-1 text-slate-400">발급시각 {new Date(twoFactor.issuedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div> : null}
                  {twoFactor.manualSecret ? (
                    <div className="mt-2 rounded-xl bg-white/8 px-3 py-2">
                      <div className="font-semibold text-slate-400">QR이 안 잡히면 수동 입력키</div>
                      <div className="mt-1 break-all font-mono text-blue-100">{twoFactor.manualSecret}</div>
                    </div>
                  ) : null}
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

              <form ref={formRef} className="mt-8 space-y-5" onSubmit={handleLogin}>
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
                        setNotice("")
                        setError("")
                        setIsRedirecting(false)
                        submittedOtpRef.current = ""
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
                        setNotice("")
                        setError("")
                        setIsRedirecting(false)
                        submittedOtpRef.current = ""
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="block text-sm font-semibold text-slate-700">2FA 인증번호</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                        6자리 입력 시 자동 확인
                      </span>
                    </div>
                    <div className="flex h-[52px] items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 shadow-[0_10px_26px_rgba(37,99,235,0.08)] focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                      <KeyRound className="h-4 w-4 text-blue-500" />
                      <input
                        ref={otpInputRef}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                        className="h-full w-full bg-transparent text-center font-mono text-[20px] font-black tracking-[0.38em] text-slate-950 outline-none"
                        placeholder="000000"
                        value={otpCode}
                        onChange={(event) => {
                          const nextCode = event.target.value.replace(/\D/g, "").slice(0, 6)
                          setOtpCode(nextCode)
                          setError("")
                          setNotice("")
                          setIsRedirecting(false)
                          if (nextCode.length < 6) submittedOtpRef.current = ""
                        }}
                        aria-label="2FA 인증번호"
                      />
                    </div>
                    {twoFactor.resetAvailable ? (
                      <button
                        type="button"
                        onClick={requestTwoFactorReset}
                        disabled={isSubmitting || isRedirecting}
                        className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                      >
                        {twoFactor.setupRequired ? "새 QR 다시 발급" : "인증앱 재등록 / 새 QR 발급"}
                      </button>
                    ) : null}
                  </label>
                ) : null}

                {notice ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700" role="status">
                    {notice}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting || isRedirecting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-[15px] font-bold text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-85"
                >
                  {isSubmitting || isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
