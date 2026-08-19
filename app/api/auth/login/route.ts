import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { validateCredentials } from "@/lib/auth/auth-service"
import { createUserSessionWithStateUpdate } from "@/lib/auth/session"
import { getRequestIp, getRequestUserAgent } from "@/lib/auth/server"
import { createTotpSecret, createTotpUri, verifyTotpCode } from "@/lib/auth/totp"
import { updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function buildTwoFactorPayload(loginId: string, secret: string, setup: boolean, error?: string) {
  const otpauthUrl = createTotpUri({ loginId, secret })
  const message = setup ? "인증앱 등록 후 6자리 코드를 입력해주세요." : "인증앱의 6자리 코드를 입력해주세요."
  let qrDataUrl: string | null = null
  let qrError = ""
  if (setup) {
    try {
      qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
        margin: 1,
        width: 220,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
    } catch (caught) {
      qrError = caught instanceof Error ? caught.message : "QR 생성 실패"
    }
  }
  return {
    ok: false,
    requiresTwoFactor: true,
    twoFactorSetupRequired: setup,
    twoFactorResetAvailable: true,
    message,
    error: error || "",
    qrDataUrl,
    manualSecret: setup ? secret : null,
    qrError,
    issuedAt: new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 })
  }

  const loginId = String(body?.loginId || "").trim()
  const password = String(body?.password || "")
  const otpCode = String(body?.otpCode || "").replace(/\D/g, "").slice(0, 6)
  const resetTwoFactor = Boolean(body?.resetTwoFactor)
  const requestStartedAt = Date.now()
  const timing: Record<string, number> = {}
  if (!loginId || !password) {
    return NextResponse.json({ ok: false, error: "이름(ID)과 비밀번호를 입력해주세요." }, { status: 400 })
  }

  const result = await validateCredentials(loginId, password)
  timing.credentialsMs = Date.now() - requestStartedAt
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
  }

  let twoFactorSecret = result.user.twoFactorSecret || ""
  const twoFactorEnabled = Boolean(result.user.twoFactorEnabled)

  if (resetTwoFactor) {
    twoFactorSecret = createTotpSecret()
    const resetAt = new Date().toISOString()
    await updateAuthState((state) => {
      const target = state.users.find((user) => user.id === result.user.id)
      if (!target) return
      target.twoFactorSecret = twoFactorSecret
      target.twoFactorEnabled = false
      target.twoFactorConfirmedAt = null
      target.updatedAt = resetAt
      state.userSessions = state.userSessions.filter((session) => session.userId !== target.id)
      state.presenceSessions = state.presenceSessions.filter((session) => session.userId !== target.id)
    }, { preserveConcurrentSessions: false })
    const payload = await buildTwoFactorPayload(
      result.user.loginId || result.user.name,
      twoFactorSecret,
      true,
    )
    return NextResponse.json({
      ...payload,
      message: "새 QR을 발급했습니다. 인증앱에 새로 등록한 뒤 6자리 코드를 입력해주세요.",
    })
  }

  if (!twoFactorSecret) {
    twoFactorSecret = createTotpSecret()
    await updateAuthState((state) => {
      const target = state.users.find((user) => user.id === result.user.id)
      if (!target) return
      target.twoFactorSecret = twoFactorSecret
      target.twoFactorEnabled = false
      target.updatedAt = new Date().toISOString()
    }, { preserveConcurrentSessions: false })
  }

  if (!twoFactorEnabled) {
    if (!otpCode) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, true)
      return NextResponse.json(payload)
    }
    if (!verifyTotpCode(twoFactorSecret, otpCode)) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, true, "인증번호가 올바르지 않습니다.")
      return NextResponse.json(payload, { status: 401 })
    }
  } else {
    if (!otpCode) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, false)
      return NextResponse.json(payload)
    }
    if (!verifyTotpCode(twoFactorSecret, otpCode)) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, false, "인증번호가 올바르지 않습니다.")
      return NextResponse.json(payload, { status: 401 })
    }
  }

  await createUserSessionWithStateUpdate(
    result.user,
    {
      ipAddress: getRequestIp(request),
      userAgent: getRequestUserAgent(request),
    },
    !twoFactorEnabled
      ? (_state, target) => {
          const confirmedAt = new Date().toISOString()
          target.twoFactorSecret = twoFactorSecret
          target.twoFactorEnabled = true
          target.twoFactorConfirmedAt = confirmedAt
          target.updatedAt = confirmedAt
        }
      : undefined,
    result.state,
  )
  timing.sessionMs = Date.now() - requestStartedAt - timing.credentialsMs
  const elapsedMs = Date.now() - requestStartedAt
  if (elapsedMs > 2500) {
    console.warn("Slow auth login", {
      loginId: result.user.loginId || result.user.name,
      elapsedMs,
      ...timing,
    })
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/daily-report?view=daily-report",
    elapsedMs,
    user: {
      id: result.user.id,
      name: result.user.name,
      role: result.user.role,
      teamId: result.user.teamId,
    },
  })
}
