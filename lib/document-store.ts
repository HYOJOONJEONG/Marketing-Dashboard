import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import { redisCommand } from "./redis-client"
import type { StoredDocument } from "./document-collaboration"
import { documentMetadata } from "./document-library"

type StorageCommand = { action: "read"; id: string } | { action: "list"; userId: string; metadataOnly?: boolean } | { action: "cas"; id: string; expected: string | null; value: StoredDocument }
const PREFIX = "infobiz:private-documents:"
const DIRECTORY = path.join(process.cwd(), "data", "private-documents")
const queues = new Map<string, Promise<unknown>>()
export function validDocumentId(id: string) { return /^[a-f0-9-]{36}$/.test(id) }
const CAS = `
local old = redis.call('GET', KEYS[1])
if (old or '') ~= ARGV[1] then return 0 end
local next = cjson.decode(ARGV[2])
local users = {[next.ownerId]=true}
for _,member in ipairs(next.members) do users[member.userId]=true end
if old then
  local previous=cjson.decode(old)
  for _,member in ipairs(previous.members) do
    if not users[member.userId] then redis.call('SREM', ARGV[3]..'user:'..member.userId, next.id) end
  end
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', ARGV[3]..'meta:'..next.id, ARGV[4])
for id,_ in pairs(users) do redis.call('SADD', ARGV[3]..'user:'..id, next.id) end
return 1
`
const LIST_METADATA = `
local ids=redis.call('SMEMBERS', KEYS[1])
local rows={}
for _,id in ipairs(ids) do
  local meta=redis.call('GET', ARGV[1]..'meta:'..id)
  if meta then table.insert(rows,meta)
  else
    local raw=redis.call('GET', ARGV[1]..id)
    if raw then
      local ok,row=pcall(cjson.decode,raw)
      if ok and type(row)=='table' then
        table.insert(rows,cjson.encode({id=row.id,ownerId=row.ownerId,ownerName=row.ownerName,title=row.title,members=row.members,createdAt=row.createdAt,updatedAt=row.updatedAt}))
      else table.insert(rows,'{}') end
    end
  end
end
return rows
`

async function redis<T>(command: Array<string | number>): Promise<T> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error("문서 저장소에 연결할 수 없습니다.")
    const result = await response.json()
    if (result.error) throw new Error("문서 저장 요청을 처리하지 못했습니다.")
    return result.result
  }
  return redisCommand<T>(process.env.REDIS_URL!, command)
}

export async function documentStorage(command: StorageCommand, direct = false): Promise<any> {
  if (command.action !== "list" && !validDocumentId(command.id)) throw new Error("잘못된 문서 번호입니다.")
  const central = process.env.CENTRAL_DB_API_URL?.replace(/\/$/, "")
  if (!direct && central) {
    if (process.env.NODE_ENV !== "production" && process.env.SHARED_DB_ALLOW_REMOTE_WRITE_FROM_LOCAL !== "1") throw new Error("로컬 환경의 운영 문서 연결이 차단되어 있습니다.")
    const token = process.env.SHARED_KV_API_KEY || process.env.CENTRAL_DB_API_TOKEN || ""
    const response = await fetch(`${central}/api/documents/storage`, { method: "POST", headers: { "content-type": "application/json", "x-api-key": token }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error("중앙 문서 저장소에 연결할 수 없습니다.")
    return (await response.json()).result
  }
  const remote = Boolean(process.env.REDIS_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)
  if (remote) {
    if (command.action === "cas" && (process.env.SHARED_DB_READ_ONLY === "1" || (process.env.NODE_ENV !== "production" && process.env.SHARED_DB_ALLOW_REMOTE_WRITE_FROM_LOCAL !== "1"))) throw new Error("문서 저장소가 읽기 전용입니다.")
    if (command.action === "read") return redis(["GET", `${PREFIX}${command.id}`])
    if (command.action === "list") {
      if (command.metadataOnly) return redis(["EVAL", LIST_METADATA, 1, `${PREFIX}user:${command.userId}`, PREFIX])
      const ids = await redis<string[]>(["SMEMBERS", `${PREFIX}user:${command.userId}`])
      return ids.length ? redis(["MGET", ...ids.map(id => `${PREFIX}${id}`)]) : []
    }
    return Boolean(await redis(["EVAL", CAS, 1, `${PREFIX}${command.id}`, command.expected || "", JSON.stringify(command.value), PREFIX, JSON.stringify(documentMetadata(command.value))]))
  }
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") throw new Error("문서용 영구 저장소가 설정되지 않았습니다.")
  await fs.mkdir(DIRECTORY, { recursive: true })
  if (command.action === "list") {
    const names = (await fs.readdir(DIRECTORY)).filter(name => name.endsWith(".json"))
    return Promise.all(names.map(async name => {
      const raw = await fs.readFile(path.join(DIRECTORY, name), "utf8")
      return command.metadataOnly ? JSON.stringify(documentMetadata(raw)) : raw
    }))
  }
  const file = path.join(DIRECTORY, `${command.id}.json`)
  if (command.action === "read") return fs.readFile(file, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error })
  const previous = queues.get(command.id) || Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const raw = await fs.readFile(file, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error })
    if (raw !== command.expected) return false
    const temporary = `${file}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(temporary, JSON.stringify(command.value), { mode: 0o600 })
    await fs.rename(temporary, file)
    return true
  })
  queues.set(command.id, next)
  try { return await next } finally { if (queues.get(command.id) === next) queues.delete(command.id) }
}

export async function updateStoredDocument(id: string, mutate: (document: StoredDocument | null) => StoredDocument | null) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const raw = await documentStorage({ action: "read", id }) as string | null
    const value = mutate(raw ? JSON.parse(raw) : null)
    if (!value) return raw ? JSON.parse(raw) as StoredDocument : null
    if (await documentStorage({ action: "cas", id, expected: raw, value })) return value
  }
  throw new Error("동시 저장이 많습니다. 잠시 후 자동으로 다시 저장합니다.")
}
