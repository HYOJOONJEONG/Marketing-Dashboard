"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Clock3, FileDown, FileText, UsersRound } from "lucide-react"
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

type DailyViewMode = "original" | "team" | "division"

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
  const [viewMode, setViewMode] = useState<DailyViewMode>("original")
  const [statusMessage, setStatusMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const todayEntries = useMemo(
    () => getDailyReportsByDate(reportState, currentDate, directoryUsers),
    [reportState, currentDate, directoryUsers],
  )
  const currentEntry = useMemo(
    () => todayEntries.find((entry) => entry.userId === currentUser.id) || null,
    [todayEntries, currentUser.id],
  )
  const groupedEntries = useMemo(() => groupEntriesByTeam(todayEntries), [todayEntries])
  const plannedGroups = useMemo(() => groupPlannedTasksByTeam(todayEntries), [todayEntries])
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
  const otherGroupedEntries = useMemo(
    () =>
      groupedEntries
        .map((group) => ({
          ...group,
          entries: group.entries.filter((entry) => entry.userId !== currentUser.id),
        }))
        .filter((group) => group.entries.length > 0),
    [groupedEntries, currentUser.id],
  )

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

  const myTaskCount = splitLines(currentEntry?.reportBody || "").length
  const myPlannedCount = splitLines(currentEntry?.plannedTasks || "").length

  return (
    <div className="space-y-10 lg:space-y-12">
      <section className="rounded-[32px] border border-slate-200 bg-white px-8 py-8 shadow-sm lg:px-10 lg:py-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                Daily Report
              </span>
              <span className="text-[12px] font-semibold text-slate-500">{formatDisplayDate(currentDate)}</span>
              {lastUpdatedText ? <span className="text-[12px] text-slate-400">Last update: {lastUpdatedText}</span> : null}
            </div>
            <h2 className="mt-4 text-[28px] font-black tracking-[-0.04em] text-slate-950">업무일지 협업 보드</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${getPresenceDot(currentPresence)}`} />
                {currentUser.name}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{currentUser.role}</span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">{currentUser.teamName}</span>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                전체 {todayEntries.length}명 / 제출 {statusCounts.complete}명
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.alert("PDF 다운로드는 다음 단계에서 연결됩니다.")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => window.alert("Word 다운로드는 다음 단계에서 연결됩니다.")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              Word
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:gap-8 lg:grid-cols-2">
        <div className="rounded-[30px] border border-slate-200 bg-white px-8 py-8 shadow-sm lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-slate-500">전체 제출 현황</div>
              <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-slate-950">
                {statusCounts.complete} / {todayEntries.length}
              </div>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="text-[12px] font-semibold text-slate-500">완료</div>
              <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">{statusCounts.complete}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="text-[12px] font-semibold text-slate-500">작성중</div>
              <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">{statusCounts.draft}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="text-[12px] font-semibold text-slate-500">미작성</div>
              <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">{statusCounts.empty}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white px-8 py-8 shadow-sm lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-slate-500">내 업무</div>
              <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-slate-950">{myTaskCount}</div>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="text-[12px] font-semibold text-slate-500">업무일지 항목</div>
              <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">{myTaskCount}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="text-[12px] font-semibold text-slate-500">예정사항 항목</div>
              <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">{myPlannedCount}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white px-8 py-8 shadow-sm lg:col-span-2 lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-slate-500">내 작성 상태</div>
              <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-slate-950">{getStatusLabel(currentEntryStatus)}</div>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-7 rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5">
            <div className="text-[12px] font-semibold text-slate-500">현재 안내</div>
            <div className="mt-2 text-[16px] font-bold tracking-[-0.03em] text-slate-900">
              {currentEntry?.submittedAt ? "오늘 제출이 완료되었습니다." : "작성 후 제출 완료를 눌러 팀 취합에 반영해주세요."}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:gap-8 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside ref={statusRef} className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">제출 현황</div>
              <div className="mt-2 text-[12px] text-slate-500">오늘 제출 상태를 팀 순서대로 확인합니다.</div>
            </div>
            <UsersRound className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-8 space-y-8">
            {groupedEntries.map((group) => (
              <div key={group.teamName} className="space-y-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.teamName}</div>
                <div className="space-y-4">
                  {group.entries.map((entry) => {
                    const status = resolveDailyReportStatus(entry)
                    const presence = presenceUsers.find((user) => user.userId === entry.userId)?.status || "offline"
                    return (
                      <div key={entry.userId} className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4">
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
          <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm lg:p-9">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">업무일지 문서</div>
                <div className="mt-2 text-[12px] text-slate-500">원문, 팀 요약, 본부 요약을 흐름에 맞게 나눠서 봅니다.</div>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["original", "원문"],
                  ["team", "팀 요약"],
                  ["division", "본부 요약"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value as DailyViewMode)}
                    className={`rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                      viewMode === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {statusMessage ? (
              <div className="mt-8 rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4 text-[13px] text-slate-700">
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-10 space-y-10">
              {viewMode === "original" ? (
                <>
                  {currentEntry ? (
                    <div className="rounded-[26px] border border-blue-100 bg-blue-50/40 p-7 lg:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[17px] font-black tracking-[-0.03em] text-slate-950">{currentUser.name}</div>
                          <div className="mt-2 text-[12px] text-slate-500">{currentUser.teamName} · 오늘 가장 먼저 작성할 수 있도록 맨 위에 고정됩니다.</div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(currentEntryStatus)}`}>
                          {getStatusLabel(currentEntryStatus)}
                        </span>
                      </div>
                      <div className="mt-7 grid gap-6">
                        <label className="grid gap-3">
                          <span className="text-[12px] font-semibold text-slate-500">업무일지 본문</span>
                          <textarea
                            value={draft.reportBody}
                            onChange={(event) => setDraft((prev) => ({ ...prev, reportBody: event.target.value }))}
                            rows={7}
                            className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-5 text-[14px] leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                            placeholder="금일 진행한 업무를 입력해주세요."
                          />
                        </label>
                        <label className="grid gap-3">
                          <span className="text-[12px] font-semibold text-slate-500">예정사항</span>
                          <textarea
                            value={draft.plannedTasks}
                            onChange={(event) => setDraft((prev) => ({ ...prev, plannedTasks: event.target.value }))}
                            rows={6}
                            className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-5 text-[14px] leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                            placeholder="내일 예정 업무 또는 follow-up을 입력해주세요."
                          />
                        </label>
                        <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
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

                  {otherGroupedEntries.map((group) => (
                  <div key={group.teamName} className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-7 lg:p-8">
                    <div className="text-[17px] font-black tracking-[-0.03em] text-slate-950">{group.teamName}</div>
                    <div className="mt-8 space-y-6">
                      {group.entries.map((entry) => {
                        const status = resolveDailyReportStatus(entry)
                        return (
                          <div key={entry.userId} className="rounded-[24px] border border-slate-200 bg-white p-7 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="text-[15px] font-black tracking-[-0.03em] text-slate-950">{entry.userName}</div>
                                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(status)}`}>
                                  {getStatusLabel(status)}
                                </span>
                              </div>
                              {entry.submittedAt ? (
                                <div className="text-[11px] text-slate-400">제출 {new Date(entry.submittedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
                              ) : null}
                            </div>

                            <div className="mt-7 grid gap-5">
                              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                                <div className="text-[11px] font-semibold text-slate-500">업무일지 본문</div>
                                <div className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-slate-800">
                                  {entry.reportBody || "아직 작성된 내용이 없습니다."}
                                </div>
                              </div>
                              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                                <div className="text-[11px] font-semibold text-slate-500">예정사항</div>
                                <div className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-slate-800">
                                  {entry.plannedTasks || "아직 예정사항이 없습니다."}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  ))}
                </>
              ) : null}

              {viewMode === "team" ? (
                groupedEntries.map((group) => (
                  <div key={group.teamName} className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-7 lg:p-8">
                    <div className="text-[17px] font-black tracking-[-0.03em] text-slate-950">{group.teamName}</div>
                    <div className="mt-8 grid gap-5">
                      {group.entries.map((entry) => (
                        <div key={entry.userId} className="rounded-[24px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
                          <div className="text-[14px] font-bold text-slate-900">{entry.userName}</div>
                          <div className="mt-5 space-y-5 text-[13px] leading-7 text-slate-700">
                            <div>
                              <span className="font-semibold text-slate-500">금일 업무</span>
                              <div className="mt-2 whitespace-pre-wrap">{entry.reportBody || "-"}</div>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-500">예정사항</span>
                              <div className="mt-2 whitespace-pre-wrap">{entry.plannedTasks || "-"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : null}

              {viewMode === "division" ? (
                <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-7 lg:p-8">
                  <div className="text-[17px] font-black tracking-[-0.03em] text-slate-950">당일업무</div>
                  <div className="mt-8 space-y-6">
                    {plannedGroups.length ? (
                      plannedGroups.map((group) => (
                        <div key={group.teamName} className="rounded-[24px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
                          <div className="text-[14px] font-bold text-slate-900">{group.teamName}</div>
                          <ul className="mt-5 space-y-3.5 text-[14px] leading-7 text-slate-700">
                            {group.items.map((item, index) => (
                              <li key={`${group.teamName}-${index}`} className="flex gap-2">
                                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-[14px] text-slate-500">
                        아직 취합된 예정사항이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

      </section>
    </div>
  )
}
