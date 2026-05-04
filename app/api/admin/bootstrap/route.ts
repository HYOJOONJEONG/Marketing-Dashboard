import path from "path"
import { NextResponse } from "next/server"
import { readDashboardState } from "@/lib/shared-db-store"
import { requireAnyApiPermission } from "@/lib/auth/server"
import { ADMIN_CONSOLE_ACCESS_KEYS, ADMIN_PERMISSION_ROW_KEYS, MENU_LABELS } from "@/lib/auth/model"
import { buildPermissionIndex, createEmptyPermissionIndex } from "@/lib/auth/permissions"
import { getTeamName, listOnlinePresence, toSafeUser } from "@/lib/auth/store"
import { getIndustryGroupLabel } from "@/lib/industry-groups"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAnyApiPermission(ADMIN_CONSOLE_ACCESS_KEYS, "view")
  if (!auth.ok) return auth.response

  const dashboard =
    (await readDashboardState<any>(DATA_PATH)) ||
    (await readDashboardState<any>(FALLBACK_PATH)) || { contracts: [] }

  const teamMap = Object.fromEntries(auth.context.state.teams.map((team) => [team.id, team.name]))
  const industryOptions = Array.from(
    new Set(
      [
        ...(Array.isArray(dashboard?.contracts)
          ? dashboard.contracts.map((row: any) => getIndustryGroupLabel(row?.industry, row?.companyName))
          : []),
        ...(Array.isArray(dashboard?.collection?.integrated)
          ? dashboard.collection.integrated.map((row: any) => getIndustryGroupLabel(row?.industry, row?.companyName))
          : []),
        ...(Array.isArray(dashboard?.collection?.longTerm)
          ? dashboard.collection.longTerm.map((row: any) => getIndustryGroupLabel(row?.industry, row?.companyName))
          : []),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ko"))
  const visibleUsers = auth.context.state.users.filter((user) => !user.deletedAt)
  const users = visibleUsers.map((user) => toSafeUser(user, auth.context.state))
  const roles = auth.context.state.roles
  const permissionRows = ADMIN_PERMISSION_ROW_KEYS.map((menuKey) => ({ menuKey, label: MENU_LABELS[menuKey] }))
  const rolePermissionMap = Object.fromEntries(
    roles.map((role) => [
      role.id,
      auth.context.state.rolePermissions
        .filter((permission) => permission.roleId === role.id)
        .reduce((acc: any, permission) => {
          acc[permission.menuKey] ||= createEmptyPermissionIndex()[permission.menuKey]
          acc[permission.menuKey][permission.action] = permission.allowed
          return acc
        }, createEmptyPermissionIndex()),
    ]),
  )
  const userOverrideMap = Object.fromEntries(
    visibleUsers.map((user) => [
      user.id,
      auth.context.state.userPermissionOverrides
        .filter((override) => override.userId === user.id)
        .reduce((acc: any, override) => {
          acc[override.menuKey] ||= {}
          acc[override.menuKey][override.action] = override.allowed
          return acc
        }, {}),
    ]),
  )
  const userPermissionMap = Object.fromEntries(
    visibleUsers.map((user) => [user.id, buildPermissionIndex(auth.context.state, user)]),
  )

  return NextResponse.json({
    ok: true,
    users,
    industryOptions,
    teams: auth.context.state.teams,
    roles,
    permissionRows,
    rolePermissionMap,
    userOverrideMap,
    userPermissionMap,
    contracts: (dashboard.contracts || []).map((contract: any) => ({
      ...contract,
      teamName: teamMap[contract.teamId] || getTeamName(auth.context.state, contract.teamId),
    })),
    permissionChangeLogs: auth.context.state.permissionChangeLogs,
    userChangeLogs: auth.context.state.userChangeLogs,
    activityLogs: auth.context.state.activityLogs,
    onlineUsers: listOnlinePresence(auth.context.state),
    teamMap,
  })
}
