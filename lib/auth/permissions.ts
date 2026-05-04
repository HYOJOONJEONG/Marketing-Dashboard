import { ACTION_KEYS, AuthState, MENU_KEYS, MenuKey, PermissionAction, PermissionIndex, UserRecord } from "@/lib/auth/model"
import { getRoleIdByName } from "@/lib/auth/store"

const ADMIN_ONLY_USER_NAME = "정효준"
const ADMIN_CONSOLE_MENU_KEYS: MenuKey[] = [
  "adminPage",
  "userManagement",
  "teamManagement",
  "permissionManagement",
  "permissionAuditLog",
  "activityLog",
  "storageManagement",
]

export function canAccessAdminConsole(user: UserRecord | null | undefined) {
  return String(user?.name || "").trim() === ADMIN_ONLY_USER_NAME
}

export function createEmptyPermissionIndex(): PermissionIndex {
  return MENU_KEYS.reduce((acc, menuKey) => {
    acc[menuKey] = ACTION_KEYS.reduce((actionAcc, action) => {
      actionAcc[action] = false
      return actionAcc
    }, {} as Record<PermissionAction, boolean>)
    return acc
  }, {} as PermissionIndex)
}

export function buildPermissionIndex(state: AuthState, user: UserRecord | null | undefined): PermissionIndex {
  const index = createEmptyPermissionIndex()
  if (!user) return index

  const roleId = getRoleIdByName(state, user.role)
  state.rolePermissions
    .filter((permission) => permission.roleId === roleId)
    .forEach((permission) => {
      if (!index[permission.menuKey]) return
      index[permission.menuKey][permission.action] = permission.allowed
    })

  state.userPermissionOverrides
    .filter((override) => override.userId === user.id)
    .forEach((override) => {
      if (!index[override.menuKey]) return
      index[override.menuKey][override.action] = override.allowed
    })

  if (canAccessAdminConsole(user)) {
    ADMIN_CONSOLE_MENU_KEYS.forEach((menuKey) => {
      ACTION_KEYS.forEach((action) => {
        index[menuKey][action] = true
      })
    })
  } else {
    const explicitAdminPermission = new Map(
      state.userPermissionOverrides
        .filter((override) => override.userId === user.id && ADMIN_CONSOLE_MENU_KEYS.includes(override.menuKey))
        .map((override) => [`${override.menuKey}:${override.action}`, override.allowed] as const),
    )
    ADMIN_CONSOLE_MENU_KEYS.forEach((menuKey) => {
      ACTION_KEYS.forEach((action) => {
        index[menuKey][action] = Boolean(explicitAdminPermission.get(`${menuKey}:${action}`))
      })
    })
  }

  return index
}

export function hasPermission(index: PermissionIndex, menuKey: keyof PermissionIndex, action: PermissionAction = "view") {
  return Boolean(index[menuKey]?.admin || index[menuKey]?.[action])
}

export function getContractAccessScope(user: UserRecord | null | undefined, permissions: PermissionIndex) {
  if (!user) return "none" as const
  if (hasPermission(permissions, "contractManagement", "admin") || user.role === "admin" || user.role === "director") {
    return "all" as const
  }
  if (user.role === "team_manager" || hasPermission(permissions, "contractManagement", "approve")) {
    return "team" as const
  }
  return "own" as const
}

export function filterContractsForUser<T extends Record<string, any>>(
  contracts: T[],
  user: UserRecord | null | undefined,
  permissions: PermissionIndex,
) {
  const scope = getContractAccessScope(user, permissions)
  if (scope === "all") return contracts
  if (!user) return []
  if (scope === "team") {
    return contracts.filter((contract) => String(contract?.teamId || "") === user.teamId)
  }
  return contracts.filter(
    (contract) => {
      const createdBy = String(contract?.createdBy || "").trim()
      const recommenderUserId = String(contract?.recommenderUserId || "").trim()
      const recommender = String(contract?.recommender || "").trim()
      return createdBy === user.id || recommenderUserId === user.id || recommender === user.name
    },
  )
}
