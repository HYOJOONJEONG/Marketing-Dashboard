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
type SessionStateMutator = (state: AuthState, target: UserRecord) => void | Promise<void>

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

export function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(),
    path: "/",
    expires,
  }
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

export async function createUserSessionWithStateUpdate(
  user: UserRecord,
  requestMeta: { ipAddress: string; userAgent: string },
  mutateState?: SessionStateMutator,
  baseState?: AuthState,
) {
  const now = new Date()
  const sessionId = `sess-${crypto.randomUUID()}`
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()

  await updateAuthState(async (state) => {
    const target = findUserById(state, user.id)
    if (!target) throw new Error("세션을 생성할 사용자를 찾을 수 없습니다.")
    if (mutateState) {
      await mutateState(state, target)
    }
    pruneExpiredSessions(state)
    state.userSessions.unshift({
      id: sessionId,
      userId: target.id,
      sessionToken,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })
    appendActivityLog(state, {
      actorUserId: target.id,
      actorName: target.name,
      actionType: "login",
      targetType: "session",
      targetId: sessionId,
      pageKey: "login",
      beforeValue: "",
      afterValue: JSON.stringify({ role: target.role, teamId: target.teamId }),
      ipAddress: requestMeta.ipAddress,
      sessionId,
      success: true,
    })
  }, { preserveConcurrentSessions: false, baseState })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, pack(sessionId), getSessionCookieOptions(new Date(expiresAt)))

  return sessionId
}

export async function createUserSession(user: UserRecord, requestMeta: { ipAddress: string; userAgent: string }) {
  return createUserSessionWithStateUpdate(user, requestMeta)
}

export async function removeUserSessionRecord(sessionId?: string | null) {
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

export async function clearUserSession(sessionId?: string | null) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, "", getSessionCookieOptions(new Date(0)))
  await removeUserSessionRecord(sessionId)
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
