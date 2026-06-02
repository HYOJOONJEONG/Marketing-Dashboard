"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, CirclePause, FileSignature, FolderClock, Hash, LogOut, MessageSquare, OctagonAlert, Plus, Save, Trash2, UserRound } from "lucide-react"
import type { PopupMessageRecord, UserTestIdEntry } from "@/lib/auth/model"

type ContractCreateResult = {
  data?: any
  contract?: any
}

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
    messageHistory?: PopupMessageRecord[]
  }
  embedded?: boolean
  onContractCreated?: (result: ContractCreateResult) => void
}

type MobileMyPageSection = "contracts" | "pending" | "termination" | "hold" | "testIds"
type SavePhase = "idle" | "dirty" | "saving" | "success" | "error"

const cardClass = "rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
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

function formatMessageTime(value: unknown) {
  const date = new Date(String(value || ""))
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function formatSaveTime(value = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value)
}

function getSeoulTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function normalizeDateDotted(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length >= 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 6) return `20${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`
  return String(value ?? "").trim()
}

async function fetchProfileUpdate(body: Record<string, unknown>) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    return { response, payload }
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchTestIdUpdate(body: Record<string, unknown>) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch("/api/auth/test-ids", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    return { response, payload }
  } finally {
    window.clearTimeout(timeout)
  }
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
  accent,
  icon,
  active,
  onClick,
}: {
  title: string
  value: number
  tone: string
  accent: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${cardClass} relative overflow-hidden p-3.5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${
        active ? "border-blue-300 ring-2 ring-blue-100" : ""
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold text-slate-500">{title}</div>
          <div className="mt-1.5 flex items-end gap-1.5">
            <span className="text-[24px] font-black tracking-[-0.04em] text-slate-950">{value}</span>
            <span className="pb-1 text-[11px] font-bold text-slate-400">건</span>
          </div>
        </div>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      </div>
    </button>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
      <div className="text-[14px] font-bold text-slate-950">{title}</div>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
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

export function PersonalDashboard({ currentUser, data, embedded = false, onContractCreated }: Props) {
  const router = useRouter()
  const [profileMessage, setProfileMessage] = useState("")
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(data.assignedIndustries || [])
  const [selectedAvatar, setSelectedAvatar] = useState<string>(String(currentUser.avatarEmoji || "").trim())
  const [isIndustryOpen, setIsIndustryOpen] = useState(false)
  const [isAvatarOpen, setIsAvatarOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isTestIdSaving, setIsTestIdSaving] = useState(false)
  const [isTestIdDirty, setIsTestIdDirty] = useState(false)
  const [testIdSaveStatus, setTestIdSaveStatus] = useState<{ phase: SavePhase; message: string }>({
    phase: "idle",
    message: "",
  })
  const [mobileSection, setMobileSection] = useState<MobileMyPageSection>("testIds")
  const [testIdEntries, setTestIdEntries] = useState<UserTestIdEntry[]>(currentUser.testIdEntries || [])
  const [testIdMode, setTestIdMode] = useState<"single" | "bulk">("single")
  const [singleTestId, setSingleTestId] = useState("")
  const [bulkStartId, setBulkStartId] = useState("")
  const [bulkEndId, setBulkEndId] = useState("")
  const [bulkCompanyName, setBulkCompanyName] = useState("")
  const [testIdMessage, setTestIdMessage] = useState("")
  const [convertingTestId, setConvertingTestId] = useState<string | null>(null)
  const [messageHistory, setMessageHistory] = useState<PopupMessageRecord[]>(data.messageHistory || [])
  const [isMessageBoxOpen, setIsMessageBoxOpen] = useState(false)
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const incomingTestIdSignature = useMemo(
    () =>
      (currentUser.testIdEntries || [])
        .map((entry) =>
          [
            entry.id,
            entry.testId,
            entry.companyName,
            entry.departmentName,
            entry.assigneeName,
            entry.contact,
            entry.note,
            entry.updatedAt,
          ].join("\u001f"),
        )
        .join("\u001e"),
    [currentUser.testIdEntries],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.innerWidth < 1024) {
      setMobileSection("testIds")
    }
  }, [])

  const refreshTestIdsFromSession = useCallback(async () => {
    if (isTestIdDirty || isTestIdSaving) return
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      const nextEntries = payload?.authenticated && Array.isArray(payload?.user?.testIdEntries)
        ? payload.user.testIdEntries
        : null
      if (nextEntries) {
        setTestIdEntries(nextEntries)
      }
    } catch {
      // 화면 동기화 보조 요청이므로 실패해도 기존 화면을 유지합니다.
    }
  }, [isTestIdDirty, isTestIdSaving])

  useEffect(() => {
    if (isTestIdDirty || isTestIdSaving) return
    setTestIdEntries(currentUser.testIdEntries || [])
  }, [currentUser.id, incomingTestIdSignature, isTestIdDirty, isTestIdSaving, currentUser.testIdEntries])

  useEffect(() => {
    void refreshTestIdsFromSession()
  }, [refreshTestIdsFromSession])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleFocus = () => {
      void refreshTestIdsFromSession()
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshTestIdsFromSession()
      }
    }
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [refreshTestIdsFromSession])

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
  const unreadMessageCount = useMemo(() => messageHistory.filter((message) => !message.readAt).length, [messageHistory])
  const testIdSaveToneClass =
    testIdSaveStatus.phase === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : testIdSaveStatus.phase === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : testIdSaveStatus.phase === "saving"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
  const testIdSaveButtonClass =
    testIdSaveStatus.phase === "success"
      ? "bg-emerald-600 text-white shadow-[0_8px_18px_rgba(5,150,105,0.2)] hover:bg-emerald-700"
      : testIdSaveStatus.phase === "error"
        ? "bg-rose-600 text-white shadow-[0_8px_18px_rgba(225,29,72,0.18)] hover:bg-rose-700"
        : "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] hover:bg-blue-700"
  const testIdSaveButtonLabel =
    testIdSaveStatus.phase === "saving"
      ? "저장 중..."
      : testIdSaveStatus.phase === "success"
        ? "저장 완료"
        : testIdSaveStatus.phase === "error"
          ? "다시 저장"
          : "목록 저장"

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((item) => item !== industry) : [...prev, industry],
    )
  }

  const saveProfile = async () => {
    if (isProfileSaving) return
    setProfileMessage("")
    setIsProfileSaving(true)
    try {
      const { response, payload } = await fetchProfileUpdate({
        assignedIndustries: selectedIndustries,
        avatarEmoji: selectedAvatar || null,
      })
      if (!response.ok || !payload?.ok) {
        setProfileMessage(payload?.error || "프로필 저장에 실패했습니다.")
        return
      }
      setSelectedIndustries(Array.isArray(payload?.assignedIndustries) ? payload.assignedIndustries : selectedIndustries)
      setSelectedAvatar(String(payload?.avatarEmoji || "").trim())
      setProfileMessage("내 프로필 설정이 저장되었습니다.")
      startTransition(() => router.refresh())
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError"
      setProfileMessage(aborted ? "저장 요청이 지연되어 중단했습니다. 잠시 후 다시 눌러주세요." : "프로필 저장 중 오류가 발생했습니다.")
    } finally {
      setIsProfileSaving(false)
    }
  }

  const logout = async () => {
    if (isLogoutPending) return
    setIsLogoutPending(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    } finally {
      window.location.replace("/")
    }
  }

  const addTestIds = (ids: string[], defaultCompanyName = "") => {
    const normalizedIds = ids.map(normalizeTestId).filter(Boolean)
    const companyName = defaultCompanyName.trim()
    if (!normalizedIds.length) {
      setTestIdMessage("시험아이디 형식을 확인해주세요. 예: E260403")
      setTestIdSaveStatus({ phase: "error", message: "입력 형식을 확인해주세요" })
      return
    }
    setIsTestIdDirty(true)
    setTestIdSaveStatus({ phase: "dirty", message: "변경됨 - 목록 저장 필요" })
    setTestIdEntries((prev) => {
      const existingMap = new Map(prev.map((entry) => [entry.testId, entry]))
      const now = new Date().toISOString()
      normalizedIds.forEach((testId) => {
        const existing = existingMap.get(testId)
        if (existing) {
          if (companyName) {
            existingMap.set(testId, {
              ...existing,
              companyName,
              updatedAt: now,
            })
          }
        } else {
          existingMap.set(testId, {
            id: `test-id-${testId}-${Math.random().toString(36).slice(2, 8)}`,
            testId,
            companyName,
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
    setBulkCompanyName("")
    setTestIdMessage(companyName ? `${normalizedIds.length}건의 시험아이디에 ${companyName}을(를) 일괄 적용했습니다.` : `${normalizedIds.length}건의 시험아이디를 목록에 추가했습니다.`)
  }

  const updateTestIdEntry = (entryId: string, field: keyof UserTestIdEntry, value: string) => {
    setIsTestIdDirty(true)
    setTestIdSaveStatus({ phase: "dirty", message: "변경됨 - 목록 저장 필요" })
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
    setIsTestIdDirty(true)
    setTestIdSaveStatus({ phase: "dirty", message: "변경됨 - 목록 저장 필요" })
    setTestIdEntries((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  const saveTestIdEntries = async () => {
    if (isTestIdSaving) return
    const hadTestIdsOnLoad = (currentUser.testIdEntries || []).length > 0
    let confirmClearTestIds = false
    if (hadTestIdsOnLoad && testIdEntries.length === 0) {
      confirmClearTestIds = window.confirm("등록된 시험아이디가 모두 삭제된 상태입니다. 전체 삭제로 저장할까요?")
      if (!confirmClearTestIds) return
    }
    setTestIdMessage("")
    setIsTestIdSaving(true)
    setTestIdSaveStatus({ phase: "saving", message: "시험아이디 저장 중..." })
    try {
      const { response, payload } = await fetchTestIdUpdate({ testIdEntries, confirmClearTestIds })
      if (!response.ok || !payload?.ok) {
        const errorMessage = payload?.error || "시험아이디 저장에 실패했습니다."
        setTestIdMessage(errorMessage)
        setTestIdSaveStatus({ phase: "error", message: errorMessage })
        return
      }
      setTestIdEntries(Array.isArray(payload?.testIdEntries) ? payload.testIdEntries : testIdEntries)
      setIsTestIdDirty(false)
      const savedCount = Number(payload?.savedCount ?? testIdEntries.length)
      const successMessage = `${formatSaveTime()} 저장 완료 · ${Number.isFinite(savedCount) ? savedCount : testIdEntries.length}건`
      setTestIdMessage("시험아이디 관리 항목이 저장되었습니다.")
      setTestIdSaveStatus({ phase: "success", message: successMessage })
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError"
      const errorMessage = aborted ? "저장 요청이 지연되어 중단했습니다. 잠시 후 다시 눌러주세요." : "시험아이디 저장 중 오류가 발생했습니다."
      setTestIdMessage(errorMessage)
      setTestIdSaveStatus({ phase: "error", message: errorMessage })
    } finally {
      setIsTestIdSaving(false)
    }
  }

  const registerTestIdAsContract = async (entry: UserTestIdEntry) => {
    if (convertingTestId) return

    const idCode = normalizeTestId(entry.testId)
    const rawCompanyName = String(entry.companyName || "").trim()
    const companyName = rawCompanyName || "미입력"
    if (!idCode) {
      setTestIdMessage("시험아이디 형식을 확인해주세요. 예: E260403")
      setTestIdSaveStatus({ phase: "error", message: "ID 형식 확인 필요" })
      return
    }

    setConvertingTestId(entry.id)
    setTestIdMessage(`${idCode} 신규계약 등록 중...`)
    try {
      const noteParts = [String(entry.note || "").trim(), rawCompanyName ? "" : "회사명 확인 필요", "시험아이디 전환"].filter(Boolean)
      const nextContract = {
        id: `c-test-${idCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        registrationDate: normalizeDateDotted(getSeoulTodayKey()),
        companyName,
        departmentName: String(entry.departmentName || "").trim(),
        idCode,
        industry: selectedIndustries[0] || "국내증권",
        contractMonth: "",
        documentStatus: "미회수",
        replacementType: "신규",
        includedInWeekly: false,
        recommender: currentUser.name,
        note: noteParts.join(" / "),
      }

      let payload: any = null
      let lastError: Error | null = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch("/api/dashboard", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "addContract", contract: nextContract }),
          })
          payload = await response.json().catch(() => null)
          if (response.ok && payload?.ok) break
          lastError = new Error(payload?.error || `신규계약 등록 실패 (${response.status})`)
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("신규계약 등록 요청에 실패했습니다.")
        }
        if (attempt === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 300))
        }
      }

      if (!payload?.ok) {
        throw lastError || new Error("신규계약 등록 저장에 실패했습니다.")
      }

      setTestIdMessage(`${idCode} 신규계약 리스트에 등록했습니다. 부족한 필드는 리스트에서 수정해주세요.`)
      setTestIdSaveStatus({ phase: "success", message: `${formatSaveTime()} 신규계약 등록 완료` })
      if (onContractCreated) {
        onContractCreated({ data: payload?.data, contract: payload?.contract || nextContract })
      } else {
        startTransition(() => router.push("/?view=contracts"))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "신규계약 등록 저장에 실패했습니다."
      setTestIdMessage(message)
      setTestIdSaveStatus({ phase: "error", message })
    } finally {
      setConvertingTestId(null)
    }
  }

  const markMessageRead = (messageId: string) => {
    const now = new Date().toISOString()
    setMessageHistory((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, readAt: message.readAt || now } : message)),
    )
    void fetch("/api/popup-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "read", messageIds: [messageId] }),
    })
  }

  return (
    <div className={embedded ? "bg-transparent" : "min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f8fbff_36%,#f3f6fb_100%)] px-3 py-3 sm:px-4"}>
      <div className={embedded ? "max-w-none" : "mx-auto max-w-[1680px]"}>
        <div className="space-y-3">
          <section className={`${cardClass} relative z-20 overflow-visible p-3.5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${currentUser.color.border} ${currentUser.color.bg} text-[19px] shadow-sm`}
                >
                  {selectedAvatar || currentUser.avatarEmoji || currentUser.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[17px] font-black tracking-[-0.04em] text-slate-950">{currentUser.name}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">{currentUser.role}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{currentUser.teamName}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                      담당업종 {selectedIndustryLabels.length || 0}개
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                {!embedded ? (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:h-9 sm:w-auto"
                    >
                      <ArrowLeft className="h-4 w-4 text-slate-400" />
                      대시보드 돌아가기
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      disabled={isLogoutPending}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-950 px-3 text-[13px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:h-9 sm:w-auto"
                    >
                      <LogOut className="h-4 w-4" />
                      {isLogoutPending ? "로그아웃 중..." : "로그아웃"}
                    </button>
                  </>
                ) : null}
                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarOpen(false)
                      setIsIndustryOpen((prev) => !prev)
                    }}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:h-9 sm:w-auto"
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

                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsIndustryOpen(false)
                      setIsAvatarOpen((prev) => !prev)
                    }}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:h-9 sm:w-auto"
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
                  disabled={isProfileSaving}
                  className="col-span-2 inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-xl bg-slate-950 px-3 text-[13px] font-bold text-white disabled:opacity-60 sm:col-span-1 sm:h-9 sm:w-auto"
                >
                  {isProfileSaving ? "저장 중..." : "프로필 저장"}
                </button>
                <div className="relative col-span-2 justify-self-start sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsIndustryOpen(false)
                      setIsAvatarOpen(false)
                      setIsMessageBoxOpen((prev) => !prev)
                    }}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 sm:h-9 sm:w-9"
                    aria-label="내 메시지함"
                    title="내 메시지함"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {unreadMessageCount ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                        {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                      </span>
                    ) : null}
                  </button>
                  {isMessageBoxOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-black text-slate-950">메시지함</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">미확인 {unreadMessageCount}건</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMessageBoxOpen(false)}
                          className="h-7 rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-slate-500 transition hover:bg-slate-50"
                        >
                          닫기
                        </button>
                      </div>
                      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {messageHistory.length ? (
                          messageHistory.map((message) => {
                            const unread = !message.readAt
                            return (
                              <div
                                key={message.id}
                                className={`rounded-xl border px-3 py-2 ${
                                  unread ? "border-indigo-200 bg-indigo-50/80" : "border-slate-200 bg-white"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-[12px] font-black text-slate-900">{message.title || "업무 알림"}</div>
                                    <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                                      {message.senderName || "시스템"} · {formatMessageTime(message.createdAt)}
                                    </div>
                                  </div>
                                  {unread ? (
                                    <button
                                      type="button"
                                      onClick={() => markMessageRead(message.id)}
                                      className="h-7 shrink-0 rounded-lg bg-slate-950 px-2 text-[11px] font-bold text-white"
                                    >
                                      읽음
                                    </button>
                                  ) : null}
                                </div>
                                <div className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-700">{message.body}</div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-[12px] font-semibold text-slate-400">
                            받은 메시지가 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {profileMessage ? <div className="mt-3 text-sm text-slate-500">{profileMessage}</div> : null}
          </section>

          <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="나의 시험아이디"
              value={testIdEntries.length}
              tone="bg-sky-50 text-sky-700"
              accent="bg-sky-500"
              icon={<Hash className="h-5 w-5" />}
              active={mobileSection === "testIds"}
              onClick={() => setMobileSection("testIds")}
            />
            <MetricCard
              title="내 신규계약"
              value={data.myContracts.length}
              tone="bg-blue-50 text-blue-700"
              accent="bg-blue-500"
              icon={<FileSignature className="h-5 w-5" />}
              active={mobileSection === "contracts"}
              onClick={() => setMobileSection("contracts")}
            />
            <MetricCard
              title="내 미회수 계약서"
              value={pendingDocuments.length}
              tone="bg-emerald-50 text-emerald-700"
              accent="bg-emerald-500"
              icon={<FolderClock className="h-5 w-5" />}
              active={mobileSection === "pending"}
              onClick={() => setMobileSection("pending")}
            />
            <MetricCard
              title="나의 해지 리스트"
              value={data.myTerminationRows.length}
              tone="bg-orange-50 text-orange-700"
              accent="bg-orange-500"
              icon={<OctagonAlert className="h-5 w-5" />}
              active={mobileSection === "termination"}
              onClick={() => setMobileSection("termination")}
            />
            <MetricCard
              title="나의 청구보류 리스트"
              value={data.myHoldRows.length}
              tone="bg-amber-50 text-amber-700"
              accent="bg-amber-500"
              icon={<CirclePause className="h-5 w-5" />}
              active={mobileSection === "hold"}
              onClick={() => setMobileSection("hold")}
            />
          </section>

          <section className="space-y-3">
            <div className={`${cardClass} ${mobileSection === "testIds" ? "block" : "hidden"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-black tracking-[-0.03em] text-slate-950">시험아이디 관리</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-[12px] text-slate-500">등록 후 표에서 바로 수정합니다.</p>
                    {testIdSaveStatus.message ? (
                      <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[12px] font-bold ${testIdSaveToneClass}`}>
                        {testIdSaveStatus.phase === "saving" ? (
                          <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-current" />
                        ) : null}
                        {testIdSaveStatus.message}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg bg-sky-50 px-3 py-1.5 text-[12px] font-bold text-sky-700">
                  {testIdEntries.length}건
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-inner">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <div className="mb-1 text-[11px] font-bold text-slate-500">등록 방식</div>
                    <div className="inline-flex h-10 shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setTestIdMode("single")}
                        className={`rounded-lg px-3 text-[12px] font-bold transition ${
                          testIdMode === "single" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        개별등록
                      </button>
                      <button
                        type="button"
                        onClick={() => setTestIdMode("bulk")}
                        className={`rounded-lg px-3 text-[12px] font-bold transition ${
                          testIdMode === "bulk" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        여러개등록
                      </button>
                    </div>
                  </div>

                  {testIdMode === "single" ? (
                    <label className="block w-full sm:w-[220px]">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">시험아이디</span>
                      <input
                        value={singleTestId}
                        onChange={(event) => setSingleTestId(event.target.value)}
                        placeholder="예: E260403"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="block w-full sm:w-[165px]">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">시작 ID</span>
                        <input
                          value={bulkStartId}
                          onChange={(event) => setBulkStartId(event.target.value)}
                          placeholder="E260403"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="block w-full sm:w-[165px]">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">끝 ID</span>
                        <input
                          value={bulkEndId}
                          onChange={(event) => setBulkEndId(event.target.value)}
                          placeholder="E260408"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="block w-full sm:w-[210px]">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">회사명 일괄</span>
                        <input
                          value={bulkCompanyName}
                          onChange={(event) => setBulkCompanyName(event.target.value)}
                          placeholder="회사명"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      testIdMode === "single"
                        ? addTestIds([singleTestId])
                        : addTestIds(buildRangeTestIds(bulkStartId, bulkEndId), bulkCompanyName)
                    }
                    className="inline-flex h-10 w-20 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-[13px] font-bold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    등록
                  </button>
                  <button
                    type="button"
                    onClick={saveTestIdEntries}
                    disabled={isTestIdSaving}
                    className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-bold transition disabled:opacity-60 ${testIdSaveButtonClass}`}
                  >
                    <Save className={testIdSaveStatus.phase === "saving" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                    {testIdSaveButtonLabel}
                  </button>
                </div>
              </div>

              {testIdMessage ? <div className="mt-2 text-[12px] text-slate-500">{testIdMessage}</div> : null}

              {testIdEntries.length ? (
                <>
                  <div className="mt-3 space-y-3 md:hidden">
                    {testIdEntries.map((entry, index) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">No. {index + 1}</div>
                            <div className="mt-1 inline-flex max-w-full items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-[14px] font-black text-sky-800">
                              <span className="h-2 w-2 rounded-full bg-sky-500" />
                              <span className="truncate">{entry.testId}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => registerTestIdAsContract(entry)}
                              disabled={Boolean(convertingTestId)}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-2.5 text-[12px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                              title="신규계약 리스트에 등록"
                            >
                              <FileSignature className={convertingTestId === entry.id ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                              {convertingTestId === entry.id ? "등록 중" : "계약등록"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTestIdEntry(entry.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                              aria-label={`${entry.testId} 삭제`}
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-bold text-slate-500">회사명</span>
                            <input
                              value={entry.companyName}
                              onChange={(event) => updateTestIdEntry(entry.id, "companyName", event.target.value)}
                              placeholder="회사명"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold text-slate-500">부서</span>
                              <input
                                value={entry.departmentName}
                                onChange={(event) => updateTestIdEntry(entry.id, "departmentName", event.target.value)}
                                placeholder="부서"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold text-slate-500">담당자</span>
                              <input
                                value={entry.assigneeName}
                                onChange={(event) => updateTestIdEntry(entry.id, "assigneeName", event.target.value)}
                                placeholder="담당자"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                          </div>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-bold text-slate-500">연락처</span>
                            <input
                              value={entry.contact}
                              onChange={(event) => updateTestIdEntry(entry.id, "contact", event.target.value)}
                              placeholder="연락처"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-bold text-slate-500">비고</span>
                            <input
                              value={entry.note}
                              onChange={(event) => updateTestIdEntry(entry.id, "note", event.target.value)}
                              placeholder="비고"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)] md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-[13px]">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] font-black text-slate-500">
                            {["시험아이디", "회사명", "부서", "담당자", "연락처", "비고", "작업"].map((head) => (
                              <th key={head || "actions"} className="border-b border-slate-200 px-3 py-2.5 text-left">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {testIdEntries.map((entry) => (
                            <tr key={entry.id} className="group bg-white transition hover:bg-blue-50/40">
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-black text-slate-900">
                                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                  {entry.testId}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={entry.companyName}
                                  onChange={(event) => updateTestIdEntry(entry.id, "companyName", event.target.value)}
                                  placeholder="회사명"
                                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-200 hover:bg-white focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={entry.departmentName}
                                  onChange={(event) => updateTestIdEntry(entry.id, "departmentName", event.target.value)}
                                  placeholder="부서"
                                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-slate-700 outline-none transition placeholder:text-slate-300 hover:border-slate-200 hover:bg-white focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={entry.assigneeName}
                                  onChange={(event) => updateTestIdEntry(entry.id, "assigneeName", event.target.value)}
                                  placeholder="담당자"
                                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-slate-700 outline-none transition placeholder:text-slate-300 hover:border-slate-200 hover:bg-white focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={entry.contact}
                                  onChange={(event) => updateTestIdEntry(entry.id, "contact", event.target.value)}
                                  placeholder="연락처"
                                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-slate-700 outline-none transition placeholder:text-slate-300 hover:border-slate-200 hover:bg-white focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={entry.note}
                                  onChange={(event) => updateTestIdEntry(entry.id, "note", event.target.value)}
                                  placeholder="비고"
                                  className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-slate-700 outline-none transition placeholder:text-slate-300 hover:border-slate-200 hover:bg-white focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="w-[170px] px-2 py-2">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => registerTestIdAsContract(entry)}
                                    disabled={Boolean(convertingTestId)}
                                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                                    title="신규계약 리스트에 등록"
                                  >
                                    <FileSignature className={convertingTestId === entry.id ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
                                    {convertingTestId === entry.id ? "등록 중" : "신규계약 등록"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTestIdEntry(entry.id)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                    aria-label={`${entry.testId} 삭제`}
                                    title="삭제"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-[12px] font-semibold text-slate-400">
                  등록된 시험아이디가 없습니다.
                </div>
              )}
            </div>

            <div className={`${cardClass} ${mobileSection === "contracts" ? "block" : "hidden"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-black tracking-[-0.03em] text-slate-950">내 신규계약 리스트</h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">월별 요약과 상세 계약을 한 화면에서 확인합니다.</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-[13px] font-semibold text-slate-600">
                  총 {data.myContracts.length}건
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.myContractMonthlySummary.length ? (
                  data.myContractMonthlySummary.map((item) => (
                    <div key={item.month} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                      <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-black text-white">{item.month}</span>
                      <span className="min-w-8 text-right text-[14px] font-black text-slate-950">{item.total}건</span>
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          미회수 {item.pending}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          회수 {item.recovered}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-[13px] text-slate-400">
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

              <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "부서", "ID", "업종", "계약월", "계약서 상태"].map((head) => (
                        <th key={head} className="px-3 py-2 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myContracts.length ? (
                      data.myContracts.slice(0, 40).map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">{formatValue(row.companyName)}</td>
                          <td className="px-3 py-2">{formatValue(row.departmentName)}</td>
                          <td className="px-3 py-2">{formatValue(row.idCode)}</td>
                          <td className="px-3 py-2">{formatValue(row.industryGroup || row.industry)}</td>
                          <td className="px-3 py-2">{formatValue(row.contractMonth)}</td>
                          <td className="px-3 py-2">{formatValue(row.documentStatus)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-[13px] text-slate-400">
                          등록된 신규계약이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${cardClass} ${mobileSection === "pending" ? "block" : "hidden"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-black tracking-[-0.03em] text-slate-950">내 이름으로 된 계약서 미회수 현황</h3>
                  <p className="mt-1 text-[13px] text-slate-500">담당 업종 기준 미회수 계약서입니다.</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700">
                  {pendingDocuments.length}건
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedIndustryLabels.length ? (
                  selectedIndustryLabels.map((industry) => (
                    <span key={industry} className="rounded-lg bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">
                      {industry}
                    </span>
                  ))
                ) : (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-500">담당 업종 미지정</span>
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

              <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "부서", "ID", "업종", "청구월", "상태"].map((head) => (
                        <th key={head} className="px-3 py-2 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDocuments.length ? (
                      pendingDocuments.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">{formatValue(row.companyName)}</td>
                          <td className="px-3 py-2">{formatValue(row.departmentName)}</td>
                          <td className="px-3 py-2">{formatValue(row.idCode)}</td>
                          <td className="px-3 py-2">{formatValue(row.industryGroup || row.industry)}</td>
                          <td className="px-3 py-2">{formatValue(row.claimMonth)}</td>
                          <td className="px-3 py-2">{formatValue(row.status)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-[13px] text-slate-400">
                          {selectedIndustryLabels.length ? "미회수 계약서가 없습니다." : "담당 업종을 선택해주세요."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className={`${cardClass} ${mobileSection === "termination" ? "block" : "hidden"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-black tracking-[-0.03em] text-slate-950">나의 해지 리스트</h3>
                  <p className="mt-1 text-[12px] text-slate-500">해지 예정 계약건입니다.</p>
                </div>
                <div className="rounded-lg bg-orange-50 px-3 py-1.5 text-[12px] font-semibold text-orange-700">
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

              <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["구분", "고객사", "부서", "고객번호", "사유", "해지일"].map((head) => (
                        <th key={head} className="px-3 py-2 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myTerminationRows.length ? (
                      data.myTerminationRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2">{formatValue(row.companyName)}</td>
                          <td className="px-3 py-2">{formatValue(row.departmentName)}</td>
                          <td className="px-3 py-2">{formatValue(row.customerId)}</td>
                          <td className="px-3 py-2">{formatValue(row.reason)}</td>
                          <td className="px-3 py-2">{formatValue(row.terminationDate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          배정된 해지 리스트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${cardClass} ${mobileSection === "hold" ? "block" : "hidden"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-black tracking-[-0.03em] text-slate-950">나의 청구보류 리스트</h3>
                  <p className="mt-1 text-[12px] text-slate-500">관리 중인 청구보류 기간입니다.</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700">
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

              <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["구분", "고객사", "부서", "고객번호", "사유", "시작일", "종료일"].map((head) => (
                        <th key={head} className="px-3 py-2 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myHoldRows.length ? (
                      data.myHoldRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2">{formatValue(row.companyName)}</td>
                          <td className="px-3 py-2">{formatValue(row.departmentName)}</td>
                          <td className="px-3 py-2">{formatValue(row.customerId)}</td>
                          <td className="px-3 py-2">{formatValue(row.reason)}</td>
                          <td className="px-3 py-2">{formatMonthDisplay(row.startDate)}</td>
                          <td className="px-3 py-2">{formatMonthDisplay(row.endDate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-[12px] text-slate-400">
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
