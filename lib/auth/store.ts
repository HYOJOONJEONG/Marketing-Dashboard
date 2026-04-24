import crypto from "crypto"
import {
  ACTION_KEYS,
  AuthState,
  MENU_KEYS,
  PresenceSessionRecord,
  RoleKey,
  TeamRecord,
  UserRecord,
  getUserColorToken,
} from "@/lib/auth/model"
import { readAuthSystem, writeAuthSystem } from "@/lib/shared-db-store"

const PRESENCE_TIMEOUT_MS = 45 * 1000

let authWriteQueue: Promise<void> = Promise.resolve()

function nowIso() {
  return new Date().toISOString()
}

function buildRolePermissionId(roleId: string, menuKey: string, action: string) {
  return `rp-${roleId}-${menuKey}-${action}`
}

function buildPermissionId(menuKey: string, action: string) {
  return `perm-${menuKey}-${action}`
}

function buildUserId(name: string) {
  return `user-${name}`
}

function normalizeIdentityValue(value: string) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase()
}

const USER_TITLE_BY_NAME: Record<string, string> = {
  신무길: "팀장",
  이홍민: "부장",
  정효준: "과장",
  조홍희: "대리",
  정진영: "사원",
  박혜리: "사원",
  윤옥수: "팀장",
  진효정: "과장",
  김다빈: "사원",
  박대일: "사원",
  김대일: "사원",
  이상철: "본부장",
}

const DEFAULT_DIRECTORY_USERS = [
  { name: "신무길", team: "인포Biz1팀", role: "team_manager" as RoleKey },
  { name: "이홍민", team: "인포Biz1팀", role: "staff" as RoleKey },
  { name: "정효준", team: "인포Biz1팀", role: "staff" as RoleKey },
  { name: "조홍희", team: "인포Biz1팀", role: "staff" as RoleKey },
  { name: "정진영", team: "인포Biz1팀", role: "staff" as RoleKey },
  { name: "박혜리", team: "인포Biz1팀", role: "staff" as RoleKey },
  { name: "윤옥수", team: "인포Biz2팀", role: "team_manager" as RoleKey },
  { name: "진효정", team: "인포Biz2팀", role: "staff" as RoleKey },
  { name: "김다빈", team: "인포Biz2팀", role: "staff" as RoleKey },
  { name: "박대일", team: "인포Biz2팀", role: "staff" as RoleKey },
  { name: "이상철", team: "본부", role: "director" as RoleKey },
] as const

function getUserTitle(name: string, fallbackRole?: RoleKey) {
  return USER_TITLE_BY_NAME[String(name || "").trim()] || (
    fallbackRole === "director" ? "본부장" :
    fallbackRole === "team_manager" ? "팀장" :
    fallbackRole === "admin" ? "관리자" :
    "사원"
  )
}

function createSeedTeams(now: string): TeamRecord[] {
  return [
    { id: "team-infobiz1", code: "INFOBIZ1", name: "인포Biz1팀", createdAt: now, updatedAt: now },
    { id: "team-infobiz2", code: "INFOBIZ2", name: "인포Biz2팀", createdAt: now, updatedAt: now },
    { id: "team-hq", code: "HQ", name: "본부", createdAt: now, updatedAt: now },
  ]
}

function createSeedUsers(now: string, teams: TeamRecord[]): UserRecord[] {
  const teamIdByName = new Map(teams.map((team) => [team.name, team.id]))
  const seeded = DEFAULT_DIRECTORY_USERS.map((user) => ({
    id: buildUserId(user.name),
    loginId: user.name,
    name: user.name,
    title: getUserTitle(user.name, user.role),
    role: user.role,
    teamId: String(teamIdByName.get(user.team) || teams[0]?.id || ""),
    active: true,
    deletedAt: null,
    authStrategy: "common" as const,
    passwordHash: null,
    passwordSalt: null,
    createdAt: now,
      updatedAt: now,
    }))

  return seeded
}

function createSeedRoles() {
  return [
    { id: "role-admin", name: "admin" as RoleKey, description: "전체 시스템 관리자" },
    { id: "role-director", name: "director" as RoleKey, description: "본부장" },
    { id: "role-team-manager", name: "team_manager" as RoleKey, description: "팀장/중간 관리자" },
    { id: "role-staff", name: "staff" as RoleKey, description: "일반 사용자" },
    { id: "role-viewer", name: "viewer" as RoleKey, description: "조회 전용" },
  ]
}

function buildBaselinePermissions(roleName: RoleKey) {
  // For the current rollout, every seeded role starts with full menu access.
  const allowAll = true
  return MENU_KEYS.flatMap((menuKey) =>
    ACTION_KEYS.map((action) => {
      if (allowAll) return { menuKey, action, allowed: true }
      const allowed =
        roleName === "director"
          ? (() => {
              if (menuKey === "adminPage" && action === "view") return true
              if (menuKey === "dashboard" && ["view", "edit"].includes(action)) return true
              if (menuKey === "newContractsList" && ["view", "edit", "approve"].includes(action)) return true
              if (menuKey === "newContractCreate" && ["view", "create"].includes(action)) return true
              if (menuKey === "contractManagement" && ["view", "create", "edit", "approve"].includes(action)) return true
              if (menuKey === "activityLog" && action === "view") return true
              if (menuKey === "permissionAuditLog" && action === "view") return true
              return false
            })()
          : roleName === "team_manager"
            ? (() => {
                if (menuKey === "dashboard" && ["view"].includes(action)) return true
                if (menuKey === "newContractsList" && ["view", "edit"].includes(action)) return true
                if (menuKey === "newContractCreate" && ["view", "create"].includes(action)) return true
                if (menuKey === "contractManagement" && ["view", "edit", "approve"].includes(action)) return true
                return false
              })()
            : roleName === "staff"
              ? (() => {
                  if (menuKey === "newContractsList" && action === "view") return true
                  if (menuKey === "newContractCreate" && ["view", "create"].includes(action)) return true
                  return false
                })()
              : (() => {
                  if (menuKey === "dashboard" && action === "view") return true
                  if (menuKey === "newContractsList" && action === "view") return true
                  if (menuKey === "activityLog" && action === "view") return true
                  return false
                })()
      return { menuKey, action, allowed }
    }),
  )
}

function createSeedState(): AuthState {
  const now = nowIso()
  const teams = createSeedTeams(now)
  const roles = createSeedRoles()
  const users = createSeedUsers(now, teams)
  const permissions = MENU_KEYS.flatMap((menuKey) =>
    ACTION_KEYS.map((action) => ({
      id: buildPermissionId(menuKey, action),
      menuKey,
      action,
      description: `${menuKey}.${action}`,
    })),
  )
  const rolePermissions = roles.flatMap((role) =>
    buildBaselinePermissions(role.name).map((permission) => ({
      id: buildRolePermissionId(role.id, permission.menuKey, permission.action),
      roleId: role.id,
      menuKey: permission.menuKey,
      action: permission.action,
      allowed: permission.allowed,
    })),
  )

  return {
    version: 1,
    teams,
    roles,
    permissions,
    rolePermissions,
    userPermissionOverrides: [
      {
        id: "uov-director-user-management-view",
        userId: buildUserId("이상철"),
        menuKey: "userManagement",
        action: "view",
        allowed: true,
      },
      {
        id: "uov-director-team-management-view",
        userId: buildUserId("이상철"),
        menuKey: "teamManagement",
        action: "view",
        allowed: true,
      },
    ],
    users,
    userSessions: [],
    presenceSessions: [],
    activityLogs: [],
    permissionChangeLogs: [],
    userChangeLogs: [],
  }
}

function normalizeFullAccessRolePermissions(state: AuthState) {
  const expectedPermissions = state.roles.flatMap((role) =>
    MENU_KEYS.flatMap((menuKey) =>
      ACTION_KEYS.map((action) => ({
        id: buildRolePermissionId(role.id, menuKey, action),
        roleId: role.id,
        menuKey,
        action,
        allowed: true,
      })),
    ),
  )
  state.rolePermissions = expectedPermissions
}

function normalizeUserTitles(state: AuthState) {
  state.users = state.users.map((user) => ({
    ...user,
    title: user.title || getUserTitle(user.name, user.role),
  }))
}

function normalizeLegacyAdminAccount(state: AuthState) {
  const removedUserIds = new Set(
    state.users
      .filter(
        (user) =>
          user.id === "user-admin-primary" ||
          user.name === "시스템관리자" ||
          user.authStrategy === "admin",
      )
      .map((user) => user.id),
  )

  if (!removedUserIds.size) return

  state.users = state.users.filter((user) => !removedUserIds.has(user.id))
  state.userSessions = state.userSessions.filter((session) => !removedUserIds.has(session.userId))
  state.presenceSessions = state.presenceSessions.filter((session) => !removedUserIds.has(session.userId))
  state.userPermissionOverrides = state.userPermissionOverrides.filter((item) => !removedUserIds.has(item.userId))
}

function normalizeRequiredDirectoryUsers(state: AuthState) {
  const now = nowIso()
  const teamIdByName = new Map(state.teams.map((team) => [team.name, team.id]))

  DEFAULT_DIRECTORY_USERS.forEach((seedUser) => {
    const teamId = String(teamIdByName.get(seedUser.team) || state.teams[0]?.id || "")
    const existing =
      state.users.find((user) => user.id === buildUserId(seedUser.name)) ||
      state.users.find((user) => user.loginId === seedUser.name) ||
      state.users.find((user) => user.name === seedUser.name)

    if (existing) {
      if (existing.deletedAt) {
        return
      }
      existing.id = buildUserId(seedUser.name)
      existing.loginId = seedUser.name
      existing.name = seedUser.name
      existing.role = seedUser.role
      existing.teamId = teamId
      existing.title = getUserTitle(seedUser.name, seedUser.role)
      existing.active = true
      existing.deletedAt = null
      existing.authStrategy = "common"
      existing.passwordHash = null
      existing.passwordSalt = null
      existing.updatedAt = now
      return
    }

    state.users.unshift({
      id: buildUserId(seedUser.name),
      loginId: seedUser.name,
      name: seedUser.name,
      title: getUserTitle(seedUser.name, seedUser.role),
      role: seedUser.role,
      teamId,
      active: true,
      deletedAt: null,
      authStrategy: "common",
      passwordHash: null,
      passwordSalt: null,
      createdAt: now,
      updatedAt: now,
    })
  })
}

export async function readAuthState(): Promise<AuthState> {
  try {
    const parsed = await readAuthSystem<AuthState>()
    if (parsed?.users) {
      normalizeFullAccessRolePermissions(parsed)
      normalizeLegacyAdminAccount(parsed)
      normalizeRequiredDirectoryUsers(parsed)
      normalizeUserTitles(parsed)
      return parsed
    }
    const seeded = createSeedState()
    try {
      await writeAuthSystem(seeded, {
        menuLabel: "Auth",
        changeLabel: "Seed auth system",
      })
    } catch {
      // In read-only fallback environments, keep serving the seeded state
      // so login can still work if writes are unavailable.
    }
    return seeded
  } catch {
    return createSeedState()
  }
}

async function writeAuthState(state: AuthState) {
  await writeAuthSystem(state, {
    menuLabel: "Auth",
    changeLabel: "Persist auth state",
  })
}

export async function updateAuthState(mutator: (draft: AuthState) => void | Promise<void>) {
  let nextState: AuthState | null = null
  authWriteQueue = authWriteQueue.then(async () => {
    const current = await readAuthState()
    const draft = JSON.parse(JSON.stringify(current)) as AuthState
    await mutator(draft)
    nextState = draft
    await writeAuthState(draft)
  })
  await authWriteQueue
  return nextState as AuthState
}

export function getRoleIdByName(state: AuthState, roleName: RoleKey) {
  return state.roles.find((role) => role.name === roleName)?.id || ""
}

export function createIndividualPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return { salt, hash }
}

export function verifyPasswordHash(password: string, salt?: string | null, hash?: string | null) {
  if (!salt || !hash) return false
  const computed = crypto.scryptSync(password, salt, 64).toString("hex")
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))
}

export function cleanupPresenceSessions(state: AuthState) {
  const threshold = Date.now() - PRESENCE_TIMEOUT_MS
  state.presenceSessions = state.presenceSessions.map((session) => {
    const lastSeen = new Date(session.lastSeenAt).getTime()
    if (!Number.isFinite(lastSeen) || lastSeen < threshold) {
      return {
        ...session,
        status: "offline",
        updatedAt: nowIso(),
      }
    }
    return session
  })
}

export function listOnlinePresence(state: AuthState) {
  cleanupPresenceSessions(state)
  const usersById = new Map(state.users.map((user) => [user.id, user]))
  return state.presenceSessions
    .filter((session) => session.status !== "offline")
    .map((session) => {
      const user = usersById.get(session.userId)
      const color = getUserColorToken(session.userId)
      return {
        ...session,
        userName: user?.name || "알 수 없음",
        role: user?.role || "viewer",
        teamId: user?.teamId || "",
        color,
      }
    })
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
}

export function appendActivityLog(
  state: AuthState,
  payload: Omit<AuthState["activityLogs"][number], "id" | "createdAt"> & { createdAt?: string },
) {
  const now = payload.createdAt || nowIso()
  state.activityLogs.unshift({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ...payload,
  })
  state.activityLogs = state.activityLogs.slice(0, 500)
}

export function appendUserChangeLog(
  state: AuthState,
  payload: Omit<AuthState["userChangeLogs"][number], "id" | "changedAt"> & { changedAt?: string },
) {
  state.userChangeLogs.unshift({
    id: `userchg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    changedAt: payload.changedAt || nowIso(),
    ...payload,
  })
  state.userChangeLogs = state.userChangeLogs.slice(0, 500)
}

export function appendPermissionChangeLog(
  state: AuthState,
  payload: Omit<AuthState["permissionChangeLogs"][number], "id" | "changedAt"> & { changedAt?: string },
) {
  state.permissionChangeLogs.unshift({
    id: `permchg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    changedAt: payload.changedAt || nowIso(),
    ...payload,
  })
  state.permissionChangeLogs = state.permissionChangeLogs.slice(0, 500)
}

export function findUserByLoginId(state: AuthState, loginId: string) {
  const normalizedLoginId = normalizeIdentityValue(loginId)
  return state.users.find((user) => {
    if (user.deletedAt) return false
    return (
      normalizeIdentityValue(user.loginId) === normalizedLoginId ||
      normalizeIdentityValue(user.name) === normalizedLoginId
    )
  })
}

export function findUserById(state: AuthState, userId: string) {
  return state.users.find((user) => user.id === userId && !user.deletedAt)
}

export function getTeamName(state: AuthState, teamId: string) {
  return state.teams.find((team) => team.id === teamId)?.name || ""
}

export function toSafeUser(user: UserRecord, state: AuthState) {
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    title: user.title || getUserTitle(user.name, user.role),
    role: user.role,
    teamId: user.teamId,
    teamName: getTeamName(state, user.teamId),
    active: user.active,
    deletedAt: user.deletedAt,
    authStrategy: user.authStrategy,
    color: getUserColorToken(user.id),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function pruneExpiredSessions(state: AuthState) {
  const now = Date.now()
  state.userSessions = state.userSessions.filter((session) => {
    const expires = new Date(session.expiresAt).getTime()
    return Number.isFinite(expires) && expires > now
  })
}

export function upsertPresenceSession(
  state: AuthState,
  payload: Pick<PresenceSessionRecord, "userId" | "connectionId" | "sessionId" | "currentPage" | "currentSection"> & {
    status?: PresenceSessionRecord["status"]
  },
) {
  cleanupPresenceSessions(state)
  const existing = state.presenceSessions.find(
    (session) => session.connectionId === payload.connectionId || session.sessionId === payload.sessionId,
  )
  const now = nowIso()
  const nextStatus =
    payload.status || (payload.currentSection.toLowerCase().includes("edit") ? "editing" : "online")

  if (existing) {
    existing.currentPage = payload.currentPage
    existing.currentSection = payload.currentSection
    existing.status = nextStatus
    existing.lastSeenAt = now
    existing.updatedAt = now
    return existing
  }

  const created: PresenceSessionRecord = {
    id: `presence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: payload.userId,
    status: nextStatus,
    currentPage: payload.currentPage,
    currentSection: payload.currentSection,
    colorToken: getUserColorToken(payload.userId).token,
    lastSeenAt: now,
    connectionId: payload.connectionId,
    sessionId: payload.sessionId,
    createdAt: now,
    updatedAt: now,
  }
  state.presenceSessions.unshift(created)
  state.presenceSessions = state.presenceSessions.slice(0, 200)
  return created
}
