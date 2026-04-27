"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BrainCircuit, CheckCircle2, Clock3, FileDown, FileText, Loader2, Sparkles, UsersRound } from "lucide-react"
import {
  countDailyReportStatus,
  DailyDirectoryUser,
  DailyReportEntry,
  DailyReportState,
  getDailyReportsByDate,
  getLatestDailySummary,
  groupEntriesByTeam,
  groupPlannedTasksByTeam,
  resolveDailyReportStatus,
  upsertDailyReportEntry,
  upsertDailyReportSummary,
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
  focus?: "today" | "status" | "ai"
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
  const [summaryText, setSummaryText] = useState("")
  const [summaryMessage, setSummaryMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)

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
  const allSubmitted = todayEntries.length > 0 && todayEntries.every((entry) => resolveDailyReportStatus(entry) === "complete")
  const latestSummary = useMemo(() => getLatestDailySummary(reportState, currentDate), [reportState, currentDate])
  const currentPresence = useMemo(
    () => presenceUsers.find((user) => user.userId === currentUser.id)?.status || "offline",
    [presenceUsers, currentUser.id],
  )
  const statusRef = useRef<HTMLDivElement | null>(null)
  const documentRef = useRef<HTMLDivElement | null>(null)
  const aiRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDraft({
      reportBody: currentEntry?.reportBody || "",
      plannedTasks: currentEntry?.plannedTasks || "",
    })
  }, [currentEntry?.reportBody, currentEntry?.plannedTasks])

  useEffect(() => {
    setSummaryText(latestSummary)
  }, [latestSummary])

  useEffect(() => {
    const target =
      focus === "status" ? statusRef.current : focus === "ai" ? aiRef.current : documentRef.current
    target?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [focus])

  async function commitReport(mode: "draft" | "submit") {
    if (!currentEntry) return
    setSummaryMessage("")
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
      setSummaryMessage(mode === "submit" ? "업무일지를 제출했습니다." : "업무일지를 저장했습니다.")
    } catch {
      setSummaryMessage("저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSummarize() {
    if (!allSubmitted) return
    setIsSummarizing(true)
    setSummaryMessage("")
    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: currentDate,
          reports: todayEntries,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "AI 요약에 실패했습니다.")
      }
      const content = String(json.summary || "").trim()
      setSummaryText(content)
      const nextState = upsertDailyReportSummary(reportState, {
        date: currentDate,
        content,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
      })
      await onSaveState(nextState)
      setSummaryMessage("AI 요약을 업데이트했습니다.")
    } catch (error) {
      setSummaryMessage(error instanceof Error ? error.message : "AI 요약에 실패했습니다.")
    } finally {
      setIsSummarizing(false)
    }
  }

  const kpis = [
    { label: "내 신규계약", value: splitLines(currentEntry?.reportBody || "").length || 0, icon: <FileText className="h-4 w-4" />, tone: "bg-blue-50 text-blue-700" },
    { label: "전체 제출 완료", value: statusCounts.complete, icon: <CheckCircle2 className="h-4 w-4" />, tone: "bg-emerald-50 text-emerald-700" },
    { label: "작성 중", value: statusCounts.draft, icon: <Clock3 className="h-4 w-4" />, tone: "bg-amber-50 text-amber-700" },
    { label: "AI 요약 준비", value: allSubmitted ? "준비됨" : `${statusCounts.empty}명 남음`, icon: <Sparkles className="h-4 w-4" />, tone: "bg-violet-50 text-violet-700" },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                Daily Report
              </span>
              <span className="text-[12px] font-semibold text-slate-500">{formatDisplayDate(currentDate)}</span>
              {lastUpdatedText ? <span className="text-[12px] text-slate-400">Last update: {lastUpdatedText}</span> : null}
            </div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-slate-950">업무일지 협업 보드</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSummarize}
              disabled={!allSubmitted || isSummarizing}
              className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-[14px] font-bold transition ${
                allSubmitted
                  ? "bg-slate-950 text-white hover:bg-slate-800"
                  : "border border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              AI
            </button>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-slate-500">{item.label}</div>
                <div className="mt-3 text-[34px] font-black tracking-[-0.05em] text-slate-950">{item.value}</div>
              </div>
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>{item.icon}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside ref={statusRef} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">제출 현황</div>
              <div className="mt-1 text-[12px] text-slate-500">Word 기준 순서로 고정 정렬</div>
            </div>
            <UsersRound className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4 space-y-4">
            {groupedEntries.map((group) => (
              <div key={group.teamName} className="space-y-2">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.teamName}</div>
                <div className="space-y-2">
                  {group.entries.map((entry) => {
                    const status = resolveDailyReportStatus(entry)
                    const presence = presenceUsers.find((user) => user.userId === entry.userId)?.status || "offline"
                    return (
                      <div key={entry.userId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot(status)}`} />
                            <span className="truncate text-[14px] font-bold text-slate-900">{entry.userName}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className={`inline-flex h-2 w-2 rounded-full ${getPresenceDot(presence)}`} />
                            <span>{getStatusLabel(status)}</span>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div ref={documentRef} className="space-y-4">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">업무일지 문서</div>
                <div className="mt-1 text-[12px] text-slate-500">원문, 팀 요약, 본부 요약을 한 화면에서 확인합니다.</div>
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

            {summaryMessage ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                {summaryMessage}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {viewMode === "original" ? (
                groupedEntries.map((group) => (
                  <div key={group.teamName} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">{group.teamName}</div>
                    <div className="mt-3 space-y-3">
                      {group.entries.map((entry) => {
                        const isMe = entry.userId === currentUser.id
                        const status = resolveDailyReportStatus(entry)
                        return (
                          <div key={entry.userId} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="text-[15px] font-black tracking-[-0.03em] text-slate-950">{entry.userName}</div>
                                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(status)}`}>
                                  {getStatusLabel(status)}
                                </span>
                              </div>
                              {isMe && entry.submittedAt ? (
                                <div className="text-[11px] text-slate-400">제출 {new Date(entry.submittedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</div>
                              ) : null}
                            </div>

                            {isMe ? (
                              <div className="mt-3 grid gap-3">
                                <label className="grid gap-1.5">
                                  <span className="text-[12px] font-semibold text-slate-500">업무일지 본문</span>
                                  <textarea
                                    value={draft.reportBody}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, reportBody: event.target.value }))}
                                    rows={6}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[14px] text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                    placeholder="금일 진행한 업무를 입력해주세요."
                                  />
                                </label>
                                <label className="grid gap-1.5">
                                  <span className="text-[12px] font-semibold text-slate-500">예정사항</span>
                                  <textarea
                                    value={draft.plannedTasks}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, plannedTasks: event.target.value }))}
                                    rows={5}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[14px] text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                    placeholder="내일 예정 업무 또는 follow-up을 입력해주세요."
                                  />
                                </label>
                                <div className="flex flex-wrap items-center justify-end gap-2">
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
                            ) : (
                              <div className="mt-3 grid gap-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <div className="text-[11px] font-semibold text-slate-500">업무일지 본문</div>
                                  <div className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-slate-800">
                                    {entry.reportBody || "아직 작성된 내용이 없습니다."}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <div className="text-[11px] font-semibold text-slate-500">예정사항</div>
                                  <div className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-slate-800">
                                    {entry.plannedTasks || "아직 예정사항이 없습니다."}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : null}

              {viewMode === "team" ? (
                groupedEntries.map((group) => (
                  <div key={group.teamName} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">{group.teamName}</div>
                    <div className="mt-3 grid gap-3">
                      {group.entries.map((entry) => (
                        <div key={entry.userId} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-[14px] font-bold text-slate-900">{entry.userName}</div>
                          <div className="mt-2 space-y-2 text-[13px] leading-6 text-slate-700">
                            <div>
                              <span className="font-semibold text-slate-500">금일 업무</span>
                              <div className="mt-1 whitespace-pre-wrap">{entry.reportBody || "-"}</div>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-500">예정사항</span>
                              <div className="mt-1 whitespace-pre-wrap">{entry.plannedTasks || "-"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : null}

              {viewMode === "division" ? (
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[16px] font-black tracking-[-0.03em] text-slate-950">당일업무</div>
                  <div className="mt-3 space-y-4">
                    {plannedGroups.length ? (
                      plannedGroups.map((group) => (
                        <div key={group.teamName} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-[14px] font-bold text-slate-900">{group.teamName}</div>
                          <ul className="mt-2 space-y-1.5 text-[14px] leading-6 text-slate-700">
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
                      <div className="rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[14px] text-slate-500">
                        아직 취합된 예정사항이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside ref={aiRef} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[18px] font-black tracking-[-0.04em] text-slate-950">AI 요약</div>
              <div className="mt-1 text-[12px] text-slate-500">팀원 전원 제출 시 요약 버튼이 활성화됩니다.</div>
            </div>
            <Sparkles className="h-5 w-5 text-violet-500" />
          </div>

          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-slate-500">제출 상태</div>
                <div className="mt-1 text-[16px] font-black tracking-[-0.03em] text-slate-950">
                  {allSubmitted ? "AI 요약 가능" : `${statusCounts.empty + statusCounts.draft}명 추가 제출 필요`}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSummarize}
                disabled={!allSubmitted || isSummarizing}
                className={`inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-[13px] font-bold transition ${
                  allSubmitted ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-slate-200 text-slate-400"
                }`}
              >
                {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                요약 생성
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="text-[13px] font-semibold text-slate-500">보고용 요약</div>
            <div className="mt-3 min-h-[320px] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[14px] leading-7 text-slate-800">
              {summaryText || "아직 생성된 AI 요약이 없습니다. 팀원 전원 제출 후 AI 버튼을 눌러주세요."}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
