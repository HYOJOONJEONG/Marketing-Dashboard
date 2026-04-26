import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import { redisCommand } from "@/lib/redis-client"

const DEFAULT_STORE_PATH = path.join(process.cwd(), "data", "shared-kv-store.json")
const CENTRAL_DB_API_URL = process.env.CENTRAL_DB_API_URL?.trim() || ""
const CENTRAL_DB_API_TOKEN = process.env.CENTRAL_DB_API_TOKEN?.trim() || ""
const SHARED_KV_API_KEY = process.env.SHARED_KV_API_KEY?.trim() || CENTRAL_DB_API_TOKEN
const CENTRAL_DB_SOURCE = process.env.CENTRAL_DB_SOURCE?.trim() || "unknown-client"
const KV_REST_API_URL = process.env.KV_REST_API_URL?.trim() || ""
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN?.trim() || ""
const REDIS_URL = process.env.REDIS_URL?.trim() || ""
const SHARED_DB_READ_ONLY = process.env.SHARED_DB_READ_ONLY === "1"
const SHARED_DB_REQUIRE_CENTRAL = process.env.SHARED_DB_REQUIRE_CENTRAL === "1" || process.env.VERCEL === "1"
const SHARED_DB_ALLOW_SEED = process.env.SHARED_DB_ALLOW_SEED !== "0"

const STORE_KEYS = {
  dashboard: "dashboard_state",
  options: "options_mock",
  auth: "auth_system",
} as const

type SharedKey = (typeof STORE_KEYS)[keyof typeof STORE_KEYS]

type WriteAuditMeta = {
  menuLabel?: string
  changeLabel?: string
}

type StoreShape = {
  kv_store: Record<string, { value: string; updated_at: string }>
  kv_audit_log: Array<{
    id: number
    key: string
    actor: string
    action: string
    summary?: string
    menu_label?: string
    change_label?: string
    value_snapshot?: string
    prev_hash?: string
    row_hash?: string
    created_at: string
  }>
}

let writeQueue: Promise<void> = Promise.resolve()

function ensureWritableStoreConfigured() {
  if (SHARED_DB_REQUIRE_CENTRAL && !CENTRAL_DB_API_URL && !kvConfigured() && !redisConfigured()) {
    throw new Error("Persistent DB is not configured for writes. Configure Redis or KV environment variables.")
  }
}

function kvConfigured() {
  return Boolean(KV_REST_API_URL && KV_REST_API_TOKEN)
}

function redisConfigured() {
  return Boolean(REDIS_URL)
}

async function kvCommand<T = unknown>(command: unknown[]) {
  const resp = await fetch(`${KV_REST_API_URL.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KV_REST_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  })
  if (!resp.ok) throw new Error(`KV command failed (${resp.status})`)
  const json = await resp.json()
  const first = Array.isArray(json) ? json[0] : null
  if (first?.error) throw new Error(String(first.error))
  return first?.result as T
}

function kvValueKey(key: SharedKey) {
  return `shared-kv:value:${key}`
}

function buildCentralApiHeaders(extra?: Record<string, string>) {
  const authHeaders: Record<string, string> = {
    ...(extra || {}),
  }
  if (SHARED_KV_API_KEY) {
    authHeaders["x-api-key"] = SHARED_KV_API_KEY
    authHeaders.authorization = `Bearer ${SHARED_KV_API_KEY}`
  }
  if (CENTRAL_DB_API_TOKEN) {
    authHeaders["x-central-token"] = CENTRAL_DB_API_TOKEN
  }
  return Object.keys(authHeaders).length ? authHeaders : undefined
}

function resolveStorePath() {
  const envPath = process.env.SHARED_DB_PATH?.trim()
  if (!envPath) return DEFAULT_STORE_PATH
  if (envPath.toLowerCase().endsWith(".json")) return path.resolve(envPath)
  return path.join(path.resolve(envPath), "shared-kv-store.json")
}

async function loadStore(): Promise<StoreShape> {
  const storePath = resolveStorePath()
  await fs.mkdir(path.dirname(storePath), { recursive: true })
  try {
    const raw = await fs.readFile(storePath, "utf8")
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""))
    const kv = parsed?.kv_store && typeof parsed.kv_store === "object" ? parsed.kv_store : {}
    const audit = Array.isArray(parsed?.kv_audit_log) ? parsed.kv_audit_log : []
    return { kv_store: kv, kv_audit_log: audit }
  } catch {
    return { kv_store: {}, kv_audit_log: [] }
  }
}

async function saveStore(store: StoreShape) {
  const storePath = resolveStorePath()
  await fs.mkdir(path.dirname(storePath), { recursive: true })
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8")
}

function nextAuditId(store: StoreShape) {
  return store.kv_audit_log.reduce((max, row) => Math.max(max, Number(row.id || 0)), 0) + 1
}

function lastHash(store: StoreShape) {
  return String(store.kv_audit_log[store.kv_audit_log.length - 1]?.row_hash || "")
}

function buildHash(prevHash: string, key: string, actor: string, action: string, size: number, now: string) {
  return crypto.createHash("sha256").update(`${prevHash}|${key}|${actor}|${action}|${size}|${now}`).digest("hex")
}

function defaultMenuLabelByKey(key: SharedKey) {
  if (key === STORE_KEYS.dashboard) return "Dashboard"
  if (key === STORE_KEYS.options) return "Options"
  if (key === STORE_KEYS.auth) return "Auth"
  return "System"
}

function defaultChangeLabelByKey(key: SharedKey) {
  if (key === STORE_KEYS.dashboard) return "Save dashboard state"
  if (key === STORE_KEYS.options) return "Save options data"
  if (key === STORE_KEYS.auth) return "Save auth system"
  return "Save data"
}

function parseJsonObject<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as T
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

async function readRawValue(key: SharedKey) {
  if (kvConfigured() && !CENTRAL_DB_API_URL) {
    const value = await kvCommand<string | null>(["GET", kvValueKey(key)])
    return value == null ? null : String(value)
  }

  if (redisConfigured() && !CENTRAL_DB_API_URL) {
    const value = await redisCommand<string | null>(REDIS_URL, ["GET", kvValueKey(key)])
    return value == null ? null : String(value)
  }

  if (CENTRAL_DB_API_URL) {
    const baseUrl = CENTRAL_DB_API_URL.replace(/\/$/, "")
    const sharedUrl = `${baseUrl}/api/shared-kv?key=${encodeURIComponent(key)}`
    const sharedResp = await fetch(sharedUrl, {
      headers: buildCentralApiHeaders(),
      cache: "no-store",
    })
    if (sharedResp.ok) {
      const json = await sharedResp.json().catch(() => null)
      if (json?.ok && json.value != null) return String(json.value)
    }

    // Backward-compatible read-only mode for the current production app,
    // which exposes dashboard/options APIs but may not expose /api/shared-kv yet.
    const legacyPathByKey: Record<SharedKey, string> = {
      [STORE_KEYS.dashboard]: "/api/dashboard",
      [STORE_KEYS.options]: "/api/options",
      [STORE_KEYS.auth]: "/api/auth/session",
    }
    const legacyResp = await fetch(`${baseUrl}${legacyPathByKey[key]}`, {
      headers: buildCentralApiHeaders(),
      cache: "no-store",
    })
    if (!legacyResp.ok) return null
    const legacyJson = await legacyResp.json().catch(() => null)
    if (legacyJson == null) return null
    return JSON.stringify(legacyJson)
  }

  const store = await loadStore()
  return store.kv_store[key]?.value ?? null
}

async function writeRawValue(key: SharedKey, raw: string, meta?: WriteAuditMeta) {
  ensureWritableStoreConfigured()
  const menuLabel = String(meta?.menuLabel || defaultMenuLabelByKey(key))
  const changeLabel = String(meta?.changeLabel || defaultChangeLabelByKey(key))

  if (SHARED_DB_READ_ONLY) {
    throw new Error("Shared DB is mounted read-only in this environment.")
  }

  if (kvConfigured() && !CENTRAL_DB_API_URL) {
    await kvCommand(["SET", kvValueKey(key), raw])
    return
  }

  if (redisConfigured() && !CENTRAL_DB_API_URL) {
    await redisCommand(REDIS_URL, ["SET", kvValueKey(key), raw])
    return
  }

  if (CENTRAL_DB_API_URL) {
    const url = `${CENTRAL_DB_API_URL.replace(/\/$/, "")}/api/shared-kv`
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(buildCentralApiHeaders({ "content-type": "application/json" }) || {}),
      },
      body: JSON.stringify({
        key,
        value: raw,
        actor: CENTRAL_DB_SOURCE,
        menuLabel,
        changeLabel,
      }),
      cache: "no-store",
    })
    if (!resp.ok) throw new Error(`central db write failed (${resp.status})`)
    return
  }

  writeQueue = writeQueue.then(async () => {
    const now = new Date().toISOString()
    const store = await loadStore()
    const prevHash = lastHash(store)
    const rowHash = buildHash(prevHash, key, CENTRAL_DB_SOURCE, "upsert", raw.length, now)
    store.kv_store[key] = { value: raw, updated_at: now }
    store.kv_audit_log.push({
      id: nextAuditId(store),
      key,
      actor: CENTRAL_DB_SOURCE,
      action: "upsert",
      summary: `${menuLabel} > ${changeLabel}`,
      menu_label: menuLabel,
      change_label: changeLabel,
      value_snapshot: raw,
      prev_hash: prevHash,
      row_hash: rowHash,
      created_at: now,
    })
    await saveStore(store)
  })
  await writeQueue
}

async function seedFromFileIfMissing<T>(key: SharedKey, filePath: string): Promise<T | null> {
  const existing = await readRawValue(key)
  const parsedExisting = parseJsonObject<T>(existing)
  if (parsedExisting) return parsedExisting
  if (!SHARED_DB_ALLOW_SEED) return null

  try {
    const raw = (await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, "")
    const parsed = parseJsonObject<T>(raw)
    if (!parsed) return null
    await writeRawValue(key, raw)
    return parsed
  } catch {
    return null
  }
}

export async function readDashboardState<T>(fallbackFilePath?: string): Promise<T | null> {
  const raw = await readRawValue(STORE_KEYS.dashboard)
  const parsed = parseJsonObject<T>(raw)
  if (parsed) return parsed
  if (!fallbackFilePath) return null
  return seedFromFileIfMissing<T>(STORE_KEYS.dashboard, fallbackFilePath)
}

export async function writeDashboardState(value: unknown, meta?: WriteAuditMeta) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dashboard state must be a JSON object.")
  }
  await writeRawValue(STORE_KEYS.dashboard, JSON.stringify(value, null, 2), meta)
}

export async function readOptionsMock<T>(fallbackFilePath?: string): Promise<T | null> {
  const raw = await readRawValue(STORE_KEYS.options)
  const parsed = parseJsonObject<T>(raw)
  if (parsed) return parsed
  if (!fallbackFilePath) return null
  return seedFromFileIfMissing<T>(STORE_KEYS.options, fallbackFilePath)
}

export async function writeOptionsMock(value: unknown, meta?: WriteAuditMeta) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Options data must be a JSON object.")
  }
  await writeRawValue(STORE_KEYS.options, JSON.stringify(value, null, 2), meta)
}

export async function readAuthSystem<T>(fallbackValue?: T): Promise<T | null> {
  const raw = await readRawValue(STORE_KEYS.auth)
  const parsed = parseJsonObject<T>(raw)
  if (parsed) return parsed
  return fallbackValue ?? null
}

export async function writeAuthSystem(value: unknown, meta?: WriteAuditMeta) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Auth system must be a JSON object.")
  }
  await writeRawValue(STORE_KEYS.auth, JSON.stringify(value, null, 2), meta)
}
