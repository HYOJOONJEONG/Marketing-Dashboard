"use client"

import { Archive, Download, RefreshCw, ShieldCheck, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

type MemoryDetail = {
  key: string
  label: string
  bytes: number
  compactBytes?: number
  wasteBytes?: number
  updatedAt?: string
}

type AnalysisRow = {
  key: string
  label: string
  bytes: number
  count?: number
  note: string
  risk: "safe" | "review" | "keep"
}

type MemoryStats = {
  source: string
  usedBytes: number
  freeBytes: number
  limitBytes: number
  percent: number
  auditCount: number
  auditBytes: number
  redisKeyCount?: number
  measuredBytes?: number
  estimatedBytes?: number
  details: MemoryDetail[]
  analysis?: {
    rows: AnalysisRow[]
    legacyDashboard?: {
      exists: boolean
      bytes: number
      compactBytes: number
      wasteBytes: number
      existingSliceCount: number
      missingSlices: string[]
      extraLegacyKeys: string[]
      canMigrateAndPrune: boolean
    }
  }
  recommendations: string[]
}

type StorageActionTone = "slate" | "emerald" | "rose" | "blue" | "amber"

class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[index]}`
}

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
}

const actionToneClasses: Record<StorageActionTone, { button: string; icon: string; note: string }> = {
  slate: {
    button: "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
    icon: "bg-slate-100 text-slate-600",
    note: "text-slate-500",
  },
  emerald: {
    button: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100",
    icon: "bg-emerald-100 text-emerald-700",
    note: "text-emerald-700",
  },
  rose: {
    button: "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100",
    icon: "bg-rose-100 text-rose-700",
    note: "text-rose-700",
  },
  blue: {
    button: "border-blue-200 bg-blue-600 text-white hover:bg-blue-700",
    icon: "bg-white/20 text-white",
    note: "text-blue-700",
  },
  amber: {
    button: "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100",
    icon: "bg-amber-100 text-amber-700",
    note: "text-amber-700",
  },
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    const message =
      response.status === 401
        ? "관리자 로그인 세션이 만료되었습니다. 다시 로그인하면 저장공간을 조회할 수 있습니다."
        : payload?.error || `요청 실패 (${response.status})`
    throw new ApiRequestError(message, response.status)
  }
  return payload
}

export function StorageMemoryPanel({ canRestore = false }: { canRestore?: boolean }) {
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [error, setError] = useState("")
  const [cleanupMessage, setCleanupMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isRestorePending, startRestoreTransition] = useTransition()

  const loadStats = async () => {
    setError("")
    const payload = await fetchJson("/api/admin/memory")
    setStats(payload.stats)
  }

  useEffect(() => {
    void loadStats().catch((err) => setError(String(err?.message || "저장공간 정보를 불러오지 못했습니다.")))
  }, [])

  const statusTone = useMemo(() => {
    const percent = stats?.percent || 0
    if (percent >= 85) return { label: "위험", color: "#ef4444", bg: "bg-rose-50", text: "text-rose-700" }
    if (percent >= 70) return { label: "주의", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700" }
    return { label: "안정", color: "#2563eb", bg: "bg-blue-50", text: "text-blue-700" }
  }, [stats?.percent])

  const runCleanup = () => {
    if (!window.confirm("저장 데이터 원문을 압축하고 오래된 수정로그를 정리합니다. 계속할까요?")) return
    setCleanupMessage("")
    setError("")
    startTransition(async () => {
      try {
        const payload = await fetchJson("/api/admin/memory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "compact" }),
        })
        setStats(payload.stats)
        setCleanupMessage(`안전 정리 완료: ${formatBytes(payload.cleanup?.savedBytes || 0)} 절감`)
      } catch (err: any) {
        setError(String(err?.message || "안전 정리에 실패했습니다."))
      }
    })
  }

  const runLegacyCleanup = () => {
    const legacy = stats?.analysis?.legacyDashboard
    if (!legacy?.canMigrateAndPrune) return
    if (!window.confirm("구버전 전체 대시보드 저장본을 분리 저장본으로 보존한 뒤 제거합니다. 이미 분리 저장된 최신 데이터는 덮어쓰지 않습니다. 계속할까요?")) return
    setCleanupMessage("")
    setError("")
    startTransition(async () => {
      try {
        const payload = await fetchJson("/api/admin/memory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "migrateLegacyDashboard" }),
        })
        setStats(payload.stats)
        setCleanupMessage(`구버전 저장본 정리 완료: ${formatBytes(payload.cleanup?.savedBytes || 0)} 절감`)
      } catch (err: any) {
        setError(String(err?.message || "구버전 저장본 정리에 실패했습니다."))
      }
    })
  }

  const downloadBackup = () => {
    const link = document.createElement("a")
    link.href = "/api/admin/backup"
    link.download = ""
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const openRestoreFilePicker = () => {
    setError("")
    setCleanupMessage("")
    restoreInputRef.current?.click()
  }

  const restoreFromBackup = (file: File) => {
    if (!canRestore) {
      setError("복구 실행 권한이 없습니다. 관리자페이지의 수정가능 권한이 필요합니다.")
      if (restoreInputRef.current) restoreInputRef.current.value = ""
      return
    }
    if (!window.confirm(`"${file.name}" 파일로 현재 대시보드/옵션 데이터를 복구합니다. 실행 전에 현재 상태 백업을 먼저 다운로드합니다. 계속할까요?`)) {
      if (restoreInputRef.current) restoreInputRef.current.value = ""
      return
    }
    setCleanupMessage("현재 상태 백업을 먼저 다운로드한 뒤 복구를 시작합니다.")
    downloadBackup()
    startRestoreTransition(async () => {
      try {
        const body = new FormData()
        body.append("file", file)
        const payload = await fetchJson("/api/admin/backup", {
          method: "POST",
          body,
        })
        await loadStats()
        setCleanupMessage(`백업 복구 완료: ${(payload.restored || []).join(", ") || "데이터"} 반영`)
      } catch (err: any) {
        setError(String(err?.message || "백업 복구에 실패했습니다."))
      } finally {
        if (restoreInputRef.current) restoreInputRef.current.value = ""
      }
    })
  }

  const percent = Math.round(stats?.percent || 0)
  const chartStyle = {
    background: `conic-gradient(${statusTone.color} ${Math.min(100, stats?.percent || 0)}%, #e2e8f0 0)`,
  }
  const legacyDashboard = stats?.analysis?.legacyDashboard
  const storageActions = [
    {
      key: "refresh",
      label: "새로고침",
      note: "DB 변경 없이 현재 사용량만 다시 조회",
      icon: RefreshCw,
      tone: "slate" as const,
      onClick: () => void loadStats().catch((err) => setError(String(err?.message || "새로고침 실패"))),
      disabled: false,
    },
    {
      key: "download",
      label: "자동백업 다운로드",
      note: "대시보드/옵션 데이터를 JSON으로 저장",
      icon: Download,
      tone: "emerald" as const,
      onClick: downloadBackup,
      disabled: false,
    },
    {
      key: "restore",
      label: isRestorePending ? "복구 중" : "백업 JSON 복구",
      note: canRestore ? "백업 파일로 대시보드/옵션 값 복원" : "관리자페이지 수정가능 권한 필요",
      icon: Upload,
      tone: "rose" as const,
      onClick: openRestoreFilePicker,
      disabled: !canRestore || isRestorePending,
    },
    {
      key: "cleanup",
      label: isPending ? "정리 중" : "안전 정리 실행",
      note: "원문 압축과 오래된 수정로그 정리",
      icon: ShieldCheck,
      tone: "blue" as const,
      onClick: runCleanup,
      disabled: isPending || !stats,
    },
    {
      key: "legacy",
      label: "구버전 저장본 정리",
      note: "분리 저장 후 남은 과거 저장본 제거",
      icon: Archive,
      tone: "amber" as const,
      onClick: runLegacyCleanup,
      disabled: isPending || !legacyDashboard?.canMigrateAndPrune,
    },
  ]

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">저장공간 / 메모리 관리</h2>
          <p className="mt-1 text-sm text-slate-500">Redis 경고 기준으로 현재 사용량과 수정로그 비중을 확인합니다.</p>
        </div>
      </div>
      <input
        ref={restoreInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) restoreFromBackup(file)
        }}
      />
      <div className="mt-4 grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 xl:grid-cols-5">
        {storageActions.map((action) => {
          const Icon = action.icon
          const tone = actionToneClasses[action.tone]
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.note}
              className={`min-h-[86px] rounded-2xl border px-3 py-3 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${tone.button}`}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-black leading-tight">{action.label}</span>
              </div>
              <div className={`mt-2 text-[11px] font-bold leading-snug ${action.tone === "blue" ? "text-blue-50" : tone.note}`}>
                {action.note}
              </div>
            </button>
          )
        })}
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>}
      {cleanupMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {cleanupMessage}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-center">
            <div className="relative h-40 w-40 rounded-full p-4" style={chartStyle}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className="text-3xl font-black text-slate-950">{percent}%</span>
                <span className={`mt-1 rounded-full px-2 py-1 text-xs font-black ${statusTone.bg} ${statusTone.text}`}>{statusTone.label}</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-white p-3">
              <div className="text-xs font-bold text-slate-400">사용 중</div>
              <div className="mt-1 font-black text-slate-950">{formatBytes(stats?.usedBytes || 0)}</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-xs font-bold text-slate-400">여유 공간</div>
              <div className="mt-1 font-black text-slate-950">{formatBytes(stats?.freeBytes || 0)}</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-xs font-bold text-slate-400">기준 한도</div>
              <div className="mt-1 font-black text-slate-950">{formatBytes(stats?.limitBytes || 0)}</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-xs font-bold text-slate-400">수정로그</div>
              <div className="mt-1 font-black text-slate-950">{stats?.auditCount || 0}건</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-xs font-bold text-slate-400">Redis 키</div>
              <div className="mt-1 font-black text-slate-950">{stats?.redisKeyCount || 0}개</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-xs font-bold text-slate-400">데이터 추정</div>
              <div className="mt-1 font-black text-slate-950">{formatBytes(stats?.estimatedBytes || stats?.usedBytes || 0)}</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs font-semibold text-slate-400">
            <div>저장소: {stats?.source || "-"}</div>
            {stats?.measuredBytes ? <div>Redis 실측 메모리: {formatBytes(stats.measuredBytes)}</div> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 p-4">
            <div className="text-sm font-black text-slate-950">관리 메모</div>
            <div className="mt-3 grid gap-2">
              {(stats?.recommendations || ["저장공간 정보를 불러오는 중입니다."]).map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">상세 정리 후보</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">업무 데이터와 중복/압축 후보를 분리해서 보여줍니다.</div>
              </div>
              {legacyDashboard?.exists ? (
                <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  legacy {formatBytes(legacyDashboard.bytes)} / 압축 가능 {formatBytes(legacyDashboard.wasteBytes)}
                </div>
              ) : null}
            </div>
            {legacyDashboard?.exists ? (
              <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-2">분리 저장본 {legacyDashboard.existingSliceCount}개</div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">누락 {legacyDashboard.missingSlices.length}개</div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">미지원 필드 {legacyDashboard.extraLegacyKeys.length}개</div>
              </div>
            ) : null}
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="px-4 py-3 text-left font-black">후보</th>
                    <th className="px-4 py-3 text-right font-black">크기</th>
                    <th className="px-4 py-3 text-right font-black">건수</th>
                    <th className="px-4 py-3 text-left font-black">판단</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.analysis?.rows || []).map((item) => (
                    <tr key={item.key} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.label}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">{item.key}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-950">{formatBytes(item.bytes)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{item.count == null ? "-" : item.count.toLocaleString("ko-KR")}</td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${
                          item.risk === "safe"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.risk === "review"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {item.risk === "safe" ? "정리 가능" : item.risk === "review" ? "검토 필요" : "보존"}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{item.note}</div>
                      </td>
                    </tr>
                  ))}
                  {!stats?.analysis?.rows?.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
                        상세 분석 대상이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 text-left font-black">구분</th>
                  <th className="px-4 py-3 text-right font-black">크기</th>
                  <th className="px-4 py-3 text-right font-black">압축 가능</th>
                  <th className="px-4 py-3 text-left font-black">수정일</th>
                  <th className="px-4 py-3 text-left font-black">키</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.details || []).map((item) => (
                  <tr key={item.key} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.label}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">{formatBytes(item.bytes)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600">{formatBytes(item.wasteBytes || 0)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.updatedAt)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-400">{item.key}</td>
                  </tr>
                ))}
                {!stats?.details?.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
                      저장된 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
