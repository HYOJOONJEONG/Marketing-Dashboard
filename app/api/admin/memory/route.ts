import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { requireApiPermission } from "@/lib/auth/server"
import { redisCommand } from "@/lib/redis-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STORE_PATH = path.join(process.cwd(), "data", "shared-kv-store.json")
const KV_REST_API_URL =
  process.env.KV_REST_API_URL?.trim() ||
  process.env.UPSTASH_REDIS_REST_URL?.trim() ||
  ""
const KV_REST_API_TOKEN =
  process.env.KV_REST_API_TOKEN?.trim() ||
  process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
  process.env.KV_REST_API_READ_ONLY_TOKEN?.trim() ||
  process.env.UPSTASH_REDIS_REST_READ_ONLY_TOKEN?.trim() ||
  ""
const REDIS_URL = process.env.REDIS_URL?.trim() || ""
const MEMORY_LIMIT_BYTES = Math.max(
  1,
  Number(process.env.SHARED_KV_MEMORY_LIMIT_BYTES || process.env.REDIS_MEMORY_LIMIT_BYTES || 30 * 1024 * 1024),
)
const AUDIT_RETAIN_LIMIT = Math.max(20, Math.min(500, Number(process.env.SHARED_KV_AUDIT_RETAIN_LIMIT || 200)))
const AUDIT_SNAPSHOT_LIMIT = Math.max(0, Number(process.env.SHARED_KV_AUDIT_SNAPSHOT_LIMIT || 20000))
const KV_AUDIT_LIST_KEY = "shared-kv:audit"

type StoreShape = {
  kv_store?: Record<string, { value?: string; updated_at?: string }>
  kv_audit_log?: Array<Record<string, unknown>>
}

type MemoryDetail = {
  key: string
  label: string
  bytes: number
  updatedAt: string
}

const DATA_LABELS: Record<string, string> = {
  dashboard_state: "전체 대시보드",
  dashboard_ui: "화면 설정",
  dashboard_current_year: "기준연도",
  dashboard_years: "연도 데이터",
  dashboard_available_years: "연도 목록",
  dashboard_daily_report: "업무일지",
  dashboard_weekly_report: "주간실적보고",
  dashboard_contracts: "신규계약/계약",
  dashboard_collection: "계약서 통합관리",
  dashboard_termination: "해지 진행사항",
  dashboard_paid_option_source_columns: "옵션 컬럼 설정",
  options_mock: "유료 옵션 정보",
  auth_system: "사용자/권한",
}

function kvConfigured() {
  return Boolean(KV_REST_API_URL && KV_REST_API_TOKEN)
}

function redisConfigured() {
  return Boolean(REDIS_URL)
}

function persistentStoreConfigured() {
  return kvConfigured() || redisConfigured()
}

function kvValueKey(key: string) {
  return `shared-kv:value:${key}`
}

function stripKvValuePrefix(key: string) {
  return key.replace(/^shared-kv:value:/, "")
}

function byteLength(value: string) {
  return Buffer.byteLength(value || "", "utf8")
}

function compactJsonString(value: string) {
  try {
    return JSON.stringify(JSON.parse(String(value || "").replace(/^\uFEFF/, "")))
  } catch {
    return String(value || "")
  }
}

async function readLocalStore(): Promise<{ raw: string; store: StoreShape }> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8")
    return { raw, store: JSON.parse(raw.replace(/^\uFEFF/, "")) }
  } catch {
    return { raw: "", store: { kv_store: {}, kv_audit_log: [] } }
  }
}

function normalizeAuditRows(rows: Array<Record<string, unknown>>) {
  return rows.slice(-AUDIT_RETAIN_LIMIT).map((row) => {
    const snapshot = typeof row.value_snapshot === "string" ? row.value_snapshot : ""
    return {
      ...row,
      value_snapshot: snapshot.length <= AUDIT_SNAPSHOT_LIMIT ? snapshot : "",
    }
  })
}

async function kvPipeline(commands: unknown[][]) {
  const resp = await fetch(`${KV_REST_API_URL.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KV_REST_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  })
  if (!resp.ok) throw new Error(`KV pipeline failed (${resp.status})`)
  const json = await resp.json()
  if (!Array.isArray(json)) throw new Error("Invalid KV pipeline response")
  const failed = json.find((item) => item?.error)
  if (failed?.error) throw new Error(String(failed.error))
  return json
}

async function runKvCommand<T = unknown>(command: unknown[]) {
  const result = await kvPipeline([command])
  return result[0]?.result as T
}

function parseRedisInfoNumber(info: unknown, field: string) {
  const text = typeof info === "string" ? info : ""
  const match = text.match(new RegExp(`(?:^|\\r?\\n)${field}:(\\d+)`))
  return match ? Number(match[1]) : 0
}

async function getRedisInfo() {
  try {
    const info = kvConfigured()
      ? await runKvCommand<string>(["INFO", "memory"])
      : await redisCommand<string>(REDIS_URL, ["INFO", "memory"])
    return {
      usedMemory: parseRedisInfoNumber(info, "used_memory"),
      maxMemory: parseRedisInfoNumber(info, "maxmemory"),
    }
  } catch {
    return { usedMemory: 0, maxMemory: 0 }
  }
}

async function getRedisDbSize() {
  try {
    return Number(
      kvConfigured()
        ? await runKvCommand<number>(["DBSIZE"])
        : await redisCommand<number>(REDIS_URL, ["DBSIZE"]),
    )
  } catch {
    return 0
  }
}

async function listPersistentValueKeys() {
  const fallbackKeys = Object.keys(DATA_LABELS).map(kvValueKey)
  try {
    const keys = kvConfigured()
      ? await runKvCommand<string[]>(["KEYS", "shared-kv:value:*"])
      : await redisCommand<string[]>(REDIS_URL, ["KEYS", "shared-kv:value:*"])
    const normalized = Array.isArray(keys) ? keys.map(String).filter(Boolean) : []
    return normalized.length ? normalized : fallbackKeys
  } catch {
    return fallbackKeys
  }
}

async function getPersistentStats() {
  const redisKeys = await listPersistentValueKeys()
  const commands = redisKeys.map((key) => ["STRLEN", key])
  const keySizes = kvConfigured()
    ? await kvPipeline(commands)
    : await Promise.all(commands.map((command) => redisCommand<number>(REDIS_URL, command)))
  const [auditCount, redisInfo, redisKeyCount] = await Promise.all([
    kvConfigured()
      ? runKvCommand<number>(["LLEN", KV_AUDIT_LIST_KEY]).catch(() => 0)
      : redisCommand<number>(REDIS_URL, ["LLEN", KV_AUDIT_LIST_KEY]).catch(() => 0),
    getRedisInfo(),
    getRedisDbSize(),
  ])
  const details: MemoryDetail[] = redisKeys.map((redisKey, index) => {
    const key = stripKvValuePrefix(redisKey)
    return {
      key,
      label: DATA_LABELS[key] || key,
      bytes: Number(kvConfigured() ? keySizes[index]?.result || 0 : keySizes[index] || 0),
      updatedAt: "",
    }
  })
  const dataBytes = details.reduce((sum, item) => sum + item.bytes, 0)
  const auditBytes = auditCount * 1200
  const estimatedBytes = dataBytes + auditBytes
  const usedBytes = redisInfo.usedMemory || estimatedBytes
  const limitBytes = redisInfo.maxMemory || MEMORY_LIMIT_BYTES
  return {
    source: kvConfigured() ? "Upstash/Vercel Redis REST" : "Redis URL",
    usedBytes,
    freeBytes: Math.max(0, limitBytes - usedBytes),
    limitBytes,
    percent: Math.min(100, (usedBytes / limitBytes) * 100),
    auditCount: Number(auditCount || 0),
    auditBytes,
    redisKeyCount,
    measuredBytes: redisInfo.usedMemory,
    estimatedBytes,
    details: details.sort((a, b) => b.bytes - a.bytes),
    recommendations: buildRecommendations(usedBytes, auditBytes, limitBytes),
  }
}

async function getLocalStats() {
  const { raw, store } = await readLocalStore()
  const entries = Object.entries(store.kv_store || {})
  const auditRows = store.kv_audit_log || []
  const details = entries.map(([key, row]) => ({
    key,
    label: DATA_LABELS[key] || key,
    bytes: byteLength(String(row?.value || "")),
    updatedAt: String(row?.updated_at || ""),
  }))
  const auditBytes = byteLength(JSON.stringify(auditRows))
  const usedBytes = raw ? byteLength(raw) : details.reduce((sum, item) => sum + item.bytes, 0) + auditBytes
  return {
    source: "Local JSON",
    usedBytes,
    freeBytes: Math.max(0, MEMORY_LIMIT_BYTES - usedBytes),
    limitBytes: MEMORY_LIMIT_BYTES,
    percent: Math.min(100, (usedBytes / MEMORY_LIMIT_BYTES) * 100),
    auditCount: auditRows.length,
    auditBytes,
    redisKeyCount: entries.length,
    measuredBytes: 0,
    estimatedBytes: usedBytes,
    details: details.sort((a, b) => b.bytes - a.bytes),
    recommendations: buildRecommendations(usedBytes, auditBytes, MEMORY_LIMIT_BYTES),
  }
}

function buildRecommendations(usedBytes: number, auditBytes: number, limitBytes: number) {
  const items = []
  if (usedBytes / limitBytes >= 0.8) {
    items.push("사용량이 80%를 넘었습니다. 수정로그 보관 수와 큰 스냅샷을 줄이는 정리가 필요합니다.")
  }
  if (auditBytes > usedBytes * 0.25) {
    items.push("수정로그가 전체 저장공간의 큰 비중을 차지합니다. 안전 정리로 오래된 로그를 압축하세요.")
  }
  if (!items.length) items.push("현재는 안정권입니다. 그래도 정기적으로 안전 정리를 실행하면 여유공간을 유지할 수 있습니다.")
  return items
}

async function compactLocalStore() {
  const { raw, store } = await readLocalStore()
  const beforeBytes = byteLength(raw)
  const kvStore = store.kv_store || {}
  for (const row of Object.values(kvStore)) {
    row.value = compactJsonString(String(row.value || ""))
  }
  store.kv_store = kvStore
  store.kv_audit_log = normalizeAuditRows(store.kv_audit_log || [])
  const compacted = JSON.stringify(store)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, compacted, "utf8")
  const afterBytes = byteLength(compacted)
  return { beforeBytes, afterBytes, savedBytes: Math.max(0, beforeBytes - afterBytes) }
}

async function compactPersistentStore() {
  const keys = Object.keys(DATA_LABELS)
  let beforeBytes = 0
  let afterBytes = 0
  for (const key of keys) {
    const redisKey = kvValueKey(key)
    const value = kvConfigured()
      ? String((await kvPipeline([["GET", redisKey]]))[0]?.result || "")
      : String((await redisCommand<string | null>(REDIS_URL, ["GET", redisKey])) || "")
    if (!value) continue
    const compacted = compactJsonString(value)
    beforeBytes += byteLength(value)
    afterBytes += byteLength(compacted)
    if (compacted !== value) {
      if (kvConfigured()) await kvPipeline([["SET", redisKey, compacted]])
      else await redisCommand(REDIS_URL, ["SET", redisKey, compacted])
    }
  }
  if (kvConfigured()) await kvPipeline([["LTRIM", KV_AUDIT_LIST_KEY, 0, AUDIT_RETAIN_LIMIT - 1]])
  else await redisCommand(REDIS_URL, ["LTRIM", KV_AUDIT_LIST_KEY, 0, AUDIT_RETAIN_LIMIT - 1])
  return { beforeBytes, afterBytes, savedBytes: Math.max(0, beforeBytes - afterBytes) }
}

export async function GET() {
  try {
    const auth = await requireApiPermission("adminPage", "view")
    if (!auth.ok) return auth.response
    const stats = persistentStoreConfigured() ? await getPersistentStats() : await getLocalStats()
    return NextResponse.json({ ok: true, stats })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "memory stats failed" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiPermission("adminPage", "admin")
    if (!auth.ok) return auth.response
    const body = await request.json().catch(() => null)
    if (String(body?.action || "") !== "compact") {
      return NextResponse.json({ ok: false, error: "unsupported action" }, { status: 400 })
    }
    const cleanup = persistentStoreConfigured() ? await compactPersistentStore() : await compactLocalStore()
    const stats = persistentStoreConfigured() ? await getPersistentStats() : await getLocalStats()
    return NextResponse.json({ ok: true, cleanup, stats })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "memory cleanup failed" }, { status: 500 })
  }
}
