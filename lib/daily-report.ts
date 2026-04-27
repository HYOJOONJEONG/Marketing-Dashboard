export type DailyReportStatus = "complete" | "draft" | "empty"

export type DailyDirectoryUser = {
  id: string
  loginId: string
  name: string
  title?: string | null
  teamId: string
  teamName: string
  teamOrder: number
  displayOrder: number
  avatarEmoji?: string | null
}

export type DailyReportEntry = {
  id: string
  date: string
  userId: string
  userName: string
  teamId: string
  teamName: string
  teamOrder: number
  displayOrder: number
  reportBody: string
  plannedTasks: string
  submittedAt: string | null
  updatedAt: string
}

export type DailyReportSummaryRecord = {
  date: string
  content: string
  createdAt: string
  createdBy: string
}

export type DailyReportState = {
  reports: DailyReportEntry[]
  aiSummaries: DailyReportSummaryRecord[]
}

const TEAM_ORDER: Record<string, number> = {
  본부: 1,
  인포Biz1팀: 2,
  인포Biz2팀: 3,
}

const USER_ORDER: Record<string, number> = {
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
  박대일: 4,
  기타: 5,
}

function safeString(value: unknown) {
  return String(value ?? "").trim()
}

function nowIso() {
  return new Date().toISOString()
}

export function getDailyTeamOrder(teamName: string) {
  return TEAM_ORDER[safeString(teamName)] ?? 99
}

export function getDailyDisplayOrder(name: string) {
  return USER_ORDER[safeString(name)] ?? 99
}

export function sortDailyDirectoryUsers<T extends { teamOrder?: number; displayOrder?: number; name?: string }>(users: T[]) {
  return [...users].sort((a, b) => {
    const teamDiff = Number(a.teamOrder ?? 99) - Number(b.teamOrder ?? 99)
    if (teamDiff !== 0) return teamDiff
    const displayDiff = Number(a.displayOrder ?? 99) - Number(b.displayOrder ?? 99)
    if (displayDiff !== 0) return displayDiff
    return safeString(a.name).localeCompare(safeString(b.name), "ko")
  })
}

export function ensureDailyDirectoryUsers(users: DailyDirectoryUser[]) {
  const nextUsers = [...users]
  const teamTwoUser = nextUsers.find((user) => safeString(user.teamName) === "인포Biz2팀")
  const hasOtherEntry = nextUsers.some(
    (user) => safeString(user.teamName) === "인포Biz2팀" && safeString(user.name) === "기타",
  )

  if (teamTwoUser && !hasOtherEntry) {
    nextUsers.push({
      id: "daily-other-infobiz2",
      loginId: "daily-other-infobiz2",
      name: "기타",
      title: null,
      teamId: teamTwoUser.teamId,
      teamName: teamTwoUser.teamName,
      teamOrder: teamTwoUser.teamOrder,
      displayOrder: getDailyDisplayOrder("기타"),
      avatarEmoji: null,
    })
  }

  return sortDailyDirectoryUsers(nextUsers)
}

export function createEmptyDailyReportState(): DailyReportState {
  return {
    reports: [],
    aiSummaries: [],
  }
}

export function normalizeDailyReportState(raw: any, directoryUsers: DailyDirectoryUser[], date: string): DailyReportState {
  const now = nowIso()
  const reports = Array.isArray(raw?.reports) ? raw.reports : []
  const aiSummaries = Array.isArray(raw?.aiSummaries) ? raw.aiSummaries : []
  const normalizedUsers = sortDailyDirectoryUsers(directoryUsers)

  const seededReports = normalizedUsers.map((user) => {
    const existing = reports.find((row: any) => safeString(row?.date) === date && safeString(row?.userId) === user.id)
    return {
      id: safeString(existing?.id) || `daily-${date}-${user.id}`,
      date,
      userId: user.id,
      userName: user.name,
      teamId: user.teamId,
      teamName: user.teamName,
      teamOrder: user.teamOrder,
      displayOrder: user.displayOrder,
      reportBody: safeString(existing?.reportBody),
      plannedTasks: safeString(existing?.plannedTasks),
      submittedAt: safeString(existing?.submittedAt) || null,
      updatedAt: safeString(existing?.updatedAt) || now,
    } satisfies DailyReportEntry
  })

  const legacyReports = reports
    .filter((row: any) => safeString(row?.date) !== date)
    .map((row: any) => ({
      id: safeString(row?.id),
      date: safeString(row?.date),
      userId: safeString(row?.userId),
      userName: safeString(row?.userName),
      teamId: safeString(row?.teamId),
      teamName: safeString(row?.teamName),
      teamOrder: Number(row?.teamOrder ?? getDailyTeamOrder(row?.teamName)),
      displayOrder: Number(row?.displayOrder ?? getDailyDisplayOrder(row?.userName)),
      reportBody: safeString(row?.reportBody),
      plannedTasks: safeString(row?.plannedTasks),
      submittedAt: safeString(row?.submittedAt) || null,
      updatedAt: safeString(row?.updatedAt) || now,
    }))

  return {
    reports: sortDailyDirectoryUsers([...legacyReports, ...seededReports]),
    aiSummaries: aiSummaries
      .map((row: any) => ({
        date: safeString(row?.date),
        content: safeString(row?.content),
        createdAt: safeString(row?.createdAt) || now,
        createdBy: safeString(row?.createdBy),
      }))
      .filter((row) => row.date),
  }
}

export function getDailyReportsByDate(state: DailyReportState, date: string, directoryUsers: DailyDirectoryUser[]) {
  return sortDailyDirectoryUsers(
    normalizeDailyReportState(state, directoryUsers, date).reports.filter((row) => row.date === date),
  )
}

export function resolveDailyReportStatus(entry: Pick<DailyReportEntry, "reportBody" | "plannedTasks" | "submittedAt">): DailyReportStatus {
  if (safeString(entry.submittedAt)) return "complete"
  if (safeString(entry.reportBody) || safeString(entry.plannedTasks)) return "draft"
  return "empty"
}

export function countDailyReportStatus(entries: DailyReportEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      const status = resolveDailyReportStatus(entry)
      acc[status] += 1
      return acc
    },
    { complete: 0, draft: 0, empty: 0 },
  )
}

export function groupPlannedTasksByTeam(entries: DailyReportEntry[]) {
  const grouped = new Map<string, { teamName: string; teamOrder: number; items: string[] }>()

  entries.forEach((entry) => {
    const lines = safeString(entry.plannedTasks)
      .split(/\r?\n/)
      .map((line) => safeString(line).replace(/^[\-•·]\s*/, ""))
      .filter(Boolean)
    if (!lines.length) return
    const existing = grouped.get(entry.teamId) || {
      teamName: entry.teamName,
      teamOrder: entry.teamOrder,
      items: [],
    }
    existing.items.push(...lines)
    grouped.set(entry.teamId, existing)
  })

  return [...grouped.values()].sort((a, b) => a.teamOrder - b.teamOrder)
}

export function groupEntriesByTeam(entries: DailyReportEntry[]) {
  const grouped = new Map<string, { teamName: string; teamOrder: number; entries: DailyReportEntry[] }>()
  entries.forEach((entry) => {
    const existing = grouped.get(entry.teamId) || {
      teamName: entry.teamName,
      teamOrder: entry.teamOrder,
      entries: [],
    }
    existing.entries.push(entry)
    grouped.set(entry.teamId, existing)
  })
  return [...grouped.values()]
    .sort((a, b) => a.teamOrder - b.teamOrder)
    .map((group) => ({ ...group, entries: sortDailyDirectoryUsers(group.entries) }))
}

export function upsertDailyReportEntry(state: DailyReportState, entry: DailyReportEntry) {
  const nextReports = state.reports.filter((row) => !(row.date === entry.date && row.userId === entry.userId))
  nextReports.push(entry)
  return {
    ...state,
    reports: sortDailyDirectoryUsers(nextReports),
  }
}

export function upsertDailyReportSummary(
  state: DailyReportState,
  summary: DailyReportSummaryRecord,
) {
  return {
    ...state,
    aiSummaries: [
      summary,
      ...state.aiSummaries.filter((row) => row.date !== summary.date),
    ],
  }
}

export function getLatestDailySummary(state: DailyReportState, date: string) {
  return state.aiSummaries.find((row) => row.date === date)?.content || ""
}
