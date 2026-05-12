import crypto from "crypto"
import { cookies } from "next/headers"
import { AuthState, UserRecord } from "@/lib/auth/model"
import {
  appendActivityLog,
  findUserById,
  pruneExpiredSessions,
  readAuthState,
  updateAuthState,
} from "@/lib/auth/store"

const SESSION_COOKIE = "infobiz_session"
const SESSION_TTL_MS = 1000 * 60 * 60 * 12
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET?.trim() || "local-dev-session-secret"

function readBooleanEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return null
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return null
}

function shouldUseSecureCookie() {
  const override = readBooleanEnv(process.env.AUTH_COOKIE_SECURE)
  if (override !== null) return override

  // Vercel is always HTTPS, while a self-hosted production server is often
  // tested through http://IP:PORT. A Secure cookie on plain HTTP is ignored by
  // browsers, which makes login appear to fail even when credentials are valid.
  return process.env.VERCEL === "1"
}

function sign(value: string) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex")
}

function pack(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`
}

function unpack(cookieValue: string | undefined | null) {
  if (!cookieValue) return null
  const [sessionId, signature] = String(cookieValue).split(".")
  if (!sessionId || !signature) return null
  const expected = sign(sessionId)
  if (signature.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return sessionId
}

export async function createUserSession(user: UserRecord, requestMeta: { ipAddress: string; userAgent: string }) {
  const now = new Date()
  const sessionId = `sess-${crypto.randomUUID()}`
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()

  await updateAuthState((state) => {
    pruneExpiredSessions(state)
    state.userSessions.unshift({
      id: sessionId,
      userId: user.id,
      sessionToken,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })
    appendActivityLog(state, {
      actorUserId: user.id,
      actorName: user.name,
      actionType: "login",
      targetType: "session",
      targetId: sessionId,
      pageKey: "login",
      beforeValue: "",
      afterValue: JSON.stringify({ role: user.role, teamId: user.teamId }),
      ipAddress: requestMeta.ipAddress,
      sessionId,
      success: true,
    })
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, pack(sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    expires: new Date(expiresAt),
  })

  return sessionId
}

export async function clearUserSession(sessionId?: string | null) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    expires: new Date(0),
  })

  if (!sessionId) return
  await updateAuthState((state) => {
    const existing = state.userSessions.find((session) => session.id === sessionId)
    if (!existing) return
    const user = findUserById(state, existing.userId)
    state.userSessions = state.userSessions.filter((session) => session.id !== sessionId)
    state.presenceSessions = state.presenceSessions.filter((presence) => presence.sessionId !== sessionId)
    if (user) {
      appendActivityLog(state, {
        actorUserId: user.id,
        actorName: user.name,
        actionType: "logout",
        targetType: "session",
        targetId: sessionId,
        pageKey: "logout",
        beforeValue: "",
        afterValue: "",
        ipAddress: existing.ipAddress,
        sessionId,
        success: true,
      })
    }
  }, { preserveConcurrentSessions: false })
}

export async function resolveRequestSession() {
  const cookieStore = await cookies()
  const sessionId = unpack(cookieStore.get(SESSION_COOKIE)?.value)
  if (!sessionId) return null

  const state = await readAuthState()
  pruneExpiredSessions(state)
  const session = state.userSessions.find((item) => item.id === sessionId)
  if (!session) return null
  const user = findUserById(state, session.userId)
  if (!user || !user.active) return null
  if (!user.twoFactorEnabled) return null

  return {
    sessionId,
    session,
    user,
    state,
  }
}

export async function getRequestCookieSessionId() {
  const cookieStore = await cookies()
  return unpack(cookieStore.get(SESSION_COOKIE)?.value)
}

export function getSessionCookieName() {
  return SESSION_COOKIE
}
