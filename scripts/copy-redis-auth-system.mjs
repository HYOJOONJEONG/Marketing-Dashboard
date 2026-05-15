import net from "node:net"
import tls from "node:tls"

const SOURCE_REDIS_URL = process.env.OLD_REDIS_URL || process.env.SOURCE_REDIS_URL || ""
const TARGET_REDIS_URL = process.env.NEW_REDIS_URL || process.env.TARGET_REDIS_URL || ""
const APPLY = process.argv.includes("--apply")
const REPLACE = process.argv.includes("--replace")
const EXCLUDED_USER_NAMES = [
  ...(process.env.EXCLUDE_USER_NAMES || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
  ...process.argv
    .filter((arg) => arg.startsWith("--exclude-user="))
    .map((arg) => arg.slice("--exclude-user=".length).trim())
    .filter(Boolean),
]
const AUTH_KEY = "shared-kv:value:auth_system"

function encodeCommand(parts) {
  const chunks = [`*${parts.length}\r\n`]
  for (const part of parts) {
    const value = String(part)
    chunks.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`)
  }
  return chunks.join("")
}

function parseResp(buffer, offset = 0) {
  if (offset >= buffer.length) return null
  const prefix = String.fromCharCode(buffer[offset])
  const lineEnd = buffer.indexOf("\r\n", offset)
  if (lineEnd === -1) return null
  const line = buffer.slice(offset + 1, lineEnd).toString("utf8")
  const next = lineEnd + 2

  if (prefix === "+") return { value: line, offset: next }
  if (prefix === ":") return { value: Number(line), offset: next }
  if (prefix === "-") throw new Error(line)

  if (prefix === "$") {
    const length = Number(line)
    if (length === -1) return { value: null, offset: next }
    const end = next + length
    if (buffer.length < end + 2) return null
    return { value: buffer.slice(next, end).toString("utf8"), offset: end + 2 }
  }

  if (prefix === "*") {
    const count = Number(line)
    if (count === -1) return { value: null, offset: next }
    const values = []
    let current = next
    for (let index = 0; index < count; index += 1) {
      const parsed = parseResp(buffer, current)
      if (!parsed) return null
      values.push(parsed.value)
      current = parsed.offset
    }
    return { value: values, offset: current }
  }

  throw new Error(`Unsupported Redis response: ${prefix}`)
}

async function redisCommand(redisUrl, parts) {
  const url = new URL(redisUrl)
  const port = Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379))
  const host = url.hostname
  const password = decodeURIComponent(url.password || "")
  const username = decodeURIComponent(url.username || "")
  const authParts = username ? ["AUTH", username, password] : password ? ["AUTH", password] : null
  const commands = authParts ? [authParts, parts] : [parts]
  const payload = commands.map((command) => encodeCommand(command)).join("")

  return new Promise((resolve, reject) => {
    const socket =
      url.protocol === "rediss:"
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port })
    let buffer = Buffer.alloc(0)
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error("Redis command timed out"))
    }, 15000)

    socket.on("connect", () => socket.write(payload))
    socket.on("data", (chunk) => {
      try {
        buffer = Buffer.concat([buffer, chunk])
        let current = 0
        let value = null
        for (let responses = 0; responses < commands.length; responses += 1) {
          const parsed = parseResp(buffer, current)
          if (!parsed) return
          value = parsed.value
          current = parsed.offset
        }
        clearTimeout(timer)
        socket.destroy()
        resolve(value)
      } catch (error) {
        clearTimeout(timer)
        socket.destroy()
        reject(error)
      }
    })
    socket.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function summarizeAuth(raw) {
  if (!raw) return { exists: false, users: 0, enabled2fa: 0, usersWithTestIds: 0, testIds: 0 }
  const parsed = sanitizeAuthSystem(JSON.parse(raw))
  const users = Array.isArray(parsed.users) ? parsed.users : []
  return {
    exists: true,
    users: users.length,
    enabled2fa: users.filter((user) => Boolean(user.twoFactorEnabled && user.twoFactorSecret)).length,
    usersWithTestIds: users.filter((user) => Array.isArray(user.testIdEntries) && user.testIdEntries.length > 0).length,
    testIds: users.reduce(
      (total, user) => total + (Array.isArray(user.testIdEntries) ? user.testIdEntries.length : 0),
      0,
    ),
  }
}

function shouldExcludeUser(user) {
  if (!EXCLUDED_USER_NAMES.length) return false
  const values = [user?.name, user?.loginId, user?.id].map((value) => String(value || "").trim())
  return EXCLUDED_USER_NAMES.some((name) => values.includes(name))
}

function sanitizeAuthSystem(auth) {
  if (!auth || typeof auth !== "object") return auth
  const users = Array.isArray(auth.users) ? auth.users : []
  const excludedIds = new Set(users.filter(shouldExcludeUser).map((user) => String(user.id || "")))
  const excludedNames = new Set(EXCLUDED_USER_NAMES)
  if (!excludedIds.size && !excludedNames.size) return auth

  return {
    ...auth,
    users: users.filter((user) => !shouldExcludeUser(user)),
    userSessions: (Array.isArray(auth.userSessions) ? auth.userSessions : []).filter(
      (session) => !excludedIds.has(String(session?.userId || "")),
    ),
    presenceSessions: (Array.isArray(auth.presenceSessions) ? auth.presenceSessions : []).filter(
      (session) => !excludedIds.has(String(session?.userId || "")),
    ),
    popupMessages: (Array.isArray(auth.popupMessages) ? auth.popupMessages : []).filter(
      (message) =>
        !excludedIds.has(String(message?.senderUserId || "")) &&
        !excludedIds.has(String(message?.recipientUserId || "")) &&
        !excludedNames.has(String(message?.senderName || "").trim()),
    ),
    userPermissionOverrides: (Array.isArray(auth.userPermissionOverrides) ? auth.userPermissionOverrides : []).filter(
      (override) => !excludedIds.has(String(override?.userId || "")),
    ),
    userChangeLogs: (Array.isArray(auth.userChangeLogs) ? auth.userChangeLogs : []).filter(
      (log) => !excludedIds.has(String(log?.targetUserId || "")),
    ),
    activityLogs: (Array.isArray(auth.activityLogs) ? auth.activityLogs : []).filter(
      (log) =>
        !excludedIds.has(String(log?.actorUserId || "")) &&
        !excludedIds.has(String(log?.targetId || "")) &&
        !excludedNames.has(String(log?.actorName || "").trim()),
    ),
  }
}

function timestampValue(value) {
  const time = new Date(String(value || "")).getTime()
  return Number.isFinite(time) ? time : 0
}

function mergeArrayById(sourceItems, targetItems) {
  const byId = new Map()
  for (const item of Array.isArray(targetItems) ? targetItems : []) {
    if (item?.id) byId.set(String(item.id), item)
  }
  for (const item of Array.isArray(sourceItems) ? sourceItems : []) {
    if (item?.id) byId.set(String(item.id), item)
  }
  return Array.from(byId.values())
}

function identityKey(user) {
  return String(user?.loginId || user?.name || user?.id || "").trim()
}

function mergeUsers(sourceUsers, targetUsers) {
  const merged = []
  const sourceByIdentity = new Map()
  for (const user of Array.isArray(sourceUsers) ? sourceUsers : []) {
    merged.push(user)
    const key = identityKey(user)
    if (key) sourceByIdentity.set(key, user)
  }
  for (const targetUser of Array.isArray(targetUsers) ? targetUsers : []) {
    const key = identityKey(targetUser)
    if (!key || !sourceByIdentity.has(key)) {
      merged.push(targetUser)
    }
  }
  return merged.sort((a, b) => {
    const orderDiff = Number(a.displayOrder || 99) - Number(b.displayOrder || 99)
    if (orderDiff !== 0) return orderDiff
    return String(a.name || "").localeCompare(String(b.name || ""), "ko")
  })
}

function mergeAuthSystems(sourceRaw, targetRaw) {
  const source = sanitizeAuthSystem(JSON.parse(sourceRaw))
  if (REPLACE || !targetRaw) return source
  const target = sanitizeAuthSystem(JSON.parse(targetRaw))
  return {
    ...target,
    ...source,
    teams: mergeArrayById(source.teams, target.teams),
    roles: mergeArrayById(source.roles, target.roles),
    permissions: mergeArrayById(source.permissions, target.permissions),
    rolePermissions: mergeArrayById(source.rolePermissions, target.rolePermissions),
    userPermissionOverrides: mergeArrayById(source.userPermissionOverrides, target.userPermissionOverrides),
    users: mergeUsers(source.users, target.users),
    userSessions: [],
    presenceSessions: [],
    popupMessages: mergeArrayById(source.popupMessages, target.popupMessages)
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
      .slice(0, 200),
    activityLogs: mergeArrayById(source.activityLogs, target.activityLogs)
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
      .slice(0, 500),
    userChangeLogs: mergeArrayById(source.userChangeLogs, target.userChangeLogs)
      .sort((a, b) => timestampValue(b.changedAt) - timestampValue(a.changedAt))
      .slice(0, 500),
    permissionChangeLogs: mergeArrayById(source.permissionChangeLogs, target.permissionChangeLogs)
      .sort((a, b) => timestampValue(b.changedAt) - timestampValue(a.changedAt))
      .slice(0, 500),
  }
}

async function main() {
  if (!SOURCE_REDIS_URL || !TARGET_REDIS_URL) {
    throw new Error("OLD_REDIS_URL/SOURCE_REDIS_URL and NEW_REDIS_URL/TARGET_REDIS_URL are required.")
  }

  const sourceRaw = await redisCommand(SOURCE_REDIS_URL, ["GET", AUTH_KEY])
  const targetRaw = await redisCommand(TARGET_REDIS_URL, ["GET", AUTH_KEY])
  const sourceSummary = summarizeAuth(sourceRaw)
  const targetSummary = summarizeAuth(targetRaw)

  console.log("Source auth:", sourceSummary)
  console.log("Target auth:", targetSummary)
  if (EXCLUDED_USER_NAMES.length) {
    console.log("Excluded users:", EXCLUDED_USER_NAMES)
  }

  if (!sourceSummary.exists) {
    throw new Error(`Source Redis does not have ${AUTH_KEY}.`)
  }

  const nextRaw = JSON.stringify(mergeAuthSystems(sourceRaw, targetRaw))
  console.log("Mode:", REPLACE ? "replace target auth_system" : "merge source auth_system into target")
  console.log("Target auth after planned copy:", summarizeAuth(nextRaw))

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to copy auth_system into the target Redis.")
    return
  }

  await redisCommand(TARGET_REDIS_URL, ["SET", AUTH_KEY, nextRaw])
  const savedRaw = await redisCommand(TARGET_REDIS_URL, ["GET", AUTH_KEY])
  console.log("Copied auth_system. Target auth after copy:", summarizeAuth(savedRaw))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
