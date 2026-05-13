import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { validateCredentials } from "@/lib/auth/auth-service"
import { createUserSession } from "@/lib/auth/session"
import { getRequestIp, getRequestUserAgent } from "@/lib/auth/server"
import { createTotpSecret, createTotpUri, verifyTotpCode } from "@/lib/auth/totp"
import { updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function buildTwoFactorPayload(loginId: string, secret: string, setup: boolean, error?: string) {
  const otpauthUrl = createTotpUri({ loginId, secret })
  const qrDataUrl = setup
    ? await QRCode.toDataURL(otpauthUrl, {
        margin: 1,
        width: 220,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
    : null
  return {
    ok: false,
    requiresTwoFactor: true,
    twoFactorSetupRequired: setup,
    error: error || (setup ? "인증앱 등록 후 6자리 코드를 입력해주세요." : "인증앱의 6자리 코드를 입력해주세요."),
    qrDataUrl,
    manualSecret: setup ? secret : null,
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
  const otpCode = String(body?.otpCode || "").trim()
  if (!loginId || !password) {
    return NextResponse.json({ ok: false, error: "이름(ID)과 비밀번호를 입력해주세요." }, { status: 400 })
  }

  const result = await validateCredentials(loginId, password)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
  }

  let twoFactorSecret = result.user.twoFactorSecret || ""
  const twoFactorEnabled = Boolean(result.user.twoFactorEnabled)

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
      return NextResponse.json(payload, { status: 401 })
    }
    if (!verifyTotpCode(twoFactorSecret, otpCode)) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, true, "인증번호가 올바르지 않습니다.")
      return NextResponse.json(payload, { status: 401 })
    }
    await updateAuthState((state) => {
      const target = state.users.find((user) => user.id === result.user.id)
      if (!target) return
      target.twoFactorSecret = twoFactorSecret
      target.twoFactorEnabled = true
      target.twoFactorConfirmedAt = new Date().toISOString()
      target.updatedAt = target.twoFactorConfirmedAt
    }, { preserveConcurrentSessions: false })
  } else {
    if (!otpCode) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, false)
      return NextResponse.json(payload, { status: 401 })
    }
    if (!verifyTotpCode(twoFactorSecret, otpCode)) {
      const payload = await buildTwoFactorPayload(result.user.loginId || result.user.name, twoFactorSecret, false, "인증번호가 올바르지 않습니다.")
      return NextResponse.json(payload, { status: 401 })
    }
  }

  await createUserSession(result.user, {
    ipAddress: getRequestIp(request),
    userAgent: getRequestUserAgent(request),
  })

  return NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      role: result.user.role,
      teamId: result.user.teamId,
    },
  })
}
