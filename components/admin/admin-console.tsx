"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { StorageMemoryPanel } from "@/components/admin/storage-memory-panel"
import { WorkspaceHeader } from "@/components/auth/workspace-header"
import { ACTION_LABELS, MENU_LABELS } from "@/lib/auth/model"

type Props = {
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
    color: { bg: string; text: string; border: string; hex: string }
  }
  permissions: Record<string, Record<string, boolean>>
  embedded?: boolean
}

const tabs = [
  { key: "users", label: "사용자관리" },
  { key: "teams", label: "팀관리" },
  { key: "permissions", label: "권한관리" },
  { key: "contracts", label: "계약관리" },
  { key: "storage", label: "저장공간/메모리관리" },
  { key: "permissionLogs", label: "권한변경로그" },
  { key: "userLogs", label: "사용자변경로그" },
  { key: "activityLogs", label: "활동로그" },
] as const

type AdminTabKey = (typeof tabs)[number]["key"]

const tabPermissionMap: Record<AdminTabKey, string> = {
  users: "userManagement",
  teams: "teamManagement",
  permissions: "permissionManagement",
  contracts: "adminPage",
  storage: "storageManagement",
  permissionLogs: "permissionAuditLog",
  userLogs: "userManagement",
  activityLogs: "activityLog",
}

const TITLE_OPTIONS = ["본부장", "팀장", "부장", "과장", "대리", "사원"] as const
const EDITABLE_ACTIONS = ["create", "edit", "delete", "approve", "admin"] as const
type PermissionUpdate = { menuKey: string; action: string; allowed: boolean }

const PAGE_LABELS: Record<string, string> = {
  ...MENU_LABELS,
  login: "로그인",
  logout: "로그아웃",
  me: "내 페이지",
}

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  login: "로그인",
  logout: "로그아웃",
  dashboard_put: "대시보드 저장",
  contract_create: "신규계약 등록",
  contract_update: "계약 정보 수정",
  profile_update: "내 정보 저장",
  password_change: "비밀번호 변경",
  daily_report_ai_summary: "업무일지 AI 요약",
  backup_restore: "백업 복구",
  user_create: "사용자 추가",
  user_restore: "사용자 복구",
  user_update: "사용자 정보 수정",
  user_delete: "사용자 삭제",
  team_create: "팀 추가",
  team_update: "팀 정보 수정",
  permission_update: "권한 변경",
  permission_override_reset: "개별 권한 초기화",
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  backup_json: "백업 파일",
  contract: "계약",
  dashboard_state: "대시보드 데이터",
  daily_report_summary: "업무일지 요약",
  role_permission: "역할 권한",
  session: "접속 세션",
  team: "팀",
  user: "사용자",
  user_permission_override: "사용자 개별 권한",
}

function inferRoleFromTitle(title: string) {
  if (title === "본부장") return "director"
  if (title === "팀장") return "team_manager"
  return "staff"
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `요청 실패 (${response.status})`)
  return payload
}

export function AdminConsole({ currentUser, permissions, embedded = false }: Props) {
  const getVisibleTabs = () =>
    tabs.filter((tab) => Boolean(permissions?.[tabPermissionMap[tab.key]]?.view || permissions?.[tabPermissionMap[tab.key]]?.admin))

  const [currentTab, setCurrentTab] = useState<AdminTabKey>(() => getVisibleTabs()[0]?.key || "storage")
  const [bootstrap, setBootstrap] = useState<any | null>(null)
  const [userSearch, setUserSearch] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState("")
  const [contractFilter, setContractFilter] = useState("")
  const [newUserDraft, setNewUserDraft] = useState({
    name: "",
    loginId: "",
    title: "사원",
    teamId: "",
    password: "",
  })
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  const loadBootstrap = async () => {
    const payload = await fetchJson("/api/admin/bootstrap")
    setBootstrap(payload)
    const nextDefaultUserId = payload.users?.[0]?.id || ""
    if (!payload.users?.some((user: any) => user.id === selectedUserId)) {
      setSelectedUserId(nextDefaultUserId)
    }
    if (!payload.users?.some((user: any) => user.id === selectedPermissionUserId)) {
      setSelectedPermissionUserId(nextDefaultUserId)
    }
  }

  const visibleTabs = useMemo(() => getVisibleTabs(), [permissions])
  const canGrantPermissions = Boolean(permissions?.permissionManagement?.edit || permissions?.permissionManagement?.admin)

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === currentTab)) {
      setCurrentTab(visibleTabs[0]?.key || "storage")
    }
  }, [currentTab, visibleTabs])

  useEffect(() => {
    if (currentTab !== "storage") void loadBootstrap()
  }, [currentTab])

  const users = bootstrap?.users || []
  const teams = bootstrap?.teams || []
  const roles = bootstrap?.roles || []
  const permissionRows = bootstrap?.permissionRows || []
  const userPermissionMap = bootstrap?.userPermissionMap || {}
  const contracts = bootstrap?.contracts || []
  const industryOptions = bootstrap?.industryOptions || []

  const selectedUser = useMemo(() => users.find((user: any) => user.id === selectedUserId) || null, [users, selectedUserId])
  const securityTeam = useMemo(() => teams.find((team: any) => team.name === "정보보안") || null, [teams])
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    return users.filter((user: any) => {
      if (!query) return true
      return [user.name, user.teamName, user.title, user.role, user.active ? "active" : "inactive"]
        .filter(Boolean)
        .some((value: string) => String(value).toLowerCase().includes(query))
    })
  }, [users, userSearch])

  const filteredContracts = useMemo(() => {
    const query = contractFilter.trim().toLowerCase()
    return contracts.filter((contract: any) => {
      if (!query) return true
      return [contract.companyName, contract.idCode, contract.recommender, contract.teamId]
        .filter(Boolean)
        .some((value: string) => String(value).toLowerCase().includes(query))
    })
  }, [contracts, contractFilter])

  useEffect(() => {
    if (!teams.length) return
    setNewUserDraft((prev) => ({
      ...prev,
      teamId: prev.teamId || securityTeam?.id || teams[0]?.id || "",
    }))
  }, [securityTeam?.id, teams])

  const selectedUserPermissionIndex = useMemo(
    () => userPermissionMap[selectedPermissionUserId] || {},
    [selectedPermissionUserId, userPermissionMap],
  )
  const hasEditablePermission = (menuKey: string) =>
    EDITABLE_ACTIONS.some((action) => Boolean(selectedUserPermissionIndex?.[menuKey]?.[action]))
  const selectedUserStoragePermission = selectedUser ? userPermissionMap[selectedUser.id]?.storageManagement || {} : {}
  const selectedUserCanRestoreBackup = Boolean(selectedUserStoragePermission.view && selectedUserStoragePermission.admin)

  const runAction = (task: () => Promise<void>) => {
    setMessage("")
    startTransition(async () => {
      try {
        await task()
        await loadBootstrap()
        setMessage("저장되었습니다.")
      } catch (error: any) {
        setMessage(String(error?.message || "요청 처리에 실패했습니다."))
      }
    })
  }

  const createUser = () => {
    const name = newUserDraft.name.trim()
    const loginId = (newUserDraft.loginId || newUserDraft.name).trim()
    const title = newUserDraft.title || "사원"
    const role = inferRoleFromTitle(title)
    const teamId = newUserDraft.teamId || securityTeam?.id || teams[0]?.id || ""
    if (!name || !loginId || !teamId) {
      setMessage("이름, 로그인ID, 팀을 입력해주세요.")
      return
    }
    runAction(async () => {
      await fetchJson("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          loginId,
          title,
          role,
          teamId,
          password: newUserDraft.password.trim(),
        }),
      })
      setNewUserDraft({
        name: "",
        loginId: "",
        title: "사원",
        teamId,
        password: "",
      })
    })
  }

  const updateUser = (fieldName: string, value: string | boolean) => {
    if (!selectedUser) return
    runAction(async () => {
      await fetchJson("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, fieldName, value }),
      })
    })
  }

  const resetUserTwoFactor = () => {
    if (!selectedUser) return
    if (!window.confirm(`${selectedUser.name}님의 2FA를 초기화할까요? 다음 로그인 때 새 QR을 등록해야 합니다.`)) return
    updateUser("twoFactorReset", true)
  }

  const deleteUser = (userId: string) => {
    if (!window.confirm("이 사용자를 삭제 또는 비활성화 처리할까요?")) return
    runAction(async () => {
      await fetchJson("/api/admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      })
    })
  }

  const savePermissionUpdates = (updates: PermissionUpdate[]) => {
    if (!selectedPermissionUserId || !updates.length) return
    runAction(async () => {
      await fetchJson("/api/admin/permissions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "user",
          userId: selectedPermissionUserId,
          updates,
        }),
      })
    })
  }

  const savePermissionUpdatesForUser = (userId: string, updates: PermissionUpdate[]) => {
    if (!userId || !updates.length) return
    runAction(async () => {
      await fetchJson("/api/admin/permissions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "user",
          userId,
          updates,
        }),
      })
    })
  }

  const toggleAdminRestoreAccess = (userId: string, allowed: boolean) => {
    const updates = ["view", ...EDITABLE_ACTIONS].map((action) => ({
      menuKey: "storageManagement",
      action,
      allowed,
    }))
    savePermissionUpdatesForUser(userId, updates)
  }

  const saveMenuPermission = (menuKey: string, mode: "read" | "edit", allowed: boolean) => {
    const updates: PermissionUpdate[] = []

    if (mode === "read") {
      updates.push({ menuKey, action: "view", allowed })
      if (!allowed) {
        updates.push(...EDITABLE_ACTIONS.map((action) => ({ menuKey, action, allowed: false })))
      }
      savePermissionUpdates(updates)
      return
    }

    if (allowed) {
      updates.push({ menuKey, action: "view", allowed: true })
    }

    updates.push(...EDITABLE_ACTIONS.map((action) => ({ menuKey, action, allowed })))
    savePermissionUpdates(updates)
  }

  const resetOverrides = () => {
    if (!selectedPermissionUserId) return
    runAction(async () => {
      await fetchJson("/api/admin/permissions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedPermissionUserId }),
      })
    })
  }

  const updateContractStatus = (contractId: string, status: string) => {
    runAction(async () => {
      await fetchJson("/api/admin/contracts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId, fieldName: "documentStatus", value: status }),
      })
    })
  }

  return (
    <div className={embedded ? "space-y-4" : "min-h-screen bg-[#f6f8fc] px-4 py-4"}>
      {!embedded ? (
        <WorkspaceHeader currentPage="관리자페이지" currentSection={currentTab} currentUser={currentUser} showDashboardButton />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Admin Menu</div>
          <div className="mt-4 space-y-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTab(tab.key)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  currentTab === tab.key ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            사용자별로 메뉴 권한을 직접 조정할 수 있습니다.
            <div className="mt-2 text-xs text-slate-400">
              권한관리 탭에서는 이름을 선택한 뒤 체크박스로 바로 권한을 열고 닫으면 됩니다.
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              {message}
            </div>
          ) : null}

          {currentTab === "users" && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">사용자관리</h2>
                  <p className="mt-1 text-sm text-slate-500">사용자 추가, 팀/직급 변경, 활성화/비활성화, 삭제를 관리합니다.</p>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-black text-slate-800">사용자 추가</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_160px_180px_1fr_auto]">
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    placeholder="이름"
                    value={newUserDraft.name}
                    onChange={(event) =>
                      setNewUserDraft((prev) => ({
                        ...prev,
                        name: event.target.value,
                        loginId: prev.loginId || event.target.value,
                      }))
                    }
                  />
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    placeholder="로그인ID"
                    value={newUserDraft.loginId}
                    onChange={(event) => setNewUserDraft((prev) => ({ ...prev, loginId: event.target.value }))}
                  />
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    value={newUserDraft.title}
                    onChange={(event) => setNewUserDraft((prev) => ({ ...prev, title: event.target.value }))}
                  >
                    {TITLE_OPTIONS.map((title) => (
                      <option key={`new-user-title-${title}`} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    value={newUserDraft.teamId}
                    onChange={(event) => setNewUserDraft((prev) => ({ ...prev, teamId: event.target.value }))}
                  >
                    {teams.map((team: any) => (
                      <option key={`new-user-team-${team.id}`} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    placeholder="개별 비밀번호(선택)"
                    type="password"
                    value={newUserDraft.password}
                    onChange={(event) => setNewUserDraft((prev) => ({ ...prev, password: event.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={createUser}
                    disabled={isPending || !newUserDraft.name.trim()}
                    className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    추가&저장
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                      placeholder="이름 / 팀 / 역할 / 활성여부 검색"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="px-4 py-3 text-left font-semibold">사용자</th>
                          <th className="px-4 py-3 text-left font-semibold">팀</th>
                          <th className="px-4 py-3 text-left font-semibold">직급</th>
                          <th className="px-4 py-3 text-left font-semibold">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user: any) => (
                          <tr
                            key={user.id}
                            onClick={() => {
                              setSelectedUserId(user.id)
                              setSelectedPermissionUserId(user.id)
                            }}
                            className={`cursor-pointer border-t border-slate-200 ${selectedUserId === user.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${user.color.border} ${user.color.bg} ${user.color.text} text-xs font-black`}>
                                  {user.name.slice(0, 1)}
                                </span>
                                <div>
                                  <div className="font-semibold text-slate-800">{user.name}</div>
                                  <div className="text-xs text-slate-400">{user.loginId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">{user.teamName}</td>
                            <td className="px-4 py-3">{user.title || "-"}</td>
                            <td className="px-4 py-3">{user.active ? "활성" : "비활성"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {selectedUser ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-500">선택 사용자</div>
                        <div className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">{selectedUser.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{selectedUser.loginId}</div>
                      </div>
                      <label className="block">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">팀</div>
                        <select
                          value={selectedUser.teamId}
                          onChange={(event) => updateUser("teamId", event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          {teams.map((team: any) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">직급</div>
                        <select
                          value={selectedUser.title || "사원"}
                          onChange={(event) => updateUser("title", event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          {TITLE_OPTIONS.map((title) => (
                            <option key={title} value={title}>
                              {title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="block">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">담당 업종</div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap gap-2">
                            {industryOptions.length ? (
                              industryOptions.map((industry: string) => {
                                const checked = Array.isArray(selectedUser.assignedIndustries) && selectedUser.assignedIndustries.includes(industry)
                                return (
                                  <label
                                    key={industry}
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                      checked
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-slate-200 bg-slate-50 text-slate-600"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={checked}
                                      onChange={(event) => {
                                        const nextValues = event.target.checked
                                          ? [...(selectedUser.assignedIndustries || []), industry]
                                          : (selectedUser.assignedIndustries || []).filter((item: string) => item !== industry)
                                        updateUser("assignedIndustries", nextValues)
                                      }}
                                    />
                                    {industry}
                                  </label>
                                )
                              })
                            ) : (
                              <div className="text-sm text-slate-400">업종 데이터가 아직 없습니다.</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <label className="block">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">시스템 역할</div>
                        <select
                          value={selectedUser.role}
                          onChange={(event) => updateUser("role", event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          {roles.map((role: any) => (
                            <option key={role.id} value={role.name}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">저장공간/메모리관리</div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              {selectedUserCanRestoreBackup ? "백업 복구 가능" : "권한 없음"}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-400">
                              부여하면 저장공간/메모리관리 조회, 백업 다운로드, JSON 복구를 실행할 수 있습니다.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAdminRestoreAccess(selectedUser.id, !selectedUserCanRestoreBackup)}
                            disabled={!canGrantPermissions}
                            title={canGrantPermissions ? "저장공간/메모리관리 복구 권한 변경" : "권한관리 수정 권한이 필요합니다."}
                            className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                              selectedUserCanRestoreBackup
                                ? "border border-rose-200 bg-rose-50 text-rose-700"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {selectedUserCanRestoreBackup ? "복구권한 회수" : "복구권한 부여"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={resetUserTwoFactor}
                          className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                        >
                          2FA 초기화
                        </button>
                        <button
                          type="button"
                          onClick={() => updateUser("active", !selectedUser.active)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          {selectedUser.active ? "비활성화" : "재활성화"}
                        </button>
                          <button
                            type="button"
                            onClick={() => deleteUser(selectedUser.id)}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                  ) : (
                    <div className="text-sm text-slate-400">왼쪽에서 사용자를 선택하세요.</div>
                  )}
                </div>
              </div>
            </section>
          )}

          {currentTab === "teams" && (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">팀관리</h2>
                  <p className="mt-1 text-sm text-slate-500">팀별 사용자 수와 계약 수를 함께 관리합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt("팀명을 입력하세요.")
                    const code = window.prompt("팀 코드를 입력하세요.")
                    if (!name || !code) return
                    runAction(async () => {
                      await fetchJson("/api/admin/teams", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ name, code }),
                      })
                    })
                  }}
                  className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
                >
                  팀 추가
                </button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 text-left font-semibold">코드</th>
                      <th className="px-4 py-3 text-left font-semibold">팀명</th>
                      <th className="px-4 py-3 text-left font-semibold">사용자 수</th>
                      <th className="px-4 py-3 text-left font-semibold">계약 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team: any) => (
                      <tr key={team.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{team.code}</td>
                        <td className="px-4 py-3">
                          <input
                            defaultValue={team.name}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            onBlur={(event) => {
                              if (event.target.value && event.target.value !== team.name) {
                                runAction(async () => {
                                  await fetchJson("/api/admin/teams", {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ teamId: team.id, fieldName: "name", value: event.target.value }),
                                  })
                                })
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">{users.filter((user: any) => user.teamId === team.id && user.active).length}</td>
                        <td className="px-4 py-3">{contracts.filter((contract: any) => contract.teamId === team.id).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {currentTab === "permissions" && (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">권한관리</h2>
                  <p className="mt-1 text-sm text-slate-500">이름을 선택해서 사용자별 권한을 직접 조정합니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={resetOverrides} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    개별 권한 초기화
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <select
                  value={selectedPermissionUserId}
                  onChange={(event) => setSelectedPermissionUserId(event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  {users.map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.title ? `· ${user.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 text-left font-semibold">메뉴</th>
                      <th className="px-4 py-3 text-center font-semibold">읽기</th>
                      <th className="px-4 py-3 text-center font-semibold">수정가능</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionRows.map((row: any) => (
                      <tr key={row.menuKey} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedUserPermissionIndex?.[row.menuKey]?.view)}
                            onChange={(event) => saveMenuPermission(row.menuKey, "read", event.target.checked)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={hasEditablePermission(row.menuKey)}
                            onChange={(event) => saveMenuPermission(row.menuKey, "edit", event.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {currentTab === "contracts" && (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">계약관리</h2>
                  <p className="mt-1 text-sm text-slate-500">권유자/팀/상태 기준 필터와 관리 작업을 제공합니다.</p>
                </div>
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  placeholder="회사명 / ID / 권유자 / 팀 검색"
                  value={contractFilter}
                  onChange={(event) => setContractFilter(event.target.value)}
                />
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "아이디", "권유자", "팀", "상태", "작업"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((contract: any) => (
                      <tr key={contract.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{contract.companyName}</td>
                        <td className="px-4 py-3">{contract.idCode}</td>
                        <td className="px-4 py-3">{contract.recommender}</td>
                        <td className="px-4 py-3">{bootstrap?.teamMap?.[contract.teamId] || contract.teamId}</td>
                        <td className="px-4 py-3">{contract.documentStatus}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateContractStatus(contract.id, contract.documentStatus === "회수" ? "미회수" : "회수")}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              상태변경
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {currentTab === "storage" && <StorageMemoryPanel canRestore={Boolean(permissions?.storageManagement?.admin)} />}

          {currentTab === "permissionLogs" && (
            <LogTable title="권한변경로그" rows={bootstrap?.permissionChangeLogs || []} columns={["targetUserId", "menuKey", "action", "beforeValue", "afterValue", "changedAt"]} />
          )}

          {currentTab === "userLogs" && (
            <LogTable title="사용자변경로그" rows={bootstrap?.userChangeLogs || []} columns={["targetUserId", "fieldName", "beforeValue", "afterValue", "changedAt"]} />
          )}

          {currentTab === "activityLogs" && (
            <ActivityLogTable rows={bootstrap?.activityLogs || []} users={users} teams={teams} />
          )}
        </main>
      </div>
    </div>
  )
}

function LogTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200">
                {columns.map((column) => (
                  <td key={`${row.id}-${column}`} className="px-4 py-3 align-top">
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function parseLogJson(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function formatLogDateTime(value: unknown) {
  const date = new Date(String(value || ""))
  if (Number.isNaN(date.getTime())) return String(value ?? "")
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatActivityTarget(row: any, userNameById: Record<string, string>, teamNameById: Record<string, string>) {
  const targetType = String(row?.targetType || "")
  const targetId = String(row?.targetId || "")
  const typeLabel = TARGET_TYPE_LABELS[targetType] || targetType || "대상"
  if (targetType === "user" || targetType === "user_permission_override") {
    return `${typeLabel}: ${userNameById[targetId] || targetId || "-"}`
  }
  if (targetType === "team") {
    return `${typeLabel}: ${teamNameById[targetId] || targetId || "-"}`
  }
  return targetId ? `${typeLabel}: ${targetId}` : typeLabel
}

function describePermissionUpdates(updates: any[]) {
  const summary = updates.slice(0, 3).map((item) => {
    const menuLabel = (MENU_LABELS as Record<string, string>)[String(item?.menuKey || "")] || item?.menuKey || "메뉴"
    const actionLabel = (ACTION_LABELS as Record<string, string>)[String(item?.action || "")] || item?.action || "권한"
    return `${menuLabel} ${actionLabel} ${item?.allowed ? "허용" : "해제"}`
  })
  const suffix = updates.length > 3 ? ` 외 ${updates.length - 3}건` : ""
  return `${summary.join(", ")}${suffix}`
}

function describeActivity(row: any, userNameById: Record<string, string>, teamNameById: Record<string, string>) {
  const actionType = String(row?.actionType || "")
  const actionLabel = ACTIVITY_ACTION_LABELS[actionType] || actionType || "활동"
  const pageLabel = PAGE_LABELS[String(row?.pageKey || "")] || String(row?.pageKey || "-")
  const after = parseLogJson(row?.afterValue)
  const before = parseLogJson(row?.beforeValue)

  if (actionType === "permission_update") {
    return {
      title: `${actionLabel}`,
      detail: Array.isArray(after?.updates) ? describePermissionUpdates(after.updates) : "권한 설정을 변경했습니다.",
      pageLabel,
    }
  }
  if (actionType === "permission_override_reset") {
    return { title: actionLabel, detail: "사용자에게 따로 부여한 권한을 기본 권한으로 되돌렸습니다.", pageLabel }
  }
  if (actionType === "profile_update") {
    const details = []
    if (typeof after?.testIdEntryCount === "number") details.push(`시험아이디 ${after.testIdEntryCount}건 저장`)
    if (Array.isArray(after?.assignedIndustries)) details.push(`담당업종 ${after.assignedIndustries.length}건 저장`)
    if (Object.prototype.hasOwnProperty.call(after || {}, "avatarEmoji")) details.push("아바타 변경")
    if (!details.length && typeof before?.testIdEntryCount === "number") details.push("시험아이디 목록 저장")
    return { title: actionLabel, detail: details.join(" · ") || "프로필 정보를 저장했습니다.", pageLabel }
  }
  if (actionType === "dashboard_put") {
    return { title: actionLabel, detail: `${pageLabel} 화면의 입력값을 저장했습니다.`, pageLabel }
  }
  if (actionType === "contract_create") {
    return { title: actionLabel, detail: "신규계약 리스트에 계약을 등록했습니다.", pageLabel }
  }
  if (actionType === "contract_update") {
    return {
      title: actionLabel,
      detail: row?.beforeValue || row?.afterValue ? `${String(row?.beforeValue || "-")} → ${String(row?.afterValue || "-")}` : "계약 상태 또는 정보를 변경했습니다.",
      pageLabel,
    }
  }
  if (actionType === "user_create" || actionType === "user_restore") {
    const teamName = after?.teamId ? teamNameById[String(after.teamId)] || after.teamId : ""
    return { title: actionLabel, detail: [after?.name, teamName, after?.role].filter(Boolean).join(" / ") || "사용자 계정을 등록했습니다.", pageLabel }
  }
  if (actionType === "user_update") {
    if (after?.twoFactorReset) return { title: "OTP 초기화", detail: "사용자의 2FA/OTP 인증 정보를 초기화했습니다.", pageLabel }
    return { title: actionLabel, detail: row?.afterValue ? `변경값: ${String(row.afterValue)}` : "사용자 정보를 변경했습니다.", pageLabel }
  }
  if (actionType === "user_delete") {
    return { title: actionLabel, detail: "사용자 계정을 비활성화하고 세션을 정리했습니다.", pageLabel }
  }
  if (actionType === "team_create") {
    return { title: actionLabel, detail: row?.afterValue ? `팀명: ${String(row.afterValue)}` : "팀을 추가했습니다.", pageLabel }
  }
  if (actionType === "team_update") {
    return { title: actionLabel, detail: after?.fieldName ? `${after.fieldName}: ${after.value || "-"}` : "팀 정보를 변경했습니다.", pageLabel }
  }
  if (actionType === "backup_restore") {
    const restored = Array.isArray(after?.restored) ? after.restored.join(", ") : ""
    return { title: actionLabel, detail: restored ? `복구 범위: ${restored}` : "백업 JSON으로 데이터를 복구했습니다.", pageLabel }
  }
  if (actionType === "daily_report_ai_summary") {
    return { title: actionLabel, detail: `업무일지 ${after?.reportCount ?? "-"}건으로 요약을 생성했습니다.`, pageLabel }
  }
  if (actionType === "password_change") {
    return { title: actionLabel, detail: "내 계정의 비밀번호를 변경했습니다.", pageLabel }
  }
  if (actionType === "login") {
    return { title: actionLabel, detail: "시스템에 로그인했습니다.", pageLabel }
  }
  if (actionType === "logout") {
    return { title: actionLabel, detail: "시스템에서 로그아웃했습니다.", pageLabel }
  }

  return {
    title: actionLabel,
    detail: row?.afterValue ? String(row.afterValue) : "활동이 기록되었습니다.",
    pageLabel,
  }
}

function ActivityLogTable({ rows, users, teams }: { rows: any[]; users: any[]; teams: any[] }) {
  const userNameById = Object.fromEntries((users || []).map((user: any) => [user.id, user.name]))
  const teamNameById = Object.fromEntries((teams || []).map((team: any) => [team.id, team.name]))

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">활동로그</h2>
          <p className="mt-1 text-sm text-slate-500">내부 액션 코드 대신 실제 작업 내용 기준으로 보여줍니다.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{rows.length.toLocaleString("ko-KR")}건</div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              {["작업 내용", "처리자", "메뉴", "대상", "결과", "시간"].map((head) => (
                <th key={head} className="px-4 py-3 text-left font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const description = describeActivity(row, userNameById, teamNameById)
              return (
                <tr key={row.id} className="border-t border-slate-200 align-top hover:bg-slate-50/70">
                  <td className="min-w-[280px] px-4 py-3">
                    <div className="font-extrabold text-slate-950">{description.title}</div>
                    <div className="mt-1 max-w-[520px] text-xs font-medium leading-5 text-slate-500">{description.detail}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800">{row.actorName || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{description.pageLabel}</td>
                  <td className="min-w-[180px] px-4 py-3 text-xs font-semibold leading-5 text-slate-600">
                    {formatActivityTarget(row, userNameById, teamNameById)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${row.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {row.success ? "성공" : "실패"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">{formatLogDateTime(row.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
