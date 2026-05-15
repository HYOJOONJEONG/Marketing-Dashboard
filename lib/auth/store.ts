import crypto from "crypto"
import {
  ACTION_KEYS,
  AuthState,
  MENU_KEYS,
  PresenceSessionRecord,
  RoleKey,
  TeamRecord,
  UserTestIdEntry,
  PopupMessageRecord,
  UserRecord,
  getUserColorToken,
} from "@/lib/auth/model"
import { normalizeAssignedIndustries } from "@/lib/industry-groups"
import { isSharedDbSeedingAllowed, readAuthSystem, writeAuthSystem } from "@/lib/shared-db-store"

const PRESENCE_TIMEOUT_MS = 120 * 1000
const PRESENCE_IDLE_MS = 7 * 60 * 1000

let authWriteQueue: Promise<void> = Promise.resolve()

function nowIso() {
  return new Date().toISOString()
}

function toTimestamp(value: string | null | undefined) {
  const timestamp = new Date(String(value || "")).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function resolvePresenceStatus(session: PresenceSessionRecord, now = Date.now()): PresenceSessionRecord["status"] {
  const lastSeen = toTimestamp(session.lastSeenAt)
  if (!lastSeen || lastSeen < now - PRESENCE_TIMEOUT_MS) {
    return "offline"
  }
  if (session.manualStatus === "away") {
    return "away"
  }
  const lastActivity = toTimestamp(session.lastActivityAt || session.lastSeenAt)
  if (!lastActivity || lastActivity < now - PRESENCE_IDLE_MS) {
    return "away"
  }
  return "online"
}

function presenceRank(status: PresenceSessionRecord["status"]) {
  if (status === "online") return 0
  if (status === "away") return 1
  return 2
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

function normalizeTestIdEntries(entries: unknown): UserTestIdEntry[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => {
      const testId = String((entry as any)?.testId || "").trim().toUpperCase()
      if (!testId) return null
      return {
        id: String((entry as any)?.id || `test-id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim(),
        testId,
        companyName: String((entry as any)?.companyName || "").trim(),
        departmentName: String((entry as any)?.departmentName || "").trim(),
        assigneeName: String((entry as any)?.assigneeName || "").trim(),
        contact: String((entry as any)?.contact || "").trim(),
        note: String((entry as any)?.note || "").trim(),
        createdAt: String((entry as any)?.createdAt || nowIso()).trim(),
        updatedAt: String((entry as any)?.updatedAt || nowIso()).trim(),
      } satisfies UserTestIdEntry
    })
    .filter((entry): entry is UserTestIdEntry => Boolean(entry))
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
  { name: "김대일", team: "인포Biz2팀", role: "staff" as RoleKey },
  { name: "이상철", team: "본부", role: "director" as RoleKey },
] as const

const REQUIRED_TEAMS = [
  { id: "team-hq", code: "HQ", name: "본부", teamOrder: 1 },
  { id: "team-infobiz1", code: "INFOBIZ1", name: "인포Biz1팀", teamOrder: 2 },
  { id: "team-infobiz2", code: "INFOBIZ2", name: "인포Biz2팀", teamOrder: 3 },
  { id: "team-security", code: "SECURITY", name: "정보보안", teamOrder: 4 },
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
  return REQUIRED_TEAMS.map((team) => ({ ...team, createdAt: now, updatedAt: now }))
}

function createSeedUsers(now: string, teams: TeamRecord[]): UserRecord[] {
  const teamIdByName = new Map(teams.map((team) => [team.name, team.id]))
  const displayOrderByName: Record<string, number> = {
    이상철: 1,
    신무길: 1,
    이홍민: 2,
    정효준: 3,
    조홍희: 4,
    정진영: 5,
    박혜리: 6,
    윤옥수: 1,
    진효정: 2,
    김다빈: 3,
    김대일: 4,
  }
  const seeded = DEFAULT_DIRECTORY_USERS.map((user) => ({
    id: buildUserId(user.name),
    loginId: user.name,
    name: user.name,
    title: getUserTitle(user.name, user.role),
    avatarEmoji: null,
    assignedIndustries: [],
    testIdEntries: [],
    displayOrder: displayOrderByName[user.name] || 99,
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
    popupMessages: [],
    activityLogs: [],
    permissionChangeLogs: [],
    userChangeLogs: [],
  }
}

function normalizeRequiredTeams(state: AuthState) {
  const now = nowIso()
  const teams = Array.isArray(state.teams) ? state.teams : []
  REQUIRED_TEAMS.forEach((requiredTeam) => {
    const existing = teams.find((team) => team.id === requiredTeam.id || team.name === requiredTeam.name || team.code === requiredTeam.code)
    if (existing) {
      existing.code = existing.code || requiredTeam.code
      existing.name = existing.name || requiredTeam.name
      existing.teamOrder = Number(existing.teamOrder ?? requiredTeam.teamOrder)
      existing.updatedAt = existing.updatedAt || now
      return
    }
    teams.push({
      ...requiredTeam,
      createdAt: now,
      updatedAt: now,
    })
  })
  state.teams = teams
}

function normalizeTeamOrders(state: AuthState) {
  const teamOrderByName = Object.fromEntries(REQUIRED_TEAMS.map((team) => [team.name, team.teamOrder]))
  state.teams = state.teams.map((team) => ({
    ...team,
    teamOrder: Number(team.teamOrder ?? teamOrderByName[team.name] ?? 99),
  }))
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
  const teamMap = new Map(state.teams.map((team) => [team.id, team.name]))
  const displayOrderByName: Record<string, number> = {
    이상철: 1,
    신무길: 1,
    이홍민: 2,
    정효준: 3,
    조홍희: 4,
    정진영: 5,
    박혜리: 6,
    윤옥수: 1,
    진효정: 2,
    김다빈: 3,
    김대일: 4,
    기타: 5,
  }
  state.users = state.users.map((user) => ({
    ...user,
    title: user.title || getUserTitle(user.name, user.role),
    avatarEmoji: user.avatarEmoji ? String(user.avatarEmoji).trim() : null,
    assignedIndustries: normalizeAssignedIndustries(user.assignedIndustries),
    testIdEntries: normalizeTestIdEntries(user.testIdEntries),
    displayOrder: Number(user.displayOrder ?? displayOrderByName[user.name] ?? 99),
    teamId: user.teamId || String([...teamMap.keys()][0] || ""),
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
  const displayOrderByName: Record<string, number> = {
    이상철: 1,
    신무길: 1,
    이홍민: 2,
    정효준: 3,
    조홍희: 4,
    정진영: 5,
    박혜리: 6,
    윤옥수: 1,
    진효정: 2,
    김다빈: 3,
    김대일: 4,
  }

  const replaceUserReferences = (fromUserId: string, toUserId: string) => {
    if (!fromUserId || !toUserId || fromUserId === toUserId) return
    state.userSessions = (state.userSessions || []).map((session) =>
      session.userId === fromUserId ? { ...session, userId: toUserId } : session,
    )
    state.presenceSessions = (state.presenceSessions || []).map((session) =>
      session.userId === fromUserId ? { ...session, userId: toUserId } : session,
    )
    state.userPermissionOverrides = (state.userPermissionOverrides || []).map((item) =>
      item.userId === fromUserId ? { ...item, userId: toUserId } : item,
    )
    state.popupMessages = (state.popupMessages || []).map((message) => ({
      ...message,
      senderUserId: message.senderUserId === fromUserId ? toUserId : message.senderUserId,
      recipientUserId: message.recipientUserId === fromUserId ? toUserId : message.recipientUserId,
    }))
  }

  DEFAULT_DIRECTORY_USERS.forEach((seedUser) => {
    const canonicalId = buildUserId(seedUser.name)
    const teamId = String(teamIdByName.get(seedUser.team) || state.teams[0]?.id || "")
    const existing =
      state.users.find((user) => !user.deletedAt && user.id === canonicalId) ||
      state.users.find((user) => !user.deletedAt && user.loginId === seedUser.name) ||
      state.users.find((user) => !user.deletedAt && user.name === seedUser.name) ||
      state.users.find((user) => user.id === canonicalId) ||
      state.users.find((user) => user.loginId === seedUser.name) ||
      state.users.find((user) => user.name === seedUser.name)

    if (existing) {
      if (existing.deletedAt) {
        return
      }
      const previousId = existing.id
      if (previousId !== canonicalId) {
        state.users = state.users.filter(
          (user) => user === existing || !(user.id === canonicalId && user.deletedAt),
        )
        replaceUserReferences(previousId, canonicalId)
      }
      existing.id = canonicalId
      existing.loginId = seedUser.name
      existing.name = seedUser.name
      existing.role = seedUser.role
      existing.teamId = teamId
      existing.title = getUserTitle(seedUser.name, seedUser.role)
      existing.avatarEmoji = existing.avatarEmoji ? String(existing.avatarEmoji).trim() : null
      existing.displayOrder = displayOrderByName[seedUser.name] || 99
      existing.active = true
      existing.deletedAt = null
      existing.assignedIndustries = Array.isArray(existing.assignedIndustries)
        ? normalizeAssignedIndustries(existing.assignedIndustries)
        : []
      existing.testIdEntries = normalizeTestIdEntries(existing.testIdEntries)
      existing.updatedAt = now
      return
    }

    state.users.unshift({
      id: buildUserId(seedUser.name),
      loginId: seedUser.name,
      name: seedUser.name,
      title: getUserTitle(seedUser.name, seedUser.role),
      avatarEmoji: null,
      assignedIndustries: [],
      testIdEntries: [],
      displayOrder: displayOrderByName[seedUser.name] || 99,
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

function normalizePopupMessages(state: AuthState) {
  const now = Date.now()
  const activeUserIds = new Set((state.users || []).filter((user) => user.active && !user.deletedAt).map((user) => user.id))
  state.popupMessages = (Array.isArray((state as any).popupMessages) ? (state as any).popupMessages : [])
    .map((message: any) => ({
      id: String(message?.id || `popup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      senderUserId: String(message?.senderUserId || ""),
      senderName: String(message?.senderName || "시스템"),
      recipientUserId: String(message?.recipientUserId || ""),
      title: String(message?.title || "알림").slice(0, 80),
      body: String(message?.body || "").slice(0, 500),
      dedupeKey: message?.dedupeKey ? String(message.dedupeKey) : null,
      readAt: message?.readAt ? String(message.readAt) : null,
      createdAt: String(message?.createdAt || nowIso()),
      expiresAt: String(message?.expiresAt || new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()),
    }))
    .filter((message: PopupMessageRecord) => activeUserIds.has(message.recipientUserId) && toTimestamp(message.expiresAt) > now)
    .sort((a: PopupMessageRecord, b: PopupMessageRecord) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, 200)
}

export async function readAuthState(): Promise<AuthState> {
  try {
    const parsed = await readAuthSystem<AuthState>()
    if (parsed?.users) {
      normalizeRequiredTeams(parsed)
      normalizeTeamOrders(parsed)
      normalizeFullAccessRolePermissions(parsed)
      normalizeLegacyAdminAccount(parsed)
      normalizeRequiredDirectoryUsers(parsed)
      normalizeUserTitles(parsed)
      normalizePopupMessages(parsed)
      return parsed
    }
    if (!isSharedDbSeedingAllowed()) {
      throw new Error("Auth system is missing. Refusing to seed default users in this environment.")
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
  } catch (error) {
    if (!isSharedDbSeedingAllowed()) {
      throw error
    }
    return createSeedState()
  }
}

async function writeAuthState(state: AuthState) {
  await writeAuthSystem(state, {
    menuLabel: "Auth",
    changeLabel: "Persist auth state",
  })
}

function timestampValue(value?: string | null) {
  const time = new Date(String(value || "")).getTime()
  return Number.isFinite(time) ? time : 0
}

function mergeById<T extends { id: string; updatedAt?: string; createdAt?: string }>(base: T[], incoming: T[]) {
  const index = new Map<string, T>()
  ;[...base, ...incoming].forEach((item) => {
    const existing = index.get(item.id)
    if (!existing) {
      index.set(item.id, item)
      return
    }
    const existingTime = timestampValue(existing.updatedAt || existing.createdAt)
    const itemTime = timestampValue(item.updatedAt || item.createdAt)
    if (itemTime >= existingTime) index.set(item.id, item)
  })
  return Array.from(index.values())
}

function mergePopupMessages(base: PopupMessageRecord[], incoming: PopupMessageRecord[]) {
  const index = new Map<string, PopupMessageRecord>()
  ;[...base, ...incoming].forEach((message) => {
    const existing = index.get(message.id)
    if (!existing) {
      index.set(message.id, message)
      return
    }
    const existingTime = timestampValue(existing.createdAt)
    const messageTime = timestampValue(message.createdAt)
    const merged = messageTime >= existingTime ? { ...existing, ...message } : { ...message, ...existing }
    merged.readAt = existing.readAt || message.readAt || null
    index.set(message.id, merged)
  })
  return Array.from(index.values())
}

function preserveConcurrentSessionState(draft: AuthState, latest: AuthState) {
  const activeUserIds = new Set(draft.users.filter((user) => user.active && !user.deletedAt).map((user) => user.id))
  draft.userSessions = mergeById(draft.userSessions || [], latest.userSessions || []).filter((session) => {
    const expires = new Date(session.expiresAt).getTime()
    return activeUserIds.has(session.userId) && Number.isFinite(expires) && expires > Date.now()
  })
  const sessionIds = new Set(draft.userSessions.map((session) => session.id))
  draft.presenceSessions = mergeById(draft.presenceSessions || [], latest.presenceSessions || []).filter(
    (session) => activeUserIds.has(session.userId) && sessionIds.has(session.sessionId),
  )
  draft.activityLogs = mergeById(draft.activityLogs || [], latest.activityLogs || [])
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
    .slice(0, 500)
  draft.popupMessages = mergePopupMessages(draft.popupMessages || [], latest.popupMessages || [])
    .filter((message) => toTimestamp(message.expiresAt) > Date.now())
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
    .slice(0, 200)
}

const USER_SECURITY_FIELDS: Array<keyof UserRecord> = [
  "authStrategy",
  "passwordHash",
  "passwordSalt",
  "twoFactorEnabled",
  "twoFactorSecret",
  "twoFactorConfirmedAt",
]

function userSecurityFingerprint(user?: UserRecord | null) {
  if (!user) return ""
  return JSON.stringify(
    Object.fromEntries(
      USER_SECURITY_FIELDS.map((field) => [field, user[field] ?? null]),
    ),
  )
}

function preserveConcurrentUserSecurityState(draft: AuthState, current: AuthState, latest: AuthState) {
  const currentById = new Map((current.users || []).map((user) => [user.id, user]))
  const latestById = new Map((latest.users || []).map((user) => [user.id, user]))
  draft.users = (draft.users || []).map((user) => {
    const currentUser = currentById.get(user.id)
    const latestUser = latestById.get(user.id)
    if (!currentUser || !latestUser) return user
    const draftChangedSecurity = userSecurityFingerprint(user) !== userSecurityFingerprint(currentUser)
    const latestChangedSecurity = userSecurityFingerprint(latestUser) !== userSecurityFingerprint(currentUser)
    if (draftChangedSecurity || !latestChangedSecurity) return user
    return {
      ...user,
      authStrategy: latestUser.authStrategy,
      passwordHash: latestUser.passwordHash ?? null,
      passwordSalt: latestUser.passwordSalt ?? null,
      twoFactorEnabled: latestUser.twoFactorEnabled,
      twoFactorSecret: latestUser.twoFactorSecret ?? null,
      twoFactorConfirmedAt: latestUser.twoFactorConfirmedAt ?? null,
    }
  })
}

export async function updateAuthState(
  mutator: (draft: AuthState) => void | Promise<void>,
  options: { preserveConcurrentSessions?: boolean; preserveUserSecurity?: boolean } = {},
) {
  let nextState: AuthState | null = null
  const preserveSessions = options.preserveConcurrentSessions !== false
  const preserveUserSecurity = options.preserveUserSecurity !== false
  authWriteQueue = authWriteQueue.then(async () => {
    const current = await readAuthState()
    const draft = JSON.parse(JSON.stringify(current)) as AuthState
    await mutator(draft)
    if (preserveSessions || preserveUserSecurity) {
      const latest = await readAuthState()
      if (preserveUserSecurity) {
        preserveConcurrentUserSecurityState(draft, current, latest)
      }
      if (preserveSessions) {
        preserveConcurrentSessionState(draft, latest)
      }
    }
    nextState = draft
    await writeAuthState(draft)
  })
  await authWriteQueue
  return nextState as unknown as AuthState
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
  const now = Date.now()
  state.presenceSessions = state.presenceSessions.map((session) => {
    const nextStatus = resolvePresenceStatus(session, now)
    return {
      ...session,
      status: nextStatus,
      manualStatus: session.manualStatus ?? null,
      lastActivityAt: session.lastActivityAt || session.lastSeenAt,
      updatedAt: nextStatus === session.status ? session.updatedAt : nowIso(),
    }
  })
}

export function listPresenceUsers(state: AuthState) {
  cleanupPresenceSessions(state)
  const latestPresenceByUser = new Map<string, PresenceSessionRecord>()

  state.presenceSessions.forEach((session) => {
    const existing = latestPresenceByUser.get(session.userId)
    if (!existing || toTimestamp(session.updatedAt) >= toTimestamp(existing.updatedAt)) {
      latestPresenceByUser.set(session.userId, session)
    }
  })

  return state.users
    .filter((user) => !user.deletedAt && user.active)
    .map((user) => {
      const session = latestPresenceByUser.get(user.id)
      const color = getUserColorToken(user.id)
      const derivedStatus = session ? resolvePresenceStatus(session) : "offline"
      return {
        id: session?.id || `presence-user-${user.id}`,
        userId: user.id,
        userName: user.name || "알 수 없음",
        avatarEmoji: user.avatarEmoji ? String(user.avatarEmoji).trim() : null,
        title: user.title || null,
        role: user.role || "viewer",
        teamId: user.teamId || "",
        teamName: getTeamName(state, user.teamId),
        currentPage: session?.currentPage || "",
        currentSection: session?.currentSection || "",
        status: derivedStatus,
        manualStatus: session?.manualStatus ?? null,
        colorToken: color.token,
        color,
        lastSeenAt: session?.lastSeenAt || user.updatedAt,
        lastActivityAt: session?.lastActivityAt || session?.lastSeenAt || user.updatedAt,
        connectionId: session?.connectionId || "",
        sessionId: session?.sessionId || "",
        createdAt: session?.createdAt || user.createdAt,
        updatedAt: session?.updatedAt || user.updatedAt,
      }
    })
    .sort((a, b) => {
      const rankDiff = presenceRank(a.status) - presenceRank(b.status)
      if (rankDiff !== 0) return rankDiff
      const seenDiff = toTimestamp(b.lastSeenAt) - toTimestamp(a.lastSeenAt)
      if (seenDiff !== 0) return seenDiff
      return a.userName.localeCompare(b.userName, "ko")
    })
}

export function listOnlinePresence(state: AuthState) {
  return listPresenceUsers(state).filter((user) => user.status !== "offline")
}

export function appendPopupMessage(
  state: AuthState,
  payload: Omit<PopupMessageRecord, "id" | "createdAt" | "expiresAt" | "readAt"> & {
    id?: string
    createdAt?: string
    expiresAt?: string
    readAt?: string | null
  },
) {
  normalizePopupMessages(state)
  const now = payload.createdAt || nowIso()
  const expiresAt = payload.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  if (payload.dedupeKey) {
    const exists = state.popupMessages.some(
      (message) =>
        message.recipientUserId === payload.recipientUserId &&
        message.dedupeKey === payload.dedupeKey &&
        toTimestamp(message.expiresAt) > Date.now(),
    )
    if (exists) return null
  }
  const message: PopupMessageRecord = {
    id: payload.id || `popup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    expiresAt,
    readAt: payload.readAt ?? null,
    senderUserId: payload.senderUserId,
    senderName: payload.senderName,
    recipientUserId: payload.recipientUserId,
    title: payload.title,
    body: payload.body,
    dedupeKey: payload.dedupeKey ?? null,
  }
  state.popupMessages.unshift(message)
  state.popupMessages = state.popupMessages.slice(0, 200)
  return message
}

export function listUnreadPopupMessages(state: AuthState, userId: string) {
  normalizePopupMessages(state)
  return state.popupMessages
    .filter((message) => message.recipientUserId === userId && !message.readAt)
    .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
    .slice(0, 5)
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
    avatarEmoji: user.avatarEmoji ? String(user.avatarEmoji).trim() : null,
    assignedIndustries: normalizeAssignedIndustries(user.assignedIndustries),
    testIdEntries: normalizeTestIdEntries(user.testIdEntries),
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
    manualStatus?: PresenceSessionRecord["manualStatus"]
    lastActivityAt?: string
  },
) {
  cleanupPresenceSessions(state)
  const existing = state.presenceSessions.find(
    (session) => session.connectionId === payload.connectionId || session.sessionId === payload.sessionId,
  )
  const now = nowIso()
  const nextLastActivityAt = payload.lastActivityAt || existing?.lastActivityAt || now
  const nextManualStatus =
    payload.manualStatus === undefined ? (existing?.manualStatus ?? null) : payload.manualStatus

  if (existing) {
    existing.currentPage = payload.currentPage
    existing.currentSection = payload.currentSection
    existing.manualStatus = nextManualStatus
    existing.lastSeenAt = now
    existing.lastActivityAt = nextLastActivityAt
    existing.status =
      payload.status ||
      resolvePresenceStatus(
        {
          ...existing,
          manualStatus: nextManualStatus,
          lastSeenAt: now,
          lastActivityAt: nextLastActivityAt,
        },
        Date.now(),
      )
    existing.updatedAt = now
    return existing
  }

  const created: PresenceSessionRecord = {
    id: `presence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: payload.userId,
    status: payload.status || (nextManualStatus === "away" ? "away" : "online"),
    manualStatus: nextManualStatus,
    currentPage: payload.currentPage,
    currentSection: payload.currentSection,
    colorToken: getUserColorToken(payload.userId).token,
    lastSeenAt: now,
    lastActivityAt: nextLastActivityAt,
    connectionId: payload.connectionId,
    sessionId: payload.sessionId,
    createdAt: now,
    updatedAt: now,
  }
  state.presenceSessions.unshift(created)
  state.presenceSessions = state.presenceSessions.slice(0, 200)
  return created
}
