import net from "net"
import tls from "tls"

type RespValue = string | number | null | RespValue[]
type PendingCommand<T = RespValue> = {
  expectedResponses: number
  resolve: (value: T) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const REDIS_COMMAND_TIMEOUT_MS = Math.max(1000, Math.min(10000, Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 3000)))
const REDIS_IDLE_RECONNECT_MS = Math.max(5000, Number(process.env.REDIS_IDLE_RECONNECT_MS || 30000))

function encodeCommand(parts: Array<string | number>) {
  const chunks = [`*${parts.length}\r\n`]
  for (const part of parts) {
    const value = String(part)
    chunks.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`)
  }
  return chunks.join("")
}

function parseResp(buffer: Buffer, offset = 0): { value: RespValue; offset: number } | null {
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
    const values: RespValue[] = []
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

class RedisSocketClient {
  private socket: net.Socket | null = null
  private connected = false
  private authenticated = false
  private connecting: Promise<void> | null = null
  private queue: Promise<void> = Promise.resolve()
  private pending: PendingCommand | null = null
  private buffer = Buffer.alloc(0)
  private lastUsedAt = 0
  private readonly url: URL
  private readonly authParts: Array<string | number> | null

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl)
    const password = decodeURIComponent(this.url.password || "")
    const username = decodeURIComponent(this.url.username || "")
    this.authParts = username ? ["AUTH", username, password] : password ? ["AUTH", password] : null
  }

  async command<T = RespValue>(parts: Array<string | number>) {
    const run = async () => {
      try {
        await this.ensureReady()
        return await this.writeAndRead<T>(parts, 1)
      } catch (firstError) {
        this.reset(firstError instanceof Error ? firstError : new Error(String(firstError)))
        await this.ensureReady()
        return this.writeAndRead<T>(parts, 1)
      }
    }
    const next = this.queue.catch(() => undefined).then(run)
    this.queue = next.then(() => undefined, () => undefined)
    return next
  }

  private openSocket() {
    if (this.connected && Date.now() - this.lastUsedAt > REDIS_IDLE_RECONNECT_MS) {
      this.reset()
    }
    if (this.connected && this.socket && !this.socket.destroyed) return Promise.resolve()
    if (this.connecting) return this.connecting

    this.connecting = new Promise<void>((resolve, reject) => {
      const port = Number(this.url.port || (this.url.protocol === "rediss:" ? 6380 : 6379))
      const host = this.url.hostname
      const socket =
        this.url.protocol === "rediss:"
          ? tls.connect({ host, port, servername: host })
          : net.connect({ host, port })

      this.socket = socket
      this.buffer = Buffer.alloc(0)

      const connectEvent = this.url.protocol === "rediss:" ? "secureConnect" : "connect"
      const onConnect = () => {
        cleanup()
        socket.setNoDelay(true)
        socket.setKeepAlive(true, 30000)
        this.connected = true
        this.lastUsedAt = Date.now()
        resolve()
      }
      const onError = (error: Error) => {
        cleanup()
        this.reset(error)
        reject(error)
      }
      const onCloseBeforeConnect = () => {
        cleanup()
        this.reset()
        reject(new Error("Redis connection closed before ready"))
      }
      const cleanup = () => {
        socket.off(connectEvent, onConnect)
        socket.off("error", onError)
        socket.off("close", onCloseBeforeConnect)
      }

      socket.once(connectEvent, onConnect)
      socket.once("error", onError)
      socket.once("close", onCloseBeforeConnect)
      socket.on("data", (chunk) => this.handleData(chunk))
      socket.on("close", () => this.reset())
      socket.on("error", (error) => this.reset(error))
    }).finally(() => {
      this.connecting = null
    })

    return this.connecting
  }

  private async ensureReady() {
    await this.openSocket()
    if (this.authenticated || !this.authParts) return
    await this.writeAndRead(this.authParts, 1)
    this.authenticated = true
  }

  private writeAndRead<T = RespValue>(parts: Array<string | number>, expectedResponses: number) {
    return new Promise<T>((resolve, reject) => {
      const socket = this.socket
      if (!socket || socket.destroyed || !this.connected) {
        reject(new Error("Redis socket is not connected"))
        return
      }
      const timer = setTimeout(() => {
        this.reset(new Error("Redis command timed out"))
      }, REDIS_COMMAND_TIMEOUT_MS)
      this.pending = { expectedResponses, resolve: resolve as (value: RespValue) => void, reject, timer }
      socket.write(encodeCommand(parts), (error) => {
        if (error) this.reset(error)
      })
    })
  }

  private handleData(chunk: Buffer) {
    if (!this.pending) return
    try {
      this.buffer = Buffer.concat([this.buffer, chunk])
      let current = 0
      let value: RespValue = null
      for (let responses = 0; responses < this.pending.expectedResponses; responses += 1) {
        const parsed = parseResp(this.buffer, current)
        if (!parsed) return
        value = parsed.value
        current = parsed.offset
      }
      const pending = this.pending
      this.pending = null
      this.buffer = this.buffer.slice(current)
      this.lastUsedAt = Date.now()
      clearTimeout(pending.timer)
      pending.resolve(value)
    } catch (error) {
      this.reset(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private reset(error?: Error) {
    this.connected = false
    this.authenticated = false
    this.connecting = null
    const pending = this.pending
    this.pending = null
    this.buffer = Buffer.alloc(0)
    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(error || new Error("Redis connection closed"))
    }
    const socket = this.socket
    this.socket = null
    if (socket && !socket.destroyed) socket.destroy()
  }
}

const clients = new Map<string, RedisSocketClient>()

function getRedisClient(redisUrl: string) {
  const existing = clients.get(redisUrl)
  if (existing) return existing
  const client = new RedisSocketClient(redisUrl)
  clients.set(redisUrl, client)
  return client
}

export async function redisCommand<T = RespValue>(redisUrl: string, parts: Array<string | number>) {
  const client = getRedisClient(redisUrl)
  return client.command<T>(parts)
}

export async function redisCommandOnce<T = RespValue>(redisUrl: string, parts: Array<string | number>) {
  const url = new URL(redisUrl)
  const port = Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379))
  const host = url.hostname
  const password = decodeURIComponent(url.password || "")
  const username = decodeURIComponent(url.username || "")
  const authParts = username ? ["AUTH", username, password] : password ? ["AUTH", password] : null
  const commands = authParts ? [authParts, parts] : [parts]
  const payload = commands.map((command) => encodeCommand(command)).join("")

  return new Promise<T>((resolve, reject) => {
    const socket =
      url.protocol === "rediss:"
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port })

    let buffer = Buffer.alloc(0)
    const expectedResponses = commands.length

    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error("Redis command timed out"))
    }, 10000)

    socket.on("connect", () => {
      socket.write(payload)
    })

    socket.on("data", (chunk) => {
      try {
        buffer = Buffer.concat([buffer, chunk])
        let current = 0
        let value: RespValue = null
        for (let responses = 0; responses < expectedResponses; responses += 1) {
          const parsed = parseResp(buffer, current)
          if (!parsed) return
          value = parsed.value
          current = parsed.offset
        }
        clearTimeout(timer)
        socket.destroy()
        resolve(value as T)
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
