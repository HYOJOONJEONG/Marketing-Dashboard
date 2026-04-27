"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, UsersRound } from "lucide-react"
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
  const [draft, setDraft] = useState({ reportBody: "", plannedTasks: "" })
  const [statusMessage, setStatusMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const todayEntries = useMemo(
    () => getDailyReportsByDate(reportState, currentDate, directoryUsers),
    [reportState, currentDate, directoryUsers],
  )
  const currentEntry = useMemo(
    () => todayEntries.find((entry) => entry.userId === currentUser.id) || null,
    [todayEntries, currentUser.id],
  )
  const groupedEntries = useMemo(() => groupEntriesByTeam(todayEntries), [todayEntries])
  const previewEntries = useMemo(
    () =>
      todayEntries.map((entry) =>
        entry.userId === currentUser.id
          ? {
              ...entry,
              reportBody: draft.reportBody,
              plannedTasks: draft.plannedTasks,
            }
          : entry,
      ),
    [todayEntries, currentUser.id, draft.plannedTasks, draft.reportBody],
  )
  const previewGroupedEntries = useMemo(() => groupEntriesByTeam(previewEntries), [previewEntries])
  const previewPlannedGroups = useMemo(() => groupPlannedTasksByTeam(previewEntries), [previewEntries])
  const statusCounts = useMemo(() => countDailyReportStatus(todayEntries), [todayEntries])
  const currentEntryStatus = useMemo(
    () => resolveDailyReportStatus(currentEntry || { reportBody: "", plannedTasks: "", submittedAt: null }),
    [currentEntry],
  )
  const currentPresence = useMemo(
    () => presenceUsers.find((user) => user.userId === currentUser.id)?.status || "offline",
    [presenceUsers, currentUser.id],
  )
  const statusRef = useRef<HTMLDivElement | null>(null)
  const documentRef = useRef<HTMLDivElement | null>(null)
  const markdownDocument = useMemo(() => {
    const lines: string[] = [`# 업무일지`, `${formatDisplayDate(currentDate)}`, ""]

    previewGroupedEntries.forEach((group) => {
      lines.push(`## ${group.teamName}`)
      lines.push("")

      group.entries.forEach((entry) => {
        lines.push(`### ${entry.userName}`)
        lines.push("")
        lines.push(entry.reportBody?.trim() || "-")
        lines.push("")
        lines.push("예정사항")
        const plannedLines = splitLines(entry.plannedTasks)
        if (plannedLines.length) {
          plannedLines.forEach((line) => lines.push(`- ${line}`))
        } else {
          lines.push("- 없음")
        }
        lines.push("")
      })
    })

    lines.push("## 당일업무")
    lines.push("")
    if (previewPlannedGroups.length) {
      previewPlannedGroups.forEach((group) => {
        lines.push(`### ${group.teamName}`)
        if (group.items.length) {
          group.items.forEach((item) => lines.push(`- ${item}`))
        } else {
          lines.push("- 없음")
        }
        lines.push("")
      })
    } else {
      lines.push("- 아직 예정사항이 없습니다.")
    }

    return lines.join("\n").trim()
  }, [currentDate, previewGroupedEntries, previewPlannedGroups])

  useEffect(() => {
    setDraft({
      reportBody: currentEntry?.reportBody || "",
      plannedTasks: currentEntry?.plannedTasks || "",
    })
  }, [currentEntry?.reportBody, currentEntry?.plannedTasks])

  useEffect(() => {
    const target = focus === "status" ? statusRef.current : documentRef.current
    target?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [focus])

  async function commitReport(mode: "draft" | "submit") {
    if (!currentEntry) return
    setStatusMessage("")
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const nextEntry: DailyReportEntry = {
        ...currentEntry,
        reportBody: draft.reportBody.trim(),
        plannedTasks: draft.plannedTasks.trim(),
        submittedAt: mode === "submit" ? now : currentEntry.submittedAt,
        updatedAt: now,
      }
      const nextState = upsertDailyReportEntry(reportState, nextEntry)
      await onSaveState(nextState)
      setStatusMessage(mode === "submit" ? "업무일지를 제출했습니다." : "업무일지를 저장했습니다.")
    } catch {
      setStatusMessage("저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyDocument() {
    try {
      await navigator.clipboard.writeText(markdownDocument)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setStatusMessage("문서 복사에 실패했습니다. 다시 시도해주세요.")
    }
  }

  const myTaskCount = splitLines(draft.reportBody).length
  const myPlannedCount = splitLines(draft.plannedTasks).length

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm lg:px-8 lg:py-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                Daily Report
              </span>
              <span className="text-[12px] font-semibold text-slate-500">{formatDisplayDate(currentDate)}</span>
              {lastUpdatedText ? <span className="text-[12px] text-slate-400">Last update: {lastUpdatedText}</span> : null}
            </div>
            <h2 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-slate-950">업무일지 협업 보드</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[13px] text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${getPresenceDot(currentPresence)}`} />
                {currentUser.name}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{currentUser.role}</span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">{currentUser.teamName}</span>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                전체 {todayEntries.length}명 / 제출 {statusCounts.complete}명
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">작성중 {statusCounts.draft}명</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">미작성 {statusCounts.empty}명</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCopyDocument()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "복사됨" : "문서 복사"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:gap-8 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside ref={statusRef} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[17px] font-black tracking-[-0.04em] text-slate-950">제출 현황</div>
              <div className="mt-2 text-[12px] text-slate-500">오늘 제출 상태를 팀 순서대로 확인합니다.</div>
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
                      <div key={entry.userId} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
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
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div ref={documentRef} className="space-y-8">
          <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">업무일지 문서</div>
                <div className="mt-2 text-[12px] text-slate-500">내 입력은 위에서 바로 수정하고, 아래 문서는 팀 단위로 한 번에 복사할 수 있게 정리합니다.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">내 업무 {myTaskCount}개</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">예정사항 {myPlannedCount}개</span>
                <span className={`rounded-full border px-3 py-1.5 ${getStatusTone(currentEntryStatus)}`}>{getStatusLabel(currentEntryStatus)}</span>
              </div>
            </div>

            {statusMessage ? (
              <div className="mt-6 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-8 space-y-6">
              {currentEntry ? (
                <div className="rounded-[24px] border border-blue-100 bg-blue-50/30 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">{currentUser.name}</div>
                      <div className="mt-1 text-[12px] text-slate-500">{currentUser.teamName} · 맨 위에서 바로 작성합니다.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(currentEntryStatus)}`}>
                        {getStatusLabel(currentEntryStatus)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                        업무 {myTaskCount} · 예정 {myPlannedCount}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2.5">
                      <span className="text-[12px] font-semibold text-slate-500">업무일지 본문</span>
                      <textarea
                        value={draft.reportBody}
                        onChange={(event) => setDraft((prev) => ({ ...prev, reportBody: event.target.value }))}
                        rows={6}
                        className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-[14px] leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        placeholder="금일 진행한 업무를 입력해주세요."
                      />
                    </label>
                    <label className="grid gap-2.5">
                      <span className="text-[12px] font-semibold text-slate-500">예정사항</span>
                      <textarea
                        value={draft.plannedTasks}
                        onChange={(event) => setDraft((prev) => ({ ...prev, plannedTasks: event.target.value }))}
                        rows={4}
                        className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-[14px] leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        placeholder="내일 예정 업무 또는 follow-up을 입력해주세요."
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => void commitReport("draft")}
                        disabled={isSaving}
                        className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        임시저장
                      </button>
                      <button
                        type="button"
                        onClick={() => void commitReport("submit")}
                        disabled={isSaving}
                        className="inline-flex h-10 items-center rounded-2xl bg-blue-600 px-4 text-[13px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {isSaving ? "저장 중..." : "제출 완료"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">팀 문서 미리보기</div>
                    <div className="mt-1 text-[12px] text-slate-500">마크다운 문서처럼 정리된 형태라 그대로 복사해서 전달하기 좋습니다.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyDocument()}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "복사됨" : "전체 복사"}
                  </button>
                </div>
                <pre className="mt-5 overflow-x-auto rounded-[22px] border border-slate-200 bg-white px-5 py-5 text-[13px] leading-7 text-slate-800">{markdownDocument}</pre>
              </div>
            </div>
          </section>
        </div>

      </section>
    </div>
  )
}
