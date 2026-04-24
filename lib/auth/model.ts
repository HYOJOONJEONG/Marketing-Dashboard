export type RoleKey = "admin" | "director" | "team_manager" | "staff" | "viewer"
export type MenuKey =
  | "dashboard"
  | "weeklyReport"
  | "manualInput"
  | "newContractsList"
  | "weeklySelection"
  | "newContractCreate"
  | "collectionManagement"
  | "optionDashboard"
  | "terminationManagement"
  | "contractManagement"
  | "userManagement"
  | "teamManagement"
  | "permissionManagement"
  | "permissionAuditLog"
  | "activityLog"
  | "adminPage"
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "admin"

export type TeamRecord = {
  id: string
  code: string
  name: string
  createdAt: string
  updatedAt: string
}

export type RoleRecord = {
  id: string
  name: RoleKey
  description: string
}

export type PermissionRecord = {
  id: string
  menuKey: MenuKey
  action: PermissionAction
  description: string
}

export type RolePermissionRecord = {
  id: string
  roleId: string
  menuKey: MenuKey
  action: PermissionAction
  allowed: boolean
}

export type UserPermissionOverrideRecord = {
  id: string
  userId: string
  menuKey: MenuKey
  action: PermissionAction
  allowed: boolean
}

export type UserRecord = {
  id: string
  loginId: string
  name: string
  title?: string | null
  role: RoleKey
  teamId: string
  active: boolean
  deletedAt: string | null
  authStrategy: "common" | "admin" | "individual"
  passwordHash?: string | null
  passwordSalt?: string | null
  createdAt: string
  updatedAt: string
}

export type UserSessionRecord = {
  id: string
  userId: string
  sessionToken: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  ipAddress: string
  userAgent: string
}

export type PresenceSessionRecord = {
  id: string
  userId: string
  status: "online" | "offline" | "editing"
  currentPage: string
  currentSection: string
  colorToken: string
  lastSeenAt: string
  connectionId: string
  sessionId: string
  createdAt: string
  updatedAt: string
}

export type ActivityLogRecord = {
  id: string
  actorUserId: string
  actorName: string
  actionType: string
  targetType: string
  targetId: string
  pageKey: string
  beforeValue: string
  afterValue: string
  ipAddress: string
  sessionId: string
  success: boolean
  createdAt: string
}

export type PermissionChangeLogRecord = {
  id: string
  targetUserId: string
  changedByAdminId: string
  menuKey: MenuKey
  action: PermissionAction
  beforeValue: boolean
  afterValue: boolean
  changedAt: string
}

export type UserChangeLogRecord = {
  id: string
  targetUserId: string
  changedByAdminId: string
  fieldName: string
  beforeValue: string
  afterValue: string
  changedAt: string
}

export type PermissionIndex = Record<MenuKey, Partial<Record<PermissionAction, boolean>>>

export type AuthState = {
  version: number
  teams: TeamRecord[]
  roles: RoleRecord[]
  permissions: PermissionRecord[]
  rolePermissions: RolePermissionRecord[]
  userPermissionOverrides: UserPermissionOverrideRecord[]
  users: UserRecord[]
  userSessions: UserSessionRecord[]
  presenceSessions: PresenceSessionRecord[]
  activityLogs: ActivityLogRecord[]
  permissionChangeLogs: PermissionChangeLogRecord[]
  userChangeLogs: UserChangeLogRecord[]
}

export const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "대시보드",
  weeklyReport: "주간실적보고",
  manualInput: "수동입력리스트",
  newContractsList: "신규계약리스트",
  weeklySelection: "주간 반영 리스트",
  newContractCreate: "신규계약등록",
  collectionManagement: "계약서통합관리",
  optionDashboard: "유료 옵션 정보 현황",
  terminationManagement: "해지 진행사항",
  contractManagement: "계약관리",
  userManagement: "사용자관리",
  teamManagement: "팀관리",
  permissionManagement: "권한관리",
  permissionAuditLog: "권한변경로그",
  activityLog: "활동로그",
  adminPage: "관리자페이지",
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "조회",
  create: "생성",
  edit: "수정",
  delete: "삭제",
  approve: "승인",
  admin: "관리",
}

export const MENU_KEYS = Object.keys(MENU_LABELS) as MenuKey[]
export const ACTION_KEYS = Object.keys(ACTION_LABELS) as PermissionAction[]

export const ADMIN_PERMISSION_ROW_KEYS: MenuKey[] = [
  "weeklyReport",
  "manualInput",
  "newContractsList",
  "weeklySelection",
  "collectionManagement",
  "optionDashboard",
  "terminationManagement",
  "adminPage",
]

export const USER_COLOR_PALETTE = [
  { token: "blue", bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", hex: "#2563eb" },
  { token: "green", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", hex: "#059669" },
  { token: "purple", bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300", hex: "#7c3aed" },
  { token: "orange", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", hex: "#ea580c" },
  { token: "pink", bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", hex: "#db2777" },
  { token: "teal", bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", hex: "#0d9488" },
  { token: "indigo", bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300", hex: "#4f46e5" },
  { token: "red", bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300", hex: "#dc2626" },
  { token: "amber", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", hex: "#d97706" },
  { token: "cyan", bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300", hex: "#0891b2" },
  { token: "lime", bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-300", hex: "#65a30d" },
] as const

export function getUserColorToken(userId: string) {
  const safe = String(userId || "")
  const hash = safe.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return USER_COLOR_PALETTE[hash % USER_COLOR_PALETTE.length]
}
