"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, FileText, UsersRound } from "lucide-react"
import {
  countDailyReportStatus,
  DailyDirectoryUser,
  DailyReportEntry,
  DailyReportState,
  getDailyReportsByDate,
  groupEntriesByTeam,
  groupPlannedTasksByTeam,
  resolveDailyReportStatus,
  upsertDailyReportEntry,
} from "@/lib/daily-report"

type PresenceUser = {
  userId: string
  userName: string
  teamName: string
  status: "online" | "away" | "offline"
}

type Props = {
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
  }
  directoryUsers: DailyDirectoryUser[]
  reportState: DailyReportState
  currentDate: string
  focus?: "today" | "status"
  lastUpdatedText?: string
  presenceUsers?: PresenceUser[]
  onSaveState: (nextState: DailyReportState) => Promise<void> | void
}

type MobileDailySection = "write" | "status" | "docs"

function getSeoulNow() {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utcMs + 9 * 60 * 60 * 1000)
}

function getTimeUntilSeoulMidnight() {
  const seoulNow = getSeoulNow()
  const nextMidnight = new Date(seoulNow.getTime())
  nextMidnight.setUTCHours(24, 0, 0, 0)
  const diffMs = Math.max(0, nextMidnight.getTime() - seoulNow.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
}

function getStatusTone(status: ReturnType<typeof resolveDailyReportStatus>) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-rose-200 bg-rose-50 text-rose-700"
}

function getStatusDot(status: ReturnType<typeof resolveDailyReportStatus>) {
  if (status === "complete") return "bg-emerald-500"
  if (status === "draft") return "bg-amber-400"
  return "bg-rose-500"
}

function getStatusLabel(status: ReturnType<typeof resolveDailyReportStatus>) {
  if (status === "complete") return "완료"
  if (status === "draft") return "작성중"
  return "미작성"
}

function getStatusWithEmoji(status: ReturnType<typeof resolveDailyReportStatus>) {
  if (status === "complete") return "🟢 제출완료"
  if (status === "draft") return "🟡 작성중"
  return "🔴 미작성"
}

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T09:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed)
}

function formatReportDate(date: string) {
  const parsed = new Date(`${date}T09:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(parsed)
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${String(parsed.getDate()).padStart(2, "0")}(${weekday})`
}

function splitLines(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function getPresenceDot(status: PresenceUser["status"]) {
  if (status === "online") return "bg-emerald-500"
  if (status === "away") return "bg-amber-400"
  return "bg-slate-300"
}

function isEmployeeUpdateName(name: string) {
  return String(name || "").trim() === "직원동정"
}

function isMajorWorkName(name: string) {
  return String(name || "").trim() === "일일 주요 업무"
}

function getDailyDocumentSectionTitle(teamName: string) {
  if (teamName === "본부") return ""
  return `<${teamName}>`
}

function buildTeamClipboardDocument(
  departmentTitle: string,
  date: string,
  groupedEntries: Array<{ teamName: string; entries: DailyReportEntry[] }>,
  _plannedSummary: Array<{ label: string; items: string[] }>,
  majorContent?: string,
  _employeeUpdate?: string,
) {
  const lines: string[] = [`${departmentTitle} 일일 업무보고`, `${formatReportDate(date)}`, "", "<일일 주요 업무>", majorContent?.trim() || "-", ""]

  groupedEntries.forEach((group) => {
    const sectionTitle = getDailyDocumentSectionTitle(group.teamName)
    if (sectionTitle) {
      lines.push(sectionTitle)
      lines.push("")
    }

    group.entries.forEach((entry) => {
      lines.push(`<${entry.userName}>`)
      lines.push(entry.reportBody?.trim() || "-")
      lines.push("")
    })
  })

  return lines.join("\n").trim()
}

function buildPlannedSummary(groups: Array<{ label: string; items: string[] }>) {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => item.trim()).filter(Boolean),
  }))
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatMultilineHtml(value: string) {
  const safe = escapeHtml(value || "-")
  return safe.replace(/\r?\n/g, "<br />")
}

function buildDailyWordHtml(
  departmentTitle: string,
  date: string,
  groupedEntries: Array<{ teamName: string; entries: DailyReportEntry[] }>,
  plannedSummary: Array<{ label: string; items: string[] }>,
  majorContent?: string,
  employeeUpdate?: string,
) {
  const sections = groupedEntries
    .map((group) => {
      const entriesHtml = group.entries
        .map(
          (entry) => `
            <div class="entry">
              <div class="entry-name">&lt;${escapeHtml(entry.userName)}&gt;</div>
              <div class="entry-body">${formatMultilineHtml(entry.reportBody || "-")}</div>
            </div>
          `,
        )
        .join("")

      const sectionTitle = getDailyDocumentSectionTitle(group.teamName)
      return `
        <section class="team-section">
          ${sectionTitle ? `<div class="team-title" style="margin:0 0 12px; font-size:10pt; font-weight:700; text-decoration:underline;"><strong><u>${escapeHtml(sectionTitle)}</u></strong></div>` : ""}
          ${entriesHtml}
        </section>
      `
    })
    .join("")

  const plannedHtml = plannedSummary.length
    ? plannedSummary
        .map(
          (group) =>
            `<div class="planned-line">${escapeHtml(group.label)} : ${escapeHtml(group.items.length ? group.items.join(", ") : "없음")}</div>`,
        )
        .join("")
    : `<div class="planned-line">당일업무 : 없음</div>`

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(departmentTitle)} 일일 업무보고</title>
    <style>
      body {
        font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        margin: 0;
        padding: 34px 42px;
        color: #0f172a;
        line-height: 1.68;
        font-size: 10pt;
        background: #ffffff;
      }
      .page {
        max-width: 760px;
        margin: 0 auto;
      }
      .header {
        margin-bottom: 24px;
      }
      .date {
        margin-top: 8px;
        text-align: right;
        font-size: 10pt;
        color: #334155;
      }
      .team-section {
        margin-top: 26px;
      }
      .entry {
        margin-bottom: 14px;
      }
      .entry-name {
        margin-bottom: 4px;
        font-weight: 700;
      }
      .entry-body {
        white-space: normal;
      }
      .planned-block {
        margin-top: 28px;
        padding-top: 14px;
      }
      .major-block {
        margin-top: 8px;
      }
      .major-title,
      .planned-title {
        margin: 0 0 8px;
        font-size: 10pt;
        font-weight: 700;
        text-decoration: underline;
      }
      .planned-line {
        margin-bottom: 4px;
      }
      .employee-block {
        margin-top: 10px;
      }
      .employee-title {
        margin: 0 0 6px;
        font-size: 10pt;
        font-weight: 700;
        text-decoration: underline;
      }
    </style>
  </head>
  <body style="font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; font-size: 10pt; mso-bidi-font-size: 10.0pt;">
    <div class="page">
      <div class="header">
        <div style="margin:0; text-align:center; font-size:10pt; font-weight:700;">${escapeHtml(departmentTitle)} 일일 업무보고</div>
        <div class="date" style="margin-top:8px; text-align:right; font-size:10pt; color:#334155;">${escapeHtml(formatReportDate(date))}</div>
      </div>
      <section class="major-block">
        <div class="major-title" style="margin:0 0 8px; font-size:10pt; font-weight:700; text-decoration:underline;"><strong><u>&lt;일일 주요 업무&gt;</u></strong></div>
        <div style="font-size:10pt;">${formatMultilineHtml(majorContent?.trim() || "-")}</div>
      </section>
      ${sections}
      <section class="planned-block">
        <div class="planned-title" style="margin:0 0 8px; font-size:10pt; font-weight:700; text-decoration:underline;"><strong><u>&lt;당일업무&gt;</u></strong></div>
        ${plannedHtml}
        <div class="employee-block">
        <div class="employee-title" style="margin:0 0 6px; font-size:10pt; font-weight:700; text-decoration:underline;"><strong><u>&lt;직원동정&gt;</u></strong></div>
        <div style="font-size:10pt;">${formatMultilineHtml(employeeUpdate?.trim() || "-")}</div>
      </div>
      </section>
    </div>
  </body>
</html>`
}

export function DailyReportPage({
  currentUser,
  directoryUsers,
  reportState,
  currentDate,
  focus = "today",
  lastUpdatedText,
  presenceUsers = [],
  onSaveState,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id)
  const [draft, setDraft] = useState({ reportBody: "", plannedTasks: "" })
  const [statusMessage, setStatusMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [copiedTarget, setCopiedTarget] = useState<"team1" | "team2" | null>(null)
  const [mobileSection, setMobileSection] = useState<MobileDailySection>("write")
  const [timeUntilReset, setTimeUntilReset] = useState(() => getTimeUntilSeoulMidnight())

  const todayEntries = useMemo(
    () => getDailyReportsByDate(reportState, currentDate, directoryUsers),
    [reportState, currentDate, directoryUsers],
  )
  const countableEntries = useMemo(
    () => todayEntries.filter((entry) => entry.userName !== "기타"),
    [todayEntries],
  )
  const selectedEntry = useMemo(
    () => todayEntries.find((entry) => entry.userId === selectedUserId) || null,
    [todayEntries, selectedUserId],
  )
  const groupedEntries = useMemo(
    () => groupEntriesByTeam(todayEntries.filter((entry) => entry.userName !== "기타")),
    [todayEntries],
  )
  const previewEntries = useMemo(
      () =>
        todayEntries.map((entry) =>
          entry.userId === selectedUserId
            ? {
              ...entry,
              reportBody: draft.reportBody,
              plannedTasks: draft.plannedTasks,
            }
          : entry,
      ),
    [todayEntries, selectedUserId, draft.plannedTasks, draft.reportBody],
  )
  const submittedPreviewEntries = useMemo(
    () => todayEntries.filter((entry) => resolveDailyReportStatus(entry) === "complete"),
    [todayEntries],
  )
  const previewTeamOneEntries = useMemo(
    () => submittedPreviewEntries.filter((entry) => (entry.teamName === "본부" || entry.teamName === "인포Biz1팀") && !isMajorWorkName(entry.userName)),
    [submittedPreviewEntries],
  )
  const previewTeamTwoEntries = useMemo(
    () => submittedPreviewEntries.filter((entry) => entry.teamName === "인포Biz2팀" && !isEmployeeUpdateName(entry.userName)),
    [submittedPreviewEntries],
  )
  const previewEmployeeUpdateEntry = useMemo(
    () => submittedPreviewEntries.find((entry) => entry.teamName === "인포Biz2팀" && isEmployeeUpdateName(entry.userName)) || null,
    [submittedPreviewEntries],
  )
  const previewMajorEntry = useMemo(
    () => submittedPreviewEntries.find((entry) => entry.teamName === "본부" && isMajorWorkName(entry.userName)) || null,
    [submittedPreviewEntries],
  )
  const previewTeamOneGroupedEntries = useMemo(() => groupEntriesByTeam(previewTeamOneEntries), [previewTeamOneEntries])
  const previewTeamTwoGroupedEntries = useMemo(() => groupEntriesByTeam(previewTeamTwoEntries), [previewTeamTwoEntries])
  const previewAllGroupedEntries = useMemo(
    () => groupEntriesByTeam(submittedPreviewEntries.filter((entry) => !isEmployeeUpdateName(entry.userName) && !isMajorWorkName(entry.userName))),
    [submittedPreviewEntries],
  )
  const previewTeamOnePlannedGroups = useMemo(() => groupPlannedTasksByTeam(previewTeamOneEntries), [previewTeamOneEntries])
  const previewTeamTwoPlannedGroups = useMemo(() => groupPlannedTasksByTeam(previewTeamTwoEntries), [previewTeamTwoEntries])
  const previewTeamOnePlannedSummary = useMemo(
    () =>
      buildPlannedSummary([
        {
          label: "인포Biz1팀",
          items: previewTeamOnePlannedGroups.flatMap((group) => group.items),
        },
      ]),
    [previewTeamOnePlannedGroups],
  )
  const previewTeamTwoPlannedSummary = useMemo(
    () =>
      buildPlannedSummary([
        {
          label: "인포Biz2팀",
          items: previewTeamTwoPlannedGroups.flatMap((group) => group.items),
        },
      ]),
    [previewTeamTwoPlannedGroups],
  )
  const previewHeadquartersPlannedSummary = useMemo(
    () =>
      buildPlannedSummary([
        {
          label: "인포Biz1팀",
          items: previewTeamOnePlannedGroups.flatMap((group) => group.items),
        },
        {
          label: "인포Biz2팀",
          items: previewTeamTwoPlannedGroups.flatMap((group) => group.items),
        },
      ]),
    [previewTeamOnePlannedGroups, previewTeamTwoPlannedGroups],
  )
  const statusCounts = useMemo(() => countDailyReportStatus(countableEntries), [countableEntries])
  const selectedEntryStatus = useMemo(
    () => resolveDailyReportStatus(selectedEntry || { reportBody: "", plannedTasks: "", submittedAt: null, statusOverride: null }),
    [selectedEntry],
  )
  const isSelectedEmployeeUpdate = useMemo(
    () => isEmployeeUpdateName(selectedEntry?.userName || ""),
    [selectedEntry?.userName],
  )
  const isSelectedMajorWork = useMemo(
    () => isMajorWorkName(selectedEntry?.userName || ""),
    [selectedEntry?.userName],
  )
  const currentPresence = useMemo(
    () => presenceUsers.find((user) => user.userId === currentUser.id)?.status || "offline",
    [presenceUsers, currentUser.id],
  )
  const selectedDirectoryUser = useMemo(
    () => directoryUsers.find((user) => user.id === selectedUserId) || null,
    [directoryUsers, selectedUserId],
  )
  const statusRef = useRef<HTMLDivElement | null>(null)
  const documentRef = useRef<HTMLDivElement | null>(null)
  const teamOneDocument = useMemo(
    () => buildTeamClipboardDocument("인포Biz본부", currentDate, previewTeamOneGroupedEntries, previewTeamOnePlannedSummary, previewMajorEntry?.reportBody || ""),
    [currentDate, previewMajorEntry?.reportBody, previewTeamOneGroupedEntries, previewTeamOnePlannedSummary],
  )
  const teamTwoDocument = useMemo(
    () =>
        buildTeamClipboardDocument(
          "인포Biz본부",
          currentDate,
          previewTeamTwoGroupedEntries,
          previewTeamTwoPlannedSummary,
          "",
          previewEmployeeUpdateEntry?.reportBody || "",
        ),
    [currentDate, previewEmployeeUpdateEntry?.reportBody, previewTeamTwoGroupedEntries, previewTeamTwoPlannedSummary],
  )
  const headquartersWordHtml = useMemo(
    () =>
        buildDailyWordHtml(
          "인포Biz본부",
          currentDate,
          previewAllGroupedEntries,
          previewHeadquartersPlannedSummary,
          previewMajorEntry?.reportBody || "",
          previewEmployeeUpdateEntry?.reportBody || "",
        ),
    [currentDate, previewAllGroupedEntries, previewEmployeeUpdateEntry?.reportBody, previewHeadquartersPlannedSummary, previewMajorEntry?.reportBody],
  )

  useEffect(() => {
    if (!todayEntries.some((entry) => entry.userId === selectedUserId)) {
      setSelectedUserId(currentUser.id)
    }
  }, [currentUser.id, selectedUserId, todayEntries])

  useEffect(() => {
    setDraft({
      reportBody: selectedEntry?.reportBody || "",
      plannedTasks: selectedEntry?.plannedTasks || "",
    })
  }, [selectedEntry?.reportBody, selectedEntry?.plannedTasks, selectedUserId])

  useEffect(() => {
    const target = focus === "status" ? statusRef.current : documentRef.current
    setMobileSection(focus === "status" ? "status" : "write")
    target?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [focus])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextDateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())
      if (nextDateKey !== currentDate) {
        window.location.reload()
      }
    }, 60000)

    return () => window.clearInterval(timer)
  }, [currentDate])

  useEffect(() => {
    setTimeUntilReset(getTimeUntilSeoulMidnight())
    const timer = window.setInterval(() => {
      setTimeUntilReset(getTimeUntilSeoulMidnight())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  async function commitReport(mode: "draft" | "submit") {
    if (!selectedEntry) return
    setStatusMessage("")
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
        const nextEntry: DailyReportEntry = {
          ...selectedEntry,
          reportBody: draft.reportBody.trim(),
          plannedTasks: draft.plannedTasks.trim(),
          submittedAt: mode === "submit" ? now : null,
          statusOverride: mode === "submit" ? null : null,
          updatedAt: now,
        }
      const nextState = upsertDailyReportEntry(reportState, nextEntry)
      await onSaveState(nextState)
      setStatusMessage(mode === "submit" ? `${nextEntry.userName} 업무일지를 제출했습니다.` : `${nextEntry.userName} 업무일지를 저장했습니다.`)
    } catch {
      setStatusMessage("저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelSubmission() {
    if (!selectedEntry) return
    setStatusMessage("")
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const nextEntry: DailyReportEntry = {
        ...selectedEntry,
        submittedAt: null,
        statusOverride: "empty",
        updatedAt: now,
      }
      const nextState = upsertDailyReportEntry(reportState, nextEntry)
      await onSaveState(nextState)
      setStatusMessage(`${nextEntry.userName} 업무일지 제출을 취소했습니다.`)
    } catch {
      setStatusMessage("제출 취소 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyDocument(target: "team1" | "team2") {
    try {
      await navigator.clipboard.writeText(target === "team1" ? teamOneDocument : teamTwoDocument)
      setCopiedTarget(target)
      window.setTimeout(() => setCopiedTarget((current) => (current === target ? null : current)), 1800)
    } catch {
      setStatusMessage("문서 복사에 실패했습니다. 다시 시도해주세요.")
    }
  }

  function handleDownloadHeadquartersWord() {
    try {
      const blob = new Blob(["\ufeff", headquartersWordHtml], {
        type: "application/msword;charset=utf-8",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const compactDate = currentDate.replace(/-/g, "")
      anchor.href = url
      anchor.download = `인포Biz본부_일일업무보고_${compactDate}.doc`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setStatusMessage("Word 파일 생성에 실패했습니다. 다시 시도해주세요.")
    }
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm lg:px-6 lg:py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                Daily Report
              </span>
              <span className="text-[12px] font-semibold text-slate-500">{formatDisplayDate(currentDate)}</span>
            </div>
            <h2 className="mt-2 text-[20px] font-black tracking-[-0.04em] text-slate-950">데일리 업무일지</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                <span className={`h-2.5 w-2.5 rounded-full ${getPresenceDot(currentPresence)}`} />
                {currentUser.name}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{currentUser.role}</span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-700">{currentUser.teamName}</span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-slate-500">
              매일 자정 초기화 됩니다 (남은시간 : {timeUntilReset})
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadHeadquartersWord}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-3.5 text-[13px] font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 sm:w-auto"
              >
                <FileText className="h-4 w-4" />
                본부 전체 Word
              </button>
          </div>
        </div>
      </section>

      <section className="xl:hidden">
        <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileSection("write")}
            className={`rounded-2xl px-3 py-3 text-[13px] font-bold transition ${
              mobileSection === "write" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"
            }`}
          >
            작성
          </button>
          <button
            type="button"
            onClick={() => setMobileSection("status")}
            className={`rounded-2xl px-3 py-3 text-[13px] font-bold transition ${
              mobileSection === "status" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"
            }`}
          >
            제출현황
          </button>
          <button
            type="button"
            onClick={() => setMobileSection("docs")}
            className={`rounded-2xl px-3 py-3 text-[13px] font-bold transition ${
              mobileSection === "docs" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"
            }`}
          >
            팀문서
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:gap-8 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          ref={statusRef}
          className={`${mobileSection === "status" ? "block" : "hidden"} order-2 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:order-1 xl:block`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[17px] font-black tracking-[-0.04em] text-slate-950">제출 현황</div>
              <div className="mt-1 text-[12px] text-slate-500">
                작성대상 {countableEntries.length}건 · 미작성 {statusCounts.empty}건
              </div>
            </div>
            <UsersRound className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-6 space-y-7">
            {groupedEntries.map((group) => (
              <div key={group.teamName} className="space-y-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.teamName}</div>
                <div className="space-y-4">
                  {group.entries.map((entry) => {
                    const status = resolveDailyReportStatus(entry)
                    const presence = presenceUsers.find((user) => user.userId === entry.userId)?.status || "offline"
                    return (
                      <button
                        key={entry.userId}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(entry.userId)
                          setMobileSection("write")
                        }}
                        className={`w-full rounded-[20px] border px-4 py-3.5 text-left transition ${
                          selectedUserId === entry.userId ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot(status)}`} />
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold tracking-[-0.03em] text-slate-900">{entry.userName}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                              <span>{getStatusWithEmoji(status)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${getPresenceDot(presence)}`} />
                                {presence === "online" ? "온라인" : presence === "away" ? "자리비움" : "오프라인"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div ref={documentRef} className="order-1 space-y-8 xl:order-2">
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">업무일지 문서</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                <span className={`rounded-full border px-3 py-1.5 ${getStatusTone(selectedEntryStatus)}`}>{getStatusLabel(selectedEntryStatus)}</span>
              </div>
            </div>

            {statusMessage ? (
              <div className="mt-6 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-8 space-y-6">
              {selectedEntry ? (
                <div className={`${mobileSection === "write" ? "block" : "hidden"} rounded-[24px] border border-blue-100 bg-blue-50/30 p-5 sm:p-6 xl:block`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">{selectedEntry.userName}</div>
                      <div className="mt-1 text-[12px] text-slate-500">{selectedDirectoryUser?.teamName || selectedEntry.teamName}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(selectedEntryStatus)}`}>
                        {getStatusLabel(selectedEntryStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4">
                      <label className="grid gap-2.5">
                        <span className="text-[12px] font-semibold text-slate-500">
                          {isSelectedEmployeeUpdate ? "직원동정 내용" : isSelectedMajorWork ? "일일 주요 업무" : "업무일지 본문"}
                        </span>
                        <textarea
                          value={draft.reportBody}
                          onChange={(event) => setDraft((prev) => ({ ...prev, reportBody: event.target.value }))}
                          rows={12}
                          className="min-h-[380px] w-full rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-[14px] leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:min-h-[320px]"
                          placeholder={isSelectedEmployeeUpdate ? "직원동정 내용을 입력해주세요." : isSelectedMajorWork ? "일일 주요 업무를 입력해주세요." : "금일 진행한 업무를 입력해주세요."}
                        />
                      </label>
                      {!isSelectedEmployeeUpdate && !isSelectedMajorWork ? <label className="grid gap-2.5">
                        <span className="text-[12px] font-semibold text-slate-500">예정사항</span>
                        <textarea
                          value={draft.plannedTasks}
                        onChange={(event) => setDraft((prev) => ({ ...prev, plannedTasks: event.target.value }))}
                        rows={1}
                        className="min-h-[56px] w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-[14px] leading-6 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        placeholder="내일 예정 업무 또는 follow-up을 입력해주세요."
                      />
                    </label> : null}
                    <div className="sticky bottom-3 z-10 -mx-1 mt-2 flex flex-col gap-2 rounded-[22px] border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                      <button
                        type="button"
                        onClick={() => void commitReport("draft")}
                        disabled={isSaving}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:h-10"
                      >
                        임시저장
                      </button>
                      <button
                        type="button"
                        onClick={() => void commitReport("submit")}
                        disabled={isSaving}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-[13px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:h-10"
                      >
                        {isSaving ? "저장 중..." : "제출 완료"}
                      </button>
                      {selectedEntryStatus === "complete" ? (
                        <button
                          type="button"
                          onClick={() => void handleCancelSubmission()}
                          disabled={isSaving}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-[13px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 sm:h-10"
                        >
                          제출취소
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={`${mobileSection === "docs" ? "block" : "hidden"} rounded-[24px] border border-slate-200 bg-slate-50/50 p-5 sm:p-6 xl:block`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">팀 문서 미리보기</div>
                </div>
                <div className="mt-5 grid gap-4 lg:gap-5 xl:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-black tracking-[-0.03em] text-slate-950">1팀 문서</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyDocument("team1")}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        {copiedTarget === "team1" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTarget === "team1" ? "복사됨" : "1팀 복사"}
                      </button>
                    </div>
                    <div className="mt-4 max-h-[420px] overflow-auto rounded-[18px] border border-slate-200 bg-white px-5 py-5 sm:max-h-[520px]">
                      <div className="text-center text-[16px] font-black text-slate-950">인포Biz본부 일일 업무보고</div>
                      <div className="mt-2 text-right text-[12px] text-slate-500">{formatReportDate(currentDate)}</div>
                      <div className="mt-5 space-y-5 text-[12px] leading-6 text-slate-800">
                        <div className="space-y-1.5">
                          <div className="font-black underline decoration-slate-400 underline-offset-4 text-slate-950">&lt;일일 주요 업무&gt;</div>
                          <div className="text-slate-700">-</div>
                        </div>
                        {previewTeamOneGroupedEntries.map((group) => (
                          <div key={group.teamName}>
                            {getDailyDocumentSectionTitle(group.teamName) ? (
                              <div className="font-black underline decoration-slate-400 underline-offset-4 text-slate-950">{getDailyDocumentSectionTitle(group.teamName)}</div>
                            ) : null}
                            <div className={`${getDailyDocumentSectionTitle(group.teamName) ? "mt-2" : ""} space-y-3`}>
                              {group.entries.map((entry) => (
                                <div key={`${group.teamName}-${entry.userId}`} className="space-y-1.5">
                                  <div className="font-bold text-slate-900">&lt;{entry.userName}&gt;</div>
                                  <div className="whitespace-pre-wrap text-slate-700">{entry.reportBody || "-"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-4">
                          <div className="font-bold underline decoration-slate-400 underline-offset-4 text-slate-900">&lt;당일업무&gt;</div>
                          <div className="mt-2 whitespace-pre-wrap text-slate-700">
                            {previewTeamOnePlannedSummary.length
                              ? previewTeamOnePlannedSummary.map((group) => `${group.label} : ${group.items.join(", ")}`).join("\n")
                              : "인포Biz1팀 : 없음"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-black tracking-[-0.03em] text-slate-950">2팀 문서</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyDocument("team2")}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        {copiedTarget === "team2" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTarget === "team2" ? "복사됨" : "2팀 복사"}
                      </button>
                    </div>
                    <div className="mt-4 max-h-[420px] overflow-auto rounded-[18px] border border-slate-200 bg-white px-5 py-5 sm:max-h-[520px]">
                      <div className="text-center text-[16px] font-black text-slate-950">인포Biz본부 일일 업무보고</div>
                      <div className="mt-2 text-right text-[12px] text-slate-500">{formatReportDate(currentDate)}</div>
                      <div className="mt-5 space-y-5 text-[12px] leading-6 text-slate-800">
                        <div className="space-y-1.5">
                          <div className="font-black underline decoration-slate-400 underline-offset-4 text-slate-950">&lt;일일 주요 업무&gt;</div>
                          <div className="whitespace-pre-wrap text-slate-700">{previewMajorEntry?.reportBody?.trim() || "-"}</div>
                        </div>
                        {previewTeamTwoGroupedEntries.map((group) => (
                          <div key={group.teamName}>
                            {getDailyDocumentSectionTitle(group.teamName) ? (
                              <div className="font-black underline decoration-slate-400 underline-offset-4 text-slate-950">{getDailyDocumentSectionTitle(group.teamName)}</div>
                            ) : null}
                            <div className={`${getDailyDocumentSectionTitle(group.teamName) ? "mt-2" : ""} space-y-3`}>
                              {group.entries.map((entry) => (
                                <div key={`${group.teamName}-${entry.userId}`} className="space-y-1.5">
                                  <div className="font-bold text-slate-900">&lt;{entry.userName}&gt;</div>
                                  <div className="whitespace-pre-wrap text-slate-700">{entry.reportBody || "-"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-4">
                          <div className="font-bold underline decoration-slate-400 underline-offset-4 text-slate-900">&lt;당일업무&gt;</div>
                          <div className="mt-2 whitespace-pre-wrap text-slate-700">
                            {previewTeamTwoPlannedSummary.length
                              ? previewTeamTwoPlannedSummary.map((group) => `${group.label} : ${group.items.join(", ")}`).join("\n")
                              : "인포Biz2팀 : 없음"}
                          </div>
                          <div className="mt-4 border-t border-slate-200 pt-4">
                            <div className="font-bold underline decoration-slate-400 underline-offset-4 text-slate-900">&lt;직원동정&gt;</div>
                            <div className="mt-2 whitespace-pre-wrap text-slate-700">{previewEmployeeUpdateEntry?.reportBody?.trim() || "-"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

      </section>
    </div>
  )
}
