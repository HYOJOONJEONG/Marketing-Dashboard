import crypto from "crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const TOTP_STEP_SECONDS = 30
const TOTP_DIGITS = 6

function decodeBase32(secret: string) {
  const normalized = String(secret || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "")
  let bits = ""
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value < 0) continue
    bits += value.toString(2).padStart(5, "0")
  }
  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}

function hotp(secret: string, counter: number) {
  const key = decodeBase32(secret)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0")
}

function normalizeOtpCode(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, TOTP_DIGITS)
}

export function createTotpSecret() {
  const bytes = crypto.randomBytes(20)
  let bits = ""
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0")
  let secret = ""
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0")
    secret += BASE32_ALPHABET[Number.parseInt(chunk, 2)]
  }
  return secret
}

export function createTotpUri({
  loginId,
  issuer = "InfoBiz Dashboard",
  secret,
}: {
  loginId: string
  issuer?: string
  secret: string
}) {
  const label = `${issuer}:${loginId}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

export function verifyTotpCode(secret: string | null | undefined, code: string, now = Date.now()) {
  const normalizedCode = normalizeOtpCode(code)
  if (!secret || normalizedCode.length !== TOTP_DIGITS) return false
  const currentCounter = Math.floor(now / 1000 / TOTP_STEP_SECONDS)
  for (let offset = -1; offset <= 1; offset += 1) {
    if (hotp(secret, currentCounter + offset) === normalizedCode) return true
  }
  return false
}
