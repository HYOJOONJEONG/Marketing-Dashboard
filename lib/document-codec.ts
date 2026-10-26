import { gzipSync, Gunzip } from "fflate"

export const DOCUMENT_UPDATE_LIMIT = 8 * 1024 * 1024
export const DOCUMENT_REQUEST_LIMIT = 2800000
export const DOCUMENT_STATE_LIMIT = 1200000
export const DOCUMENT_CONTENT_LIMIT = 4000000

export function bytesToPlainBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function bytesToBase64(bytes: Uint8Array) {
  if (bytes.length > DOCUMENT_UPDATE_LIMIT) throw new Error("문서 편집 데이터 용량 한도를 초과했습니다. 파일로 내려받아 보관해주세요.")
  if (bytes.length >= 4096) {
    const compressed = gzipSync(bytes, { level: 6 })
    if (compressed.length + 32 < bytes.length) return `gz:${bytesToPlainBase64(compressed)}`
  }
  return bytesToPlainBase64(bytes)
}

export function base64ToBytes(value: string) {
  const compressed = value.startsWith("gz:")
  const encoded = compressed ? value.slice(3) : value
  if (encoded.length > Math.ceil(DOCUMENT_UPDATE_LIMIT * 4 / 3) + 4) throw new Error("문서 편집 데이터가 너무 큽니다.")
  const bytes = typeof Buffer !== "undefined" ? new Uint8Array(Buffer.from(encoded, "base64")) : Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
  if (!compressed) {
    if (bytes.length > DOCUMENT_UPDATE_LIMIT) throw new Error("문서 편집 데이터가 너무 큽니다.")
    return bytes
  }
  if (bytes.length < 18) throw new Error("압축된 문서 데이터가 올바르지 않습니다.")
  const advertisedSize = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(0, true)
  if (advertisedSize > DOCUMENT_UPDATE_LIMIT) throw new Error("문서 편집 데이터가 너무 큽니다.")
  const chunks: Uint8Array[] = []
  let length = 0
  const decoder = new Gunzip(chunk => {
    length += chunk.length
    if (length > DOCUMENT_UPDATE_LIMIT) throw new Error("문서 편집 데이터가 너무 큽니다.")
    chunks.push(chunk)
  })
  // Bound each inflation step as well as the total decoded size.
  for (let offset = 0; offset < bytes.length; offset += 1024) decoder.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length)
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

export function compatibleDocument<T extends { state: string }>(document: T, encoding: unknown): T {
  return encoding === "gzip" || !document.state.startsWith("gz:") ? document : { ...document, state: bytesToPlainBase64(base64ToBytes(document.state)) }
}
