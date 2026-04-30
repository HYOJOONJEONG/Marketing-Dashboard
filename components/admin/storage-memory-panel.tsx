"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

type MemoryDetail = {
  key: string
  label: string
  bytes: number
  updatedAt?: string
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
  recommendations: string[]
}

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

export function StorageMemoryPanel() {
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [error, setError] = useState("")
  const [cleanupMessage, setCleanupMessage] = useState("")
  const [isPending, startTransition] = useTransition()

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

  const percent = Math.round(stats?.percent || 0)
  const chartStyle = {
    background: `conic-gradient(${statusTone.color} ${Math.min(100, stats?.percent || 0)}%, #e2e8f0 0)`,
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">저장공간 / 메모리 관리</h2>
          <p className="mt-1 text-sm text-slate-500">Redis 경고 기준으로 현재 사용량과 수정로그 비중을 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadStats().catch((err) => setError(String(err?.message || "새로고침 실패")))}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={runCleanup}
            disabled={isPending || !stats}
            className="h-10 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "정리 중" : "안전 정리 실행"}
          </button>
        </div>
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

          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 text-left font-black">구분</th>
                  <th className="px-4 py-3 text-right font-black">크기</th>
                  <th className="px-4 py-3 text-left font-black">수정일</th>
                  <th className="px-4 py-3 text-left font-black">키</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.details || []).map((item) => (
                  <tr key={item.key} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.label}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">{formatBytes(item.bytes)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.updatedAt)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-400">{item.key}</td>
                  </tr>
                ))}
                {!stats?.details?.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
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
