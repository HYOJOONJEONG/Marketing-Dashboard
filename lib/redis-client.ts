import net from "net"
import tls from "tls"

type RespValue = string | number | null | RespValue[]

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

export async function redisCommand<T = RespValue>(redisUrl: string, parts: Array<string | number>) {
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
