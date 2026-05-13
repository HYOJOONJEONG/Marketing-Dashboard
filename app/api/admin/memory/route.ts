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
const CONFIGURED_MEMORY_LIMIT_BYTES = Number(process.env.SHARED_KV_MEMORY_LIMIT_BYTES || process.env.REDIS_MEMORY_LIMIT_BYTES || 0)
const LOCAL_MEMORY_LIMIT_BYTES = Math.max(1, CONFIGURED_MEMORY_LIMIT_BYTES || 30 * 1024 * 1024)
const PERSISTENT_MEMORY_LIMIT_BYTES = Math.max(
  1,
  CONFIGURED_MEMORY_LIMIT_BYTES || Number(process.env.REDIS_PLAN_MEMORY_LIMIT_BYTES || 250 * 1024 * 1024),
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
  compactBytes?: number
  wasteBytes?: number
  updatedAt: string
}

type AnalysisRow = {
  key: string
  label: string
  bytes: number
  count?: number
  note: string
  risk: "safe" | "review" | "keep"
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

const DASHBOARD_SLICE_KEYS: Record<string, string> = {
  ui: "dashboard_ui",
  currentYear: "dashboard_current_year",
  years: "dashboard_years",
  availableYears: "dashboard_available_years",
  dailyReport: "dashboard_daily_report",
  weeklyReport: "dashboard_weekly_report",
  contracts: "dashboard_contracts",
  collection: "dashboard_collection",
  termination: "dashboard_termination",
  paidOptionSourceColumns: "dashboard_paid_option_source_columns",
}

const PROTECTED_LEGACY_DASHBOARD_KEYS = new Set([
  "ui",
  "currentYear",
  "years",
  "availableYears",
  "weeklyReport",
  "paidOptionSourceColumns",
])

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

function parseJsonValue(value: string) {
  try {
    return JSON.parse(String(value || "").replace(/^\uFEFF/, ""))
  } catch {
    return null
  }
}

function valueSize(value: unknown) {
  return byteLength(JSON.stringify(value ?? null))
}

function buildAnalysis(valueByKey: Record<string, string>) {
  const rows: AnalysisRow[] = []
  const legacyRaw = valueByKey.dashboard_state || ""
  const legacyDashboard = parseJsonValue(legacyRaw)
  const legacyTopKeys =
    legacyDashboard && typeof legacyDashboard === "object" && !Array.isArray(legacyDashboard)
      ? Object.keys(legacyDashboard as Record<string, unknown>)
      : []
  const sliceEntries = Object.entries(DASHBOARD_SLICE_KEYS)
  const existingSlices = sliceEntries.filter(([, storeKey]) => Boolean(valueByKey[storeKey]))
  const missingSlices = sliceEntries
    .filter(([sourceKey, storeKey]) => legacyTopKeys.includes(sourceKey) && !valueByKey[storeKey])
    .map(([sourceKey]) => sourceKey)
  const extraLegacyKeys = legacyTopKeys.filter((key) => !DASHBOARD_SLICE_KEYS[key])
  const protectedLegacyKeys = legacyTopKeys.filter((key) => PROTECTED_LEGACY_DASHBOARD_KEYS.has(key))
  const legacyCompactBytes = legacyRaw ? byteLength(compactJsonString(legacyRaw)) : 0
  const legacyWasteBytes = Math.max(0, byteLength(legacyRaw) - legacyCompactBytes)

  if (legacyRaw) {
    rows.push({
      key: "dashboard_state",
      label: "구버전 전체 대시보드 저장본",
      bytes: byteLength(legacyRaw),
      note:
        protectedLegacyKeys.length > 0
          ? `수동입력/주간실적보고 보호 항목이 포함되어 있어 원본 삭제 없이 누락 분리 저장본만 보강합니다. 누락 ${missingSlices.length}개.`
          : existingSlices.length > 0
          ? `분리 저장본 ${existingSlices.length}개와 중복 가능성이 있습니다. 누락 ${missingSlices.length}개, 미지원 필드 ${extraLegacyKeys.length}개.`
          : "아직 분리 저장본이 없어 바로 제거하면 안 됩니다.",
      risk: extraLegacyKeys.length || protectedLegacyKeys.length ? "review" : existingSlices.length ? "safe" : "keep",
    })
  }

  if (legacyWasteBytes > 0) {
    rows.push({
      key: "json_compaction",
      label: "JSON 공백/서식 압축 가능분",
      bytes: legacyWasteBytes,
      note: "데이터 삭제 없이 공백과 줄바꿈만 줄이는 안전 정리 대상입니다.",
      risk: "safe",
    })
  }

  if (legacyDashboard?.collection) {
    const collection = legacyDashboard.collection
    rows.push({
      key: "collection.integrated",
      label: "계약서통합관리 전체 리스트",
      bytes: valueSize(collection.integrated),
      count: Array.isArray(collection.integrated) ? collection.integrated.length : undefined,
      note: "대부분 회수 완료 과거 계약서일 수 있습니다. 업무 조회 범위를 정한 뒤 별도 보관/삭제 후보입니다.",
      risk: "review",
    })
    rows.push({
      key: "collection.longTerm",
      label: "장기미회수 계약서",
      bytes: valueSize(collection.longTerm),
      count: Array.isArray(collection.longTerm) ? collection.longTerm.length : undefined,
      note: "미회수 관리 데이터라 기본 보존 대상입니다.",
      risk: "keep",
    })
    rows.push({
      key: "collection.delivery.history",
      label: "계약서 전달리스트 히스토리",
      bytes: valueSize(collection.delivery?.history || []),
      count: Array.isArray(collection.delivery?.history) ? collection.delivery.history.length : 0,
      note: "운영에서 누적될 수 있습니다. 최근 30~60일 보관 정책 후보입니다.",
      risk: "review",
    })
  }

  const options = parseJsonValue(valueByKey.options_mock || "")
  if (options?.optionRecords) {
    rows.push({
      key: "options_mock.optionRecords",
      label: "유료 옵션 상세 레코드",
      bytes: valueSize(options.optionRecords),
      count: Array.isArray(options.optionRecords) ? options.optionRecords.length : undefined,
      note: "상세 목록 조회에 필요합니다. 카드 수치만 필요할 때만 축소 후보입니다.",
      risk: "review",
    })
  }

  return {
    rows: rows.sort((a, b) => b.bytes - a.bytes),
    legacyDashboard: {
      exists: Boolean(legacyRaw),
      bytes: byteLength(legacyRaw),
      compactBytes: legacyCompactBytes,
      wasteBytes: legacyWasteBytes,
      existingSliceCount: existingSlices.length,
      missingSlices,
      extraLegacyKeys,
      protectedLegacyKeys,
      canMigrateAndPrune: Boolean(legacyRaw) && extraLegacyKeys.length === 0,
    },
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
  const strlenCommands = redisKeys.map((key) => ["STRLEN", key])
  const getCommands = redisKeys.map((key) => ["GET", key])
  const keySizes = kvConfigured()
    ? await kvPipeline(strlenCommands)
    : await Promise.all(strlenCommands.map((command) => redisCommand<number>(REDIS_URL, command)))
  const keyValues = kvConfigured()
    ? await kvPipeline(getCommands)
    : await Promise.all(getCommands.map((command) => redisCommand<string | null>(REDIS_URL, command)))
  const [auditCount, redisInfo, redisKeyCount] = await Promise.all([
    kvConfigured()
      ? runKvCommand<number>(["LLEN", KV_AUDIT_LIST_KEY]).catch(() => 0)
      : redisCommand<number>(REDIS_URL, ["LLEN", KV_AUDIT_LIST_KEY]).catch(() => 0),
    getRedisInfo(),
    getRedisDbSize(),
  ])
  const valueByKey: Record<string, string> = {}
  const details: MemoryDetail[] = redisKeys.map((redisKey, index) => {
    const key = stripKvValuePrefix(redisKey)
    const rawValue = String(kvConfigured() ? keyValues[index]?.result || "" : keyValues[index] || "")
    valueByKey[key] = rawValue
    const compactBytes = rawValue ? byteLength(compactJsonString(rawValue)) : 0
    const bytes = Number(kvConfigured() ? keySizes[index]?.result || 0 : keySizes[index] || 0)
    return {
      key,
      label: DATA_LABELS[key] || key,
      bytes,
      compactBytes,
      wasteBytes: Math.max(0, bytes - compactBytes),
      updatedAt: "",
    }
  })
  const dataBytes = details.reduce((sum, item) => sum + item.bytes, 0)
  const auditBytes = auditCount * 1200
  const estimatedBytes = dataBytes + auditBytes
  const usedBytes = redisInfo.usedMemory || estimatedBytes
  const limitBytes = redisInfo.maxMemory || PERSISTENT_MEMORY_LIMIT_BYTES
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
    analysis: buildAnalysis(valueByKey),
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
    compactBytes: byteLength(compactJsonString(String(row?.value || ""))),
    wasteBytes: Math.max(0, byteLength(String(row?.value || "")) - byteLength(compactJsonString(String(row?.value || "")))),
    updatedAt: String(row?.updated_at || ""),
  }))
  const valueByKey = Object.fromEntries(entries.map(([key, row]) => [key, String(row?.value || "")]))
  const auditBytes = byteLength(JSON.stringify(auditRows))
  const usedBytes = raw ? byteLength(raw) : details.reduce((sum, item) => sum + item.bytes, 0) + auditBytes
  return {
    source: "Local JSON",
    usedBytes,
    freeBytes: Math.max(0, LOCAL_MEMORY_LIMIT_BYTES - usedBytes),
    limitBytes: LOCAL_MEMORY_LIMIT_BYTES,
    percent: Math.min(100, (usedBytes / LOCAL_MEMORY_LIMIT_BYTES) * 100),
    auditCount: auditRows.length,
    auditBytes,
    redisKeyCount: entries.length,
    measuredBytes: 0,
    estimatedBytes: usedBytes,
    details: details.sort((a, b) => b.bytes - a.bytes),
    analysis: buildAnalysis(valueByKey),
    recommendations: buildRecommendations(usedBytes, auditBytes, LOCAL_MEMORY_LIMIT_BYTES),
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

function buildDashboardMigrationPlan(legacyRaw: string, existingValues: Record<string, string>) {
  const legacy = parseJsonValue(legacyRaw)
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    throw new Error("legacy dashboard_state is not a valid object")
  }
  const legacyObject = legacy as Record<string, unknown>
  const extraKeys = Object.keys(legacyObject).filter((key) => !DASHBOARD_SLICE_KEYS[key])
  if (extraKeys.length) {
    throw new Error(`unsupported legacy dashboard fields: ${extraKeys.join(", ")}`)
  }
  const protectedLegacyKeys = Object.keys(legacyObject).filter((key) => PROTECTED_LEGACY_DASHBOARD_KEYS.has(key))
  const payloads = Object.entries(DASHBOARD_SLICE_KEYS)
    .filter(([sourceKey, storeKey]) => Object.prototype.hasOwnProperty.call(legacyObject, sourceKey) && !existingValues[storeKey])
    .map(([sourceKey, storeKey]) => ({
      storeKey,
      value: JSON.stringify(legacyObject[sourceKey] ?? null),
    }))
  return {
    payloads,
    protectedLegacyKeys,
    compactedLegacyRaw: compactJsonString(legacyRaw),
  }
}

async function migrateAndPruneLocalLegacyDashboard() {
  const { raw, store } = await readLocalStore()
  const beforeBytes = byteLength(raw)
  const kvStore = store.kv_store || {}
  const legacyRaw = String(kvStore.dashboard_state?.value || "")
  if (!legacyRaw) return { beforeBytes, afterBytes: beforeBytes, savedBytes: 0, migratedSlices: 0, deletedLegacy: false }

  const existingValues = Object.fromEntries(Object.entries(kvStore).map(([key, row]) => [key, String(row?.value || "")]))
  const { payloads, protectedLegacyKeys, compactedLegacyRaw } = buildDashboardMigrationPlan(legacyRaw, existingValues)
  const now = new Date().toISOString()
  payloads.forEach((item) => {
    kvStore[item.storeKey] = { value: item.value, updated_at: now }
  })
  const shouldKeepLegacy = protectedLegacyKeys.length > 0
  if (shouldKeepLegacy) {
    kvStore.dashboard_state = { value: compactedLegacyRaw, updated_at: kvStore.dashboard_state?.updated_at || now }
  } else {
    delete kvStore.dashboard_state
  }
  store.kv_store = kvStore
  store.kv_audit_log = normalizeAuditRows(store.kv_audit_log || [])
  const nextRaw = JSON.stringify(store)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, nextRaw, "utf8")
  const afterBytes = byteLength(nextRaw)
  return {
    beforeBytes,
    afterBytes,
    savedBytes: Math.max(0, beforeBytes - afterBytes),
    migratedSlices: payloads.length,
    deletedLegacy: !shouldKeepLegacy,
    protectedLegacy: shouldKeepLegacy,
    protectedLegacyKeys,
  }
}

async function migrateAndPrunePersistentLegacyDashboard() {
  const keys = Object.values(DASHBOARD_SLICE_KEYS)
  const commands = [["GET", kvValueKey("dashboard_state")], ...keys.map((key) => ["GET", kvValueKey(key)])]
  const results = kvConfigured()
    ? await kvPipeline(commands)
    : await Promise.all(commands.map((command) => redisCommand<string | null>(REDIS_URL, command)))
  const legacyRaw = String(kvConfigured() ? results[0]?.result || "" : results[0] || "")
  if (!legacyRaw) return { beforeBytes: 0, afterBytes: 0, savedBytes: 0, migratedSlices: 0, deletedLegacy: false }
  const existingValues: Record<string, string> = {}
  keys.forEach((key, index) => {
    existingValues[key] = String(kvConfigured() ? results[index + 1]?.result || "" : results[index + 1] || "")
  })
  const { payloads, protectedLegacyKeys, compactedLegacyRaw } = buildDashboardMigrationPlan(legacyRaw, existingValues)
  const writeCommands = payloads.map((item) => ["SET", kvValueKey(item.storeKey), item.value])
  const shouldKeepLegacy = protectedLegacyKeys.length > 0
  const legacyCommand = shouldKeepLegacy
    ? compactedLegacyRaw !== legacyRaw
      ? ["SET", kvValueKey("dashboard_state"), compactedLegacyRaw]
      : null
    : ["DEL", kvValueKey("dashboard_state")]
  if (kvConfigured()) {
    await kvPipeline(legacyCommand ? [...writeCommands, legacyCommand] : writeCommands)
  } else {
    for (const command of writeCommands) await redisCommand(REDIS_URL, command)
    if (legacyCommand) await redisCommand(REDIS_URL, legacyCommand)
  }
  const afterBytes = payloads.reduce((sum, item) => sum + byteLength(item.value), 0) + (shouldKeepLegacy ? byteLength(compactedLegacyRaw) : 0)
  return {
    beforeBytes: byteLength(legacyRaw),
    afterBytes,
    savedBytes: Math.max(0, byteLength(legacyRaw) - afterBytes),
    migratedSlices: payloads.length,
    deletedLegacy: !shouldKeepLegacy,
    protectedLegacy: shouldKeepLegacy,
    protectedLegacyKeys,
  }
}

export async function GET() {
  try {
    const auth = await requireApiPermission("storageManagement", "view")
    if (!auth.ok) return auth.response
    const stats = persistentStoreConfigured() ? await getPersistentStats() : await getLocalStats()
    return NextResponse.json({ ok: true, stats })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "memory stats failed" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiPermission("storageManagement", "admin")
    if (!auth.ok) return auth.response
    const body = await request.json().catch(() => null)
    const action = String(body?.action || "")
    if (action !== "compact" && action !== "migrateLegacyDashboard") {
      return NextResponse.json({ ok: false, error: "unsupported action" }, { status: 400 })
    }
    const cleanup =
      action === "migrateLegacyDashboard"
        ? persistentStoreConfigured()
          ? await migrateAndPrunePersistentLegacyDashboard()
          : await migrateAndPruneLocalLegacyDashboard()
        : persistentStoreConfigured()
          ? await compactPersistentStore()
          : await compactLocalStore()
    const stats = persistentStoreConfigured() ? await getPersistentStats() : await getLocalStats()
    return NextResponse.json({ ok: true, cleanup, stats })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "memory cleanup failed" }, { status: 500 })
  }
}
