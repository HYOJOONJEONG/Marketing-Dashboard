import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { redisCommand } from "@/lib/redis-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CENTRAL_DB_API_TOKEN = process.env.CENTRAL_DB_API_TOKEN?.trim() || ""
const KV_REST_API_URL = process.env.KV_REST_API_URL?.trim() || ""
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN?.trim() || ""
const REDIS_URL = process.env.REDIS_URL?.trim() || ""
const STORE_PATH = path.join(process.cwd(), "data", "shared-kv-store.json")

type KvRecord = {
  value: string
  updated_at: string
}

type AuditRecord = {
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
}

type StoreShape = {
  kv_store: Record<string, KvRecord>
  kv_audit_log: AuditRecord[]
}

let writeQueue: Promise<void> = Promise.resolve()

function kvConfigured() {
  return Boolean(KV_REST_API_URL && KV_REST_API_TOKEN)
}

function redisConfigured() {
  return Boolean(REDIS_URL)
}

function persistentStoreConfigured() {
  return kvConfigured() || redisConfigured()
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

function kvValueKey(key: string) {
  return `shared-kv:value:${key}`
}

const KV_AUDIT_LIST_KEY = "shared-kv:audit"
const KV_AUDIT_ID_KEY = "shared-kv:audit:id"

function isAuthorized(request: Request) {
  if (!CENTRAL_DB_API_TOKEN) return true
  return request.headers.get("x-central-token") === CENTRAL_DB_API_TOKEN
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "shared-kv internal error"
}

async function loadStore(): Promise<StoreShape> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""))
    return {
      kv_store: parsed?.kv_store && typeof parsed.kv_store === "object" ? parsed.kv_store : {},
      kv_audit_log: Array.isArray(parsed?.kv_audit_log) ? parsed.kv_audit_log : [],
    }
  } catch {
    return { kv_store: {}, kv_audit_log: [] }
  }
}

async function saveStore(store: StoreShape) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8")
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

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    if (searchParams.get("audit") === "1") {
      const keyFilter = String(searchParams.get("key") || "").trim()
      const limitRaw = Number(searchParams.get("limit") || 100)
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100

      if (persistentStoreConfigured()) {
        const values = kvConfigured()
          ? await kvCommand<string[]>(["LRANGE", KV_AUDIT_LIST_KEY, 0, limit * 3])
          : await redisCommand<string[]>(REDIS_URL, ["LRANGE", KV_AUDIT_LIST_KEY, 0, limit * 3])
        const rows = (values || [])
          .map((value) => {
            try {
              return JSON.parse(String(value)) as AuditRecord
            } catch {
              return null
            }
          })
          .filter((row): row is AuditRecord => Boolean(row))
          .filter((row) => !keyFilter || String(row.key || "") === keyFilter)
          .slice(0, limit)
        return NextResponse.json({ ok: true, rows })
      }

      const store = await loadStore()
      let rows = [...store.kv_audit_log].sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      if (keyFilter) rows = rows.filter((row) => String(row.key || "") === keyFilter)
      return NextResponse.json({ ok: true, rows: rows.slice(0, limit) })
    }

    const key = String(searchParams.get("key") || "").trim()
    if (!key) {
      return NextResponse.json({ ok: false, error: "key is required" }, { status: 400 })
    }

    if (persistentStoreConfigured()) {
      const value = kvConfigured()
        ? await kvCommand<string | null>(["GET", kvValueKey(key)])
        : await redisCommand<string | null>(REDIS_URL, ["GET", kvValueKey(key)])
      if (value == null) return NextResponse.json({ ok: true, value: null })
      return NextResponse.json({ ok: true, value })
    }

    if (process.env.VERCEL === "1") {
      return NextResponse.json(
        { ok: false, error: "Persistent storage is not configured for production." },
        { status: 500 },
      )
    }

    const store = await loadStore()
    const row = store.kv_store[key]
    if (!row) return NextResponse.json({ ok: true, value: null })
    return NextResponse.json({ ok: true, value: row.value ?? null, updatedAt: row.updated_at ?? null })
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const action = String(body?.action || "upsert").trim()
    const key = String(body?.key || "").trim()
    const actor = String(body?.actor || "unknown-client")

    if (process.env.VERCEL === "1" && !persistentStoreConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Persistent storage is not configured for production." },
        { status: 500 },
      )
    }

    if (persistentStoreConfigured() && action !== "upsert") {
      return NextResponse.json(
        { ok: false, error: `${action} is not supported by persistent storage yet` },
        { status: 400 },
      )
    }

    if (action === "delete_log") {
      const logId = Number(body?.logId || 0)
      if (!Number.isFinite(logId) || logId <= 0) {
        return NextResponse.json({ ok: false, error: "invalid logId" }, { status: 400 })
      }
      writeQueue = writeQueue.then(async () => {
        const store = await loadStore()
        store.kv_audit_log = store.kv_audit_log.filter((row) => Number(row.id) !== logId)
        await saveStore(store)
      })
      await writeQueue
      return NextResponse.json({ ok: true })
    }

    if (action === "rollback" || action === "delete_restore") {
      const logId = Number(body?.logId || 0)
      if (!Number.isFinite(logId) || logId <= 0) {
        return NextResponse.json({ ok: false, error: "invalid logId" }, { status: 400 })
      }

      writeQueue = writeQueue.then(async () => {
        const store = await loadStore()
        const target = store.kv_audit_log.find((row) => Number(row.id) === logId)
        if (!target?.key) throw new Error("target log not found")

        const previous = [...store.kv_audit_log]
          .filter((row) => row.key === target.key && Number(row.id) < logId && row.value_snapshot != null)
          .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0]
        if (!previous?.value_snapshot) throw new Error("No previous snapshot available for rollback.")

        const now = new Date().toISOString()
        const snapshot = String(previous.value_snapshot)
        const prevHash = String(previous.row_hash || lastHash(store))
        const rowHash = buildHash(prevHash, String(target.key), actor, "rollback", snapshot.length, now)

        store.kv_store[String(target.key)] = { value: snapshot, updated_at: now }
        store.kv_audit_log.push({
          id: nextAuditId(store),
          key: String(target.key),
          actor,
          action: "rollback",
          summary: `${String(target.key)} > rollback #${logId}`,
          menu_label: "Audit log",
          change_label: "Rollback",
          value_snapshot: snapshot,
          prev_hash: prevHash,
          row_hash: rowHash,
          created_at: now,
        })

        if (action === "delete_restore") {
          store.kv_audit_log = store.kv_audit_log.filter((row) => Number(row.id) !== logId)
        }
        await saveStore(store)
      })
      await writeQueue
      return NextResponse.json({ ok: true })
    }

    const value = body?.value
    if (!key || typeof value !== "string") {
      return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 })
    }

    const menuLabel = String(body?.menuLabel || "System")
    const changeLabel = String(body?.changeLabel || "Save data")

    if (persistentStoreConfigured()) {
      const now = new Date().toISOString()
      const id = Number(
        kvConfigured()
          ? await kvCommand<number>(["INCR", KV_AUDIT_ID_KEY])
          : await redisCommand<number>(REDIS_URL, ["INCR", KV_AUDIT_ID_KEY]),
      )
      const rowHash = buildHash("", key, actor, "upsert", value.length, now)
      const auditRow: AuditRecord = {
        id,
        key,
        actor,
        action: "upsert",
        summary: `${menuLabel} > ${changeLabel}`,
        menu_label: menuLabel,
        change_label: changeLabel,
        value_snapshot: value,
        prev_hash: "",
        row_hash: rowHash,
        created_at: now,
      }
      if (kvConfigured()) {
        await kvPipeline([
          ["SET", kvValueKey(key), value],
          ["LPUSH", KV_AUDIT_LIST_KEY, JSON.stringify(auditRow)],
          ["LTRIM", KV_AUDIT_LIST_KEY, 0, 499],
        ])
      } else {
        await redisCommand(REDIS_URL, ["SET", kvValueKey(key), value])
        await redisCommand(REDIS_URL, ["LPUSH", KV_AUDIT_LIST_KEY, JSON.stringify(auditRow)])
        await redisCommand(REDIS_URL, ["LTRIM", KV_AUDIT_LIST_KEY, 0, 499])
      }
      return NextResponse.json({ ok: true })
    }

    writeQueue = writeQueue.then(async () => {
      const store = await loadStore()
      const now = new Date().toISOString()
      const prevHash = lastHash(store)
      const rowHash = buildHash(prevHash, key, actor, "upsert", value.length, now)

      store.kv_store[key] = { value, updated_at: now }
      store.kv_audit_log.push({
        id: nextAuditId(store),
        key,
        actor,
        action: "upsert",
        summary: `${menuLabel} > ${changeLabel}`,
        menu_label: menuLabel,
        change_label: changeLabel,
        value_snapshot: value,
        prev_hash: prevHash,
        row_hash: rowHash,
        created_at: now,
      })
      await saveStore(store)
    })
    await writeQueue
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error) }, { status: 500 })
  }
}
