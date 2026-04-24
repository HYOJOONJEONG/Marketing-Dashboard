import { UserRecord } from "@/lib/auth/model"
import { findUserByLoginId, readAuthState, verifyPasswordHash } from "@/lib/auth/store"

export function getCommonPassword() {
  return process.env.INFOBIZ_COMMON_PASSWORD?.trim() || ""
}

export function getAdminPassword() {
  return process.env.INFOBIZ_ADMIN_PASSWORD?.trim() || ""
}

export async function validateCredentials(loginId: string, password: string) {
  const state = await readAuthState()
  const user = findUserByLoginId(state, loginId)
  if (!user || !user.active) {
    return { ok: false as const, error: "존재하지 않거나 비활성화된 계정입니다." }
  }

  const valid = verifyPasswordForUser(user, password)
  if (!valid.ok) {
    return { ok: false as const, error: valid.error }
  }

  return { ok: true as const, user, state }
}

export function verifyPasswordForUser(user: UserRecord, password: string) {
  if (!password) return { ok: false as const, error: "비밀번호를 입력해주세요." }
  if (user.authStrategy === "individual") {
    const matched = verifyPasswordHash(password, user.passwordSalt, user.passwordHash)
    return matched
      ? { ok: true as const }
      : { ok: false as const, error: "비밀번호가 올바르지 않습니다." }
  }

  if (user.authStrategy === "admin") {
    const adminPassword = getAdminPassword()
    if (!adminPassword) {
      return { ok: false as const, error: "INFOBIZ_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다." }
    }
    return password === adminPassword
      ? { ok: true as const }
      : { ok: false as const, error: "관리자 비밀번호가 올바르지 않습니다." }
  }

  const commonPassword = getCommonPassword()
  if (!commonPassword) {
    return { ok: false as const, error: "INFOBIZ_COMMON_PASSWORD 환경변수가 설정되지 않았습니다." }
  }
  return password === commonPassword
    ? { ok: true as const }
    : { ok: false as const, error: "비밀번호가 올바르지 않습니다." }
}
