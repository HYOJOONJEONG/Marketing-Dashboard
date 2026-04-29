"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, CirclePause, FileSignature, FolderClock, Hash, OctagonAlert, UserRound } from "lucide-react"
import type { UserTestIdEntry } from "@/lib/auth/model"

type Props = {
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
    color: { bg: string; text: string; border: string; hex: string }
    assignedIndustries?: string[]
    testIdEntries?: UserTestIdEntry[]
  }
  data: {
    myContracts: any[]
    myContractMonthlySummary: Array<{ month: string; total: number; pending: number; recovered: number }>
    myPendingDocuments: any[]
    pendingDocumentSource: any[]
    myTerminationRows: any[]
    myHoldRows: any[]
    assignedIndustries: string[]
    industryOptions: string[]
  }
}

type MobileMyPageSection = "contracts" | "pending" | "termination" | "hold" | "testIds"

const cardClass = "rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
const avatarOptions = ["😀", "😎", "🧑‍💼", "📈", "💼", "🦊", "🐯", "⭐", "🚀", "🧠", "🫶", "🔥", "🐻", "🐼", "🦁", "🐸", "🌈", "⚡", "🎯", "🎧", "☕", "🍀", "🪐", "🎨"]

function formatValue(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function formatMonthDisplay(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim()
  if (!text) return fallback

  const dottedMatch = text.match(/^(\d{4})\.(\d{1,2})$/)
  if (dottedMatch) {
    const year = dottedMatch[1].slice(-2)
    const month = dottedMatch[2].padStart(2, "0")
    return `${year}년 ${month}월`
  }

  const koreanMatch = text.match(/^(\d{2,4})년\s*(\d{1,2})월$/)
  if (koreanMatch) {
    const year = koreanMatch[1].slice(-2)
    const month = koreanMatch[2].padStart(2, "0")
    return `${year}년 ${month}월`
  }

  const compactMatch = text.match(/^(\d{2,4})(\d{2})$/)
  if (compactMatch) {
    const year = compactMatch[1].slice(-2)
    const month = compactMatch[2]
    return `${year}년 ${month}월`
  }

  return text
}

function terminationBadgeClass(label: string) {
  if (label === "해지 진행") {
    return "border-orange-200 bg-orange-50 text-orange-700"
  }
  if (label === "해지 확정") {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }
  return "border-amber-200 bg-amber-50 text-amber-700"
}

function MetricCard({
  title,
  value,
  tone,
  icon,
}: {
  title: string
  value: number
  tone: string
  icon: ReactNode
}) {
  return (
    <div className={`${cardClass} overflow-hidden p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-500">{title}</div>
          <div className="mt-4 text-[26px] font-black tracking-[-0.05em] text-slate-950">{value}</div>
        </div>
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      </div>
    </div>
  )
}

function MobileDataCard({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: ReactNode }>
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="text-[14px] font-bold text-slate-950">{title}</div>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-slate-50 px-3.5 py-3">
            <div className="text-[11px] font-semibold text-slate-400">{row.label}</div>
            <div className="mt-1 text-[14px] font-semibold text-slate-800">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function normalizeTestId(value: string) {
  const match = String(value || "")
    .trim()
    .toUpperCase()
    .match(/^E?(\d{6})$/)
  return match ? `E${match[1]}` : ""
}

function buildRangeTestIds(startId: string, endId: string) {
  const normalizedStart = normalizeTestId(startId)
  const normalizedEnd = normalizeTestId(endId)
  if (!normalizedStart || !normalizedEnd) return []

  const start = Number(normalizedStart.slice(1))
  const end = Number(normalizedEnd.slice(1))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []

  return Array.from({ length: end - start + 1 }, (_, index) => `E${String(start + index).padStart(6, "0")}`)
}

export function PersonalDashboard({ currentUser, data }: Props) {
  const router = useRouter()
  const [profileMessage, setProfileMessage] = useState("")
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(data.assignedIndustries || [])
  const [selectedAvatar, setSelectedAvatar] = useState<string>(String(currentUser.avatarEmoji || "").trim())
  const [isIndustryOpen, setIsIndustryOpen] = useState(false)
  const [isAvatarOpen, setIsAvatarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mobileSection, setMobileSection] = useState<MobileMyPageSection>("testIds")
  const [testIdEntries, setTestIdEntries] = useState<UserTestIdEntry[]>(currentUser.testIdEntries || [])
  const [testIdMode, setTestIdMode] = useState<"single" | "bulk">("single")
  const [singleTestId, setSingleTestId] = useState("")
  const [bulkStartId, setBulkStartId] = useState("")
  const [bulkEndId, setBulkEndId] = useState("")
  const [testIdMessage, setTestIdMessage] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.innerWidth < 1024) {
      setMobileSection("testIds")
    }
  }, [])

  const pendingDocuments = useMemo(() => {
    return (data.pendingDocumentSource || []).filter((row) => {
      const industry = String(row?.industryGroup || row?.industry || "").trim()
      const status = String(row?.status || "").trim()
      return selectedIndustries.includes(industry) && status !== "회수"
    })
  }, [data.pendingDocumentSource, selectedIndustries])

  const selectedIndustryLabels = useMemo(
    () => selectedIndustries.slice().sort((a, b) => a.localeCompare(b, "ko")),
    [selectedIndustries],
  )

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((item) => item !== industry) : [...prev, industry],
    )
  }

  const saveProfile = () => {
    setProfileMessage("")
    startTransition(async () => {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignedIndustries: selectedIndustries,
          avatarEmoji: selectedAvatar || null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setProfileMessage(payload?.error || "프로필 저장에 실패했습니다.")
        return
      }
      setSelectedIndustries(Array.isArray(payload?.assignedIndustries) ? payload.assignedIndustries : selectedIndustries)
      setSelectedAvatar(String(payload?.avatarEmoji || "").trim())
      setProfileMessage("내 프로필 설정이 저장되었습니다.")
      router.refresh()
    })
  }

  const addTestIds = (ids: string[]) => {
    const normalizedIds = ids.map(normalizeTestId).filter(Boolean)
    if (!normalizedIds.length) {
      setTestIdMessage("시험아이디 형식을 확인해주세요. 예: E260403")
      return
    }
    setTestIdEntries((prev) => {
      const existingMap = new Map(prev.map((entry) => [entry.testId, entry]))
      const now = new Date().toISOString()
      normalizedIds.forEach((testId) => {
        if (!existingMap.has(testId)) {
          existingMap.set(testId, {
            id: `test-id-${testId}-${Math.random().toString(36).slice(2, 8)}`,
            testId,
            companyName: "",
            departmentName: "",
            assigneeName: "",
            contact: "",
            note: "",
            createdAt: now,
            updatedAt: now,
          })
        }
      })
      return [...existingMap.values()].sort((a, b) => a.testId.localeCompare(b.testId, "ko"))
    })
    setSingleTestId("")
    setBulkStartId("")
    setBulkEndId("")
    setTestIdMessage(`${normalizedIds.length}건의 시험아이디를 목록에 추가했습니다.`)
  }

  const updateTestIdEntry = (entryId: string, field: keyof UserTestIdEntry, value: string) => {
    setTestIdEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: value,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    )
  }

  const removeTestIdEntry = (entryId: string) => {
    setTestIdEntries((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  const saveTestIdEntries = () => {
    setTestIdMessage("")
    startTransition(async () => {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testIdEntries }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setTestIdMessage(payload?.error || "시험아이디 저장에 실패했습니다.")
        return
      }
      setTestIdEntries(Array.isArray(payload?.testIdEntries) ? payload.testIdEntries : testIdEntries)
      setTestIdMessage("시험아이디 관리 항목이 저장되었습니다.")
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f8fbff_36%,#f3f6fb_100%)] px-3 py-3 sm:px-4">
      <div className="mx-auto max-w-[1680px]">
        <div className="space-y-4">
          <section className={`${cardClass} relative z-20 overflow-visible p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${currentUser.color.border} ${currentUser.color.bg} text-[22px] shadow-sm`}
                >
                  {selectedAvatar || currentUser.avatarEmoji || currentUser.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[20px] font-black tracking-[-0.05em] text-slate-950">{currentUser.name}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">{currentUser.role}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{currentUser.teamName}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                      담당업종 {selectedIndustryLabels.length || 0}개
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-400" />
                  대시보드 돌아가기
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarOpen(false)
                      setIsIndustryOpen((prev) => !prev)
                    }}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                  >
                    담당 업종 선택
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isIndustryOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isIndustryOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:left-auto sm:right-0 sm:w-[300px]">
                      <div className="mb-2 text-xs font-semibold text-slate-400">미회수 현황 집계 기준</div>
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {(data.industryOptions || []).map((industry) => {
                          const checked = selectedIndustries.includes(industry)
                          return (
                            <label
                              key={industry}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                checked ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleIndustry(industry)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="flex-1">{industry}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsIndustryOpen(false)
                      setIsAvatarOpen((prev) => !prev)
                    }}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                  >
                    <UserRound className="h-4 w-4 text-slate-400" />
                    아바타 변경
                  </button>
                  {isAvatarOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:left-auto sm:right-0 sm:w-[304px]">
                      <div className="mb-3 text-xs font-semibold text-slate-400">아바타 선택</div>
                      <div className="flex flex-wrap gap-2">
                        {avatarOptions.map((avatar) => {
                          const active = selectedAvatar === avatar
                          return (
                            <button
                              key={avatar}
                              type="button"
                              onClick={() => setSelectedAvatar(active ? "" : avatar)}
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-[20px] transition ${
                                active
                                  ? "border-blue-300 bg-blue-50 shadow-sm"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                              }`}
                              aria-label={`아바타 ${avatar}`}
                            >
                              {avatar}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setSelectedAvatar("")}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500 transition hover:bg-white"
                        >
                          기본값
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isPending}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60 sm:flex-none"
                >
                  {isPending ? "저장 중..." : "프로필 저장"}
                </button>
              </div>
            </div>
            {profileMessage ? <div className="mt-3 text-sm text-slate-500">{profileMessage}</div> : null}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="나의 시험아이디"
              value={testIdEntries.length}
              tone="bg-sky-50 text-sky-700"
              icon={<Hash className="h-5 w-5" />}
            />
            <MetricCard
              title="내 신규계약"
              value={data.myContracts.length}
              tone="bg-blue-50 text-blue-700"
              icon={<FileSignature className="h-5 w-5" />}
            />
            <MetricCard
              title="내 미회수 계약서"
              value={pendingDocuments.length}
              tone="bg-emerald-50 text-emerald-700"
              icon={<FolderClock className="h-5 w-5" />}
            />
            <MetricCard
              title="나의 해지 리스트"
              value={data.myTerminationRows.length}
              tone="bg-orange-50 text-orange-700"
              icon={<OctagonAlert className="h-5 w-5" />}
            />
            <MetricCard
              title="나의 청구보류 리스트"
              value={data.myHoldRows.length}
              tone="bg-amber-50 text-amber-700"
              icon={<CirclePause className="h-5 w-5" />}
            />
          </section>

          <section className="lg:hidden">
            <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                {[
                  { key: "testIds", label: "시험ID" },
                  { key: "contracts", label: "신규계약" },
                  { key: "pending", label: "미회수" },
                  { key: "termination", label: "해지" },
                  { key: "hold", label: "청구보류" },
                ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMobileSection(item.key as MobileMyPageSection)}
                  className={`rounded-2xl px-3 py-3 text-[13px] font-bold transition ${
                    mobileSection === item.key ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className={`${cardClass} ${mobileSection === "testIds" ? "block" : "hidden"} lg:block`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">1. 시험아이디 관리</h3>
                  <p className="mt-1 text-sm text-slate-500">개별 등록 또는 연속 등록 후 회사명, 부서, 담당자, 연락처, 비고를 기록할 수 있습니다.</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                  {testIdEntries.length}건
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTestIdMode("single")}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${testIdMode === "single" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                >
                  개별등록
                </button>
                <button
                  type="button"
                  onClick={() => setTestIdMode("bulk")}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${testIdMode === "bulk" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                >
                  여러개 등록
                </button>
              </div>

              {testIdMode === "single" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={singleTestId}
                    onChange={(event) => setSingleTestId(event.target.value)}
                    placeholder="예: E260403"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => addTestIds([singleTestId])}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    등록
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <input
                    value={bulkStartId}
                    onChange={(event) => setBulkStartId(event.target.value)}
                    placeholder="시작 아이디 예: E260403"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <input
                    value={bulkEndId}
                    onChange={(event) => setBulkEndId(event.target.value)}
                    placeholder="끝 아이디 예: E260408"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => addTestIds(buildRangeTestIds(bulkStartId, bulkEndId))}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    여러개 등록
                  </button>
                </div>
              )}

              {testIdMessage ? <div className="mt-3 text-sm text-slate-500">{testIdMessage}</div> : null}

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
                {testIdEntries.length ? (
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[120px_170px_170px_140px_160px_minmax(240px,1fr)_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-bold text-slate-500">
                      <div>시험아이디</div>
                      <div>회사명</div>
                      <div>부서</div>
                      <div>담당자</div>
                      <div>연락처</div>
                      <div>비고</div>
                      <div>관리</div>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {testIdEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="grid grid-cols-[120px_170px_170px_140px_160px_minmax(240px,1fr)_88px] gap-3 px-4 py-3"
                        >
                          <div className="flex items-center text-[13px] font-black text-slate-950">{entry.testId}</div>
                          <input
                            value={entry.companyName}
                            onChange={(event) => updateTestIdEntry(entry.id, "companyName", event.target.value)}
                            placeholder="회사명"
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          <input
                            value={entry.departmentName}
                            onChange={(event) => updateTestIdEntry(entry.id, "departmentName", event.target.value)}
                            placeholder="부서"
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          <input
                            value={entry.assigneeName}
                            onChange={(event) => updateTestIdEntry(entry.id, "assigneeName", event.target.value)}
                            placeholder="담당자"
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          <input
                            value={entry.contact}
                            onChange={(event) => updateTestIdEntry(entry.id, "contact", event.target.value)}
                            placeholder="연락처"
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          <input
                            value={entry.note}
                            onChange={(event) => updateTestIdEntry(entry.id, "note", event.target.value)}
                            placeholder="비고"
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          <div className="flex items-start justify-end">
                            <button
                              type="button"
                              onClick={() => removeTestIdEntry(entry.id)}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">등록된 시험아이디가 없습니다.</div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={saveTestIdEntries}
                  disabled={isPending}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? "저장 중..." : "시험아이디 저장"}
                </button>
              </div>
            </div>

            <div className={`${cardClass} ${mobileSection === "contracts" ? "block" : "hidden"} lg:block`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">2. 내 신규계약 리스트</h3>
                  <p className="mt-1 text-sm text-slate-500">이름 기준으로 등록된 신규계약을 월별 흐름까지 함께 보여줍니다.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                  총 {data.myContracts.length}건
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.myContractMonthlySummary.length ? (
                  data.myContractMonthlySummary.map((item) => (
                    <div key={item.month} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm font-bold text-slate-900">{item.month}</div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div className="text-[28px] font-black tracking-[-0.04em] text-slate-950">{item.total}</div>
                        <div className="text-right text-xs text-slate-500">
                          <div>미회수 {item.pending}</div>
                          <div>회수 {item.recovered}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-400">
                    등록된 신규계약이 없습니다.
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-3 lg:hidden">
                {data.myContracts.length ? (
                  data.myContracts.slice(0, 20).map((row) => (
                    <MobileDataCard
                      key={row.id}
                      title={formatValue(row.companyName)}
                      rows={[
                        { label: "부서", value: formatValue(row.departmentName) },
                        { label: "ID", value: formatValue(row.idCode) },
                        { label: "업종", value: formatValue(row.industryGroup || row.industry) },
                        { label: "계약월", value: formatValue(row.contractMonth) },
                        { label: "계약서 상태", value: formatValue(row.documentStatus) },
                      ]}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    등록된 신규계약이 없습니다.
                  </div>
                )}
              </div>

              <div className="mt-5 hidden overflow-x-auto rounded-[24px] border border-slate-200 lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "부서", "ID", "업종", "계약월", "계약서 상태"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myContracts.length ? (
                      data.myContracts.slice(0, 40).map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.idCode)}</td>
                          <td className="px-4 py-3">{formatValue(row.industryGroup || row.industry)}</td>
                          <td className="px-4 py-3">{formatValue(row.contractMonth)}</td>
                          <td className="px-4 py-3">{formatValue(row.documentStatus)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          등록된 신규계약이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${cardClass} ${mobileSection === "pending" ? "block" : "hidden"} lg:block`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">3. 내 이름으로 된 계약서 미회수 현황</h3>
                  <p className="mt-1 text-sm text-slate-500">선택한 담당 업종 기준으로 미회수 계약서만 모아 보여줍니다.</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  {pendingDocuments.length}건
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedIndustryLabels.length ? (
                  selectedIndustryLabels.map((industry) => (
                    <span key={industry} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {industry}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">담당 업종 미지정</span>
                )}
              </div>

              <div className="mt-5 space-y-3 lg:hidden">
                {pendingDocuments.length ? (
                  pendingDocuments.map((row) => (
                    <MobileDataCard
                      key={row.id}
                      title={formatValue(row.companyName)}
                      rows={[
                        { label: "부서", value: formatValue(row.departmentName) },
                        { label: "ID", value: formatValue(row.idCode) },
                        { label: "업종", value: formatValue(row.industryGroup || row.industry) },
                        { label: "청구월", value: formatValue(row.claimMonth) },
                        { label: "상태", value: formatValue(row.status) },
                      ]}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    {selectedIndustryLabels.length ? "미회수 계약서가 없습니다." : "담당 업종을 선택해주세요."}
                  </div>
                )}
              </div>

              <div className="mt-5 hidden overflow-x-auto rounded-[24px] border border-slate-200 lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "부서", "ID", "업종", "청구월", "상태"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDocuments.length ? (
                      pendingDocuments.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.idCode)}</td>
                          <td className="px-4 py-3">{formatValue(row.industryGroup || row.industry)}</td>
                          <td className="px-4 py-3">{formatValue(row.claimMonth)}</td>
                          <td className="px-4 py-3">{formatValue(row.status)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          {selectedIndustryLabels.length ? "미회수 계약서가 없습니다." : "담당 업종을 선택해주세요."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className={`${cardClass} ${mobileSection === "termination" ? "block" : "hidden"} lg:block`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">4. 나의 해지 리스트</h3>
                  <p className="mt-1 text-sm text-slate-500">해지 예정인 계약건만 보여줍니다.</p>
                </div>
                <div className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                  {data.myTerminationRows.length}건
                </div>
              </div>

              <div className="mt-5 space-y-3 lg:hidden">
                {data.myTerminationRows.length ? (
                  data.myTerminationRows.map((row) => (
                    <MobileDataCard
                      key={row.id}
                      title={formatValue(row.companyName)}
                      rows={[
                        {
                          label: "구분",
                          value: (
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          ),
                        },
                        { label: "부서", value: formatValue(row.departmentName) },
                        { label: "고객번호", value: formatValue(row.customerId) },
                        { label: "사유", value: formatValue(row.reason) },
                        { label: "해지일", value: formatValue(row.terminationDate) },
                      ]}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    배정된 해지 리스트가 없습니다.
                  </div>
                )}
              </div>

              <div className="mt-5 hidden overflow-x-auto rounded-[24px] border border-slate-200 lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["구분", "고객사", "부서", "고객번호", "사유", "해지일"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myTerminationRows.length ? (
                      data.myTerminationRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.customerId)}</td>
                          <td className="px-4 py-3">{formatValue(row.reason)}</td>
                          <td className="px-4 py-3">{formatValue(row.terminationDate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          배정된 해지 리스트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${cardClass} ${mobileSection === "hold" ? "block" : "hidden"} lg:block`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">5. 나의 청구보류 리스트</h3>
                  <p className="mt-1 text-sm text-slate-500">현재 내 이름으로 관리 중인 청구보류 건의 시작일과 종료일을 함께 보여줍니다.</p>
                  </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                  {data.myHoldRows.length}건
                </div>
              </div>

              <div className="mt-5 space-y-3 lg:hidden">
                {data.myHoldRows.length ? (
                  data.myHoldRows.map((row) => (
                    <MobileDataCard
                      key={row.id}
                      title={formatValue(row.companyName)}
                      rows={[
                        {
                          label: "구분",
                          value: (
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          ),
                        },
                        { label: "부서", value: formatValue(row.departmentName) },
                        { label: "고객번호", value: formatValue(row.customerId) },
                        { label: "사유", value: formatValue(row.reason) },
                        { label: "시작일", value: formatMonthDisplay(row.startDate) },
                        { label: "종료일", value: formatMonthDisplay(row.endDate) },
                      ]}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    배정된 청구보류 리스트가 없습니다.
                  </div>
                )}
              </div>

              <div className="mt-5 hidden overflow-x-auto rounded-[24px] border border-slate-200 lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["구분", "고객사", "부서", "고객번호", "사유", "시작일", "종료일"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myHoldRows.length ? (
                      data.myHoldRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.customerId)}</td>
                          <td className="px-4 py-3">{formatValue(row.reason)}</td>
                          <td className="px-4 py-3">{formatMonthDisplay(row.startDate)}</td>
                          <td className="px-4 py-3">{formatMonthDisplay(row.endDate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                          배정된 청구보류 리스트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>
        </div>
      </div>
    </div>
  )
}
