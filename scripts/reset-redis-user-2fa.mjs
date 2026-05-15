import net from "node:net"
import tls from "node:tls"

const REDIS_URL = process.env.REDIS_URL || process.env.NEW_REDIS_URL || process.env.TARGET_REDIS_URL || ""
const USER_NAME = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length).trim() || ""
const APPLY = process.argv.includes("--apply")
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

function summarizeUser(user) {
  if (!user) return null
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    active: user.active,
    deletedAt: user.deletedAt || null,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    hasTwoFactorSecret: Boolean(user.twoFactorSecret),
    twoFactorConfirmedAt: user.twoFactorConfirmedAt || null,
  }
}

async function main() {
  if (!REDIS_URL) throw new Error("REDIS_URL/NEW_REDIS_URL/TARGET_REDIS_URL is required.")
  if (!USER_NAME) throw new Error("Pass --user=<name>.")

  const raw = await redisCommand(REDIS_URL, ["GET", AUTH_KEY])
  if (!raw) throw new Error(`${AUTH_KEY} not found.`)
  const auth = JSON.parse(raw)
  const users = Array.isArray(auth.users) ? auth.users : []
  const target = users.find((user) => user.name === USER_NAME || user.loginId === USER_NAME)
  if (!target) throw new Error(`User not found: ${USER_NAME}`)

  console.log("Before:", summarizeUser(target))
  target.twoFactorEnabled = false
  target.twoFactorSecret = null
  target.twoFactorConfirmedAt = null
  target.updatedAt = new Date().toISOString()
  auth.userSessions = (Array.isArray(auth.userSessions) ? auth.userSessions : []).filter(
    (session) => session.userId !== target.id,
  )
  auth.presenceSessions = (Array.isArray(auth.presenceSessions) ? auth.presenceSessions : []).filter(
    (session) => session.userId !== target.id,
  )
  console.log("After:", summarizeUser(target))

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to reset this user's 2FA.")
    return
  }

  await redisCommand(REDIS_URL, ["SET", AUTH_KEY, JSON.stringify(auth)])
  console.log("2FA reset applied.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
