import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
  BOND: "해외채권",
  INDEX: "해외지수",
  STOCK: "해외종목",
  LME: "LME",
  SIGNAGE: "전광판",
  API: "API",
  SOFR: "SOFR",
}

const MOCK_PATH = path.join(process.cwd(), "data", "options-dashboard.mock.json")
const APP_STATE_PATH = path.join(process.cwd(), "data", "app-state.json")

const GET_CACHE_TTL_MS = 12 * 1000
const getResponseCache = new Map<string, { expiresAt: number; payload: any }>()

let mockCache: { mtimeMs: number; payload: any } | null = null
let appStateIndustryCache: { mtimeMs: number; map: Map<string, string> } | null = null

function normalizeCategoryCode(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "active") return "사용중"
  if (raw === "inactive") return "중지"
  return String(value ?? "").trim()
}

function normalizeSubType(categoryCode: string, subType: unknown) {
  const raw = String(subType ?? "").trim()
  if (!raw || raw === categoryCode) return CATEGORY_LABELS[categoryCode] || raw
  return raw
}

function normalizeIndustry(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return ""
  if (text.includes("공기업")) return "공사/정부"
  if (text.includes("공사") || text.includes("정부") || text.includes("공공기관")) return "공사/정부"
  if (text.includes("연기금")) return "연기금"
  if (text.includes("공제회")) return "연기금"
  if (text.includes("국내증권") || text.includes("증권")) return "국내증권"
  if (text.includes("외국계")) return "외국계"
  if (text.includes("국내은행") || (text.includes("은행") && !text.includes("외국계"))) return "국내은행"
  if (text.includes("자산운용")) return "자산운용"
  if (text.includes("보험")) return "보험사"
  if (text.includes("일반기업")) return "일반기업"
  if (text.includes("기업") && !text.includes("은행")) return "일반기업"
  if (text.includes("중개") || text.includes("평가")) return "기타금융"
  if (text.includes("기타금융")) return "기타금융"
  return ""
}

function normalizeCompanyKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, "")
    .replace(/\s+/g, "")
}

function longestCommonSubstringLength(a: string, b: string) {
  const left = a || ""
  const right = b || ""
  if (!left || !right) return 0
  const table = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0))
  let best = 0
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1
        if (table[i][j] > best) best = table[i][j]
      }
    }
  }
  return best
}

function lookupIndustryByCompany(company: unknown, map: Map<string, string>) {
  const key = normalizeCompanyKey(company)
  if (!key) return ""
  const exact = map.get(key)
  if (exact) return exact

  let bestIndustry = ""
  let bestScore = 0
  for (const [candidateKey, industry] of map.entries()) {
    if (!candidateKey) continue
    let score = 0
    if (key.includes(candidateKey) || candidateKey.includes(key)) {
      const shortLen = Math.min(key.length, candidateKey.length)
      const longLen = Math.max(key.length, candidateKey.length)
      score = shortLen / longLen + 0.25
    } else {
      const lcs = longestCommonSubstringLength(key, candidateKey)
      if (lcs >= 3) score = lcs / Math.max(key.length, candidateKey.length)
    }
    if (score > bestScore) {
      bestScore = score
      bestIndustry = industry
    }
  }
  if (bestScore >= 0.72) return bestIndustry
  return ""
}

function inferIndustryFromCompany(value: unknown) {
  const company = String(value ?? "").trim()
  if (!company) return ""
  if (company.includes("공사") || company.includes("정부") || company.includes("공단")) return "공사/정부"
  if (company.includes("연금") || company.includes("공제")) return "연기금"
  if (company.includes("증권")) return "국내증권"
  if (company.includes("외국") && company.includes("은행")) return "외국계"
  if (company.includes("은행")) return "국내은행"
  if (company.includes("보험")) return "보험사"
  if (company.includes("운용")) return "자산운용"
  if (company.includes("기업") || company.includes("실업") || company.includes("전기") || company.includes("산업")) return "일반기업"
  return "기타금융"
}

function resolveIndustry(
  row: any,
  companyIndustryMap: Map<string, string>,
  categoryCode?: string,
) {
  const company = String(row?.company_name || "").trim()
  const rawSubType = String(row?.sub_type || "").trim()
  const rawIndustry = String(row?.industry || "").trim()
  const normalizedSubType = normalizeIndustry(rawSubType)
  const normalizedIndustry = normalizeIndustry(rawIndustry)
  const mappedIndustry = lookupIndustryByCompany(company, companyIndustryMap) || ""
  const code = String(categoryCode || row?.category_code || "").trim()
  const isGeneric =
    !rawSubType || rawSubType === code || rawSubType === (CATEGORY_LABELS[code] || "")
  return (
    normalizedSubType ||
    normalizedIndustry ||
    mappedIndustry ||
    (isGeneric ? "" : rawSubType) ||
    inferIndustryFromCompany(company)
  )
}

function buildCompanyIndustryMap(records: any[]) {
  const byCompany = new Map<string, Map<string, number>>()
  for (const row of records || []) {
    const companyKey = normalizeCompanyKey(row?.company_name)
    if (!companyKey) continue
    const normalized = normalizeIndustry(row?.sub_type) || normalizeIndustry(row?.industry)
    if (!normalized) continue
    const bucket = byCompany.get(companyKey) ?? new Map<string, number>()
    bucket.set(normalized, (bucket.get(normalized) ?? 0) + 1)
    byCompany.set(companyKey, bucket)
  }
  const result = new Map<string, string>()
  for (const [companyKey, bucket] of byCompany.entries()) {
    let bestIndustry = ""
    let bestCount = -1
    for (const [industry, count] of bucket.entries()) {
      if (count > bestCount) {
        bestIndustry = industry
        bestCount = count
      }
    }
    if (bestIndustry) result.set(companyKey, bestIndustry)
  }
  return result
}

async function loadMock() {
  const stat = await fs.stat(MOCK_PATH)
  if (mockCache && mockCache.mtimeMs === stat.mtimeMs) {
    return mockCache.payload
  }
  const mockRaw = await fs.readFile(MOCK_PATH, "utf8")
  const payload = JSON.parse(mockRaw.replace(/^\uFEFF/, ""))
  mockCache = { mtimeMs: stat.mtimeMs, payload }
  return payload
}

async function loadAppStateIndustryMap() {
  try {
    const stat = await fs.stat(APP_STATE_PATH)
    if (appStateIndustryCache && appStateIndustryCache.mtimeMs === stat.mtimeMs) {
      return new Map(appStateIndustryCache.map)
    }

    const appStateRaw = await fs.readFile(APP_STATE_PATH, "utf8")
    const appState = JSON.parse(appStateRaw.replace(/^\uFEFF/, ""))
    const map = new Map<string, string>()
    const put = (company: unknown, industry: unknown) => {
      const companyName = normalizeCompanyKey(company)
      const normalizedIndustry = normalizeIndustry(industry)
      if (!companyName || !normalizedIndustry) return
      map.set(companyName, normalizedIndustry)
    }
    const contracts = Array.isArray(appState?.contracts) ? appState.contracts : []
    for (const row of contracts) put(row?.companyName, row?.industry)
    const integrated = Array.isArray(appState?.collection?.integrated) ? appState.collection.integrated : []
    for (const row of integrated) put(row?.companyName, row?.industry)
    const longTerm = Array.isArray(appState?.collection?.longTerm) ? appState.collection.longTerm : []
    for (const row of longTerm) put(row?.companyName, row?.industry)
    appStateIndustryCache = { mtimeMs: stat.mtimeMs, map }
    return new Map(map)
  } catch {
    return new Map<string, string>()
  }
}

async function saveMock(payload: any) {
  const nextJson = JSON.stringify(payload, null, 2)
  await fs.writeFile(MOCK_PATH, nextJson, "utf8")
  const stat = await fs.stat(MOCK_PATH)
  mockCache = { mtimeMs: stat.mtimeMs, payload }
  getResponseCache.clear()
}

function buildCounts(records: any[], categories: any[]) {
  const counts: Record<string, number> = {}
  for (const cat of categories) {
    counts[cat.category_code] = 0
  }
  const active = records.filter((row) => Number(row.is_active) === 1)
  const getUniqueCount = (code: string) => {
    const ids = active
      .filter((row) => row.category_code === code)
      .map((row) => row.user_id)
      .filter(Boolean)
    return new Set(ids).size
  }
  for (const cat of categories) {
    const code = cat.category_code
    if (code === "SOFR") {
      let sum = 0
      for (const row of active.filter((r) => r.category_code === code)) {
        const raw = String(row.apply_count || "")
        const digits = raw.replace(/[^0-9]/g, "")
        const value = digits ? Number(digits) : 0
        if (value > 0) sum += value
      }
      counts[code] = sum
      continue
    }
    if (["BOND", "INDEX", "LME"].includes(code)) {
      counts[code] = getUniqueCount(code)
      continue
    }
    if (code === "STOCK") {
      counts[code] = active.filter((row) => row.category_code === code).length
      continue
    }
    counts[code] = active.filter((row) => row.category_code === code).length
  }
  return counts
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const basis = searchParams.get("basis") || "seed"
  const date = searchParams.get("date") || ""
  const categoryFilter = searchParams.get("category") || "all"
  const statusFilter = searchParams.get("status") || "all"
  const search = (searchParams.get("search") || "").toLowerCase()
  const activeOnly = searchParams.get("activeOnly") !== "0"
  const cacheKey = `${basis}|${date}|${categoryFilter}|${statusFilter}|${search}|${activeOnly ? "1" : "0"}`

  const cachedResponse = getResponseCache.get(cacheKey)
  if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
    return NextResponse.json(cachedResponse.payload)
  }

  try {
    const mock = await loadMock()
    const appStateIndustryMap = await loadAppStateIndustryMap()
    const categories = (mock.categories || []).map((cat: any) => ({
      ...cat,
      category_name_ko: cat.category_name_ko || CATEGORY_LABELS[cat.category_code] || cat.category_code,
    }))
    const optionRecordsRaw = mock.optionRecords || []
    const companyIndustryMap = buildCompanyIndustryMap(optionRecordsRaw)
    for (const [company, industry] of appStateIndustryMap.entries()) {
      companyIndustryMap.set(company, industry)
    }
    const historyCounts = mock.historyCounts || []
    const seedCounts = mock.seedCounts || []
    const historyDates = Array.from<string>(
      new Set<string>(historyCounts.map((row: any) => String(row.snapshot_date || "")).filter(Boolean)),
    ).sort((a, b) => (a < b ? 1 : -1))

    const latestMap = new Map<string, number>()
    for (const row of historyCounts) {
      const current = latestMap.get(row.category_code)
      if (current === undefined) latestMap.set(row.category_code, row.count_value)
    }

    const seedMap = new Map<string, number>(seedCounts.map((row: any) => [row.category_code, row.count_value]))
    const dateMap = new Map<string, number>(
      historyCounts.filter((row: any) => row.snapshot_date === date).map((row: any) => [row.category_code, row.count_value]),
    )

    const cards = categories.map((cat: any) => {
      const key = normalizeCategoryCode(cat.category_code)
      let value = seedMap.get(key) || 0
      if (basis === "latest") value = latestMap.get(key) ?? value
      if (basis === "date") value = dateMap.get(key) ?? value
      return { ...cat, count_value: value }
    })

    const filteredRawRecords = optionRecordsRaw.filter((row: any) => {
      if (activeOnly && Number(row.is_active) !== 1) return false
      if (categoryFilter !== "all" && row.category_code !== categoryFilter) return false
      const normalizedStatus = normalizeStatus(row.status)
      if (statusFilter !== "all" && normalizedStatus !== statusFilter) return false
      if (!search) return true
      const target = `${row.company_name || ""} ${row.user_id || ""} ${row.requester_name || ""} ${row.department || ""}`.toLowerCase()
      return target.includes(search)
    })

    const records = filteredRawRecords
      .map((row: any) => {
        const resolvedIndustry = resolveIndustry(row, companyIndustryMap, row.category_code)
        return {
          ...row,
          category_name_ko: row.category_name_ko || CATEGORY_LABELS[row.category_code] || row.category_code,
          sub_type: resolvedIndustry,
          industry: resolvedIndustry,
          status: normalizeStatus(row.status),
        }
      })

    const responsePayload = {
      source: "mock",
      basis,
      date,
      categories,
      cards,
      historyDates,
      records,
      views: { v_dashboard_card_counts: [], v_current_active_counts: [] },
    }

    getResponseCache.set(cacheKey, {
      expiresAt: Date.now() + GET_CACHE_TTL_MS,
      payload: responsePayload,
    })

    return NextResponse.json(responsePayload)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "옵션 데이터를 읽지 못했습니다." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const action = payload?.action
    const mock = await loadMock()
    const appStateIndustryMap = await loadAppStateIndustryMap()
    const categories = mock.categories || []
    const optionRecords = mock.optionRecords || []
    const companyIndustryMap = buildCompanyIndustryMap(optionRecords)
    for (const [company, industry] of appStateIndustryMap.entries()) {
      companyIndustryMap.set(company, industry)
    }
    const record = payload?.record

    if (action === "upsert" && record) {
      const recordId = record.record_id || `record-${Date.now()}`
      const existingIndex = optionRecords.findIndex((row: any) => row.record_id === recordId)
      const categoryCode = normalizeCategoryCode(record.category_code)
      const categoryLabel = CATEGORY_LABELS[categoryCode] || record.category_name_ko || categoryCode
      const resolvedIndustry = resolveIndustry(record, companyIndustryMap, categoryCode)
      const nextRecord = {
        ...record,
        record_id: recordId,
        category_code: categoryCode,
        category_name_ko: categoryLabel,
        sub_type: resolvedIndustry,
        industry: resolvedIndustry,
        status: normalizeStatus(record.status),
        is_active: Number(record.is_active ?? 1),
      }
      if (existingIndex >= 0) optionRecords[existingIndex] = nextRecord
      else optionRecords.unshift(nextRecord)
    }

    if (action === "delete" && payload?.record_id) {
      const target = payload.record_id
      const idx = optionRecords.findIndex((row: any) => row.record_id === target)
      if (idx >= 0) optionRecords.splice(idx, 1)
    }

    const counts = buildCounts(optionRecords, categories)
    const seedCounts = categories.map((cat: any) => ({
      category_code: cat.category_code,
      count_value: counts[cat.category_code] || 0,
    }))

    const today = new Date().toISOString().slice(0, 10)
    const historyCounts = (mock.historyCounts || []).filter((row: any) => row.snapshot_date !== today)
    for (const cat of categories) {
      historyCounts.push({
        snapshot_date: today,
        category_code: cat.category_code,
        count_value: counts[cat.category_code] || 0,
      })
    }

    const nextMock = {
      ...mock,
      optionRecords,
      seedCounts,
      historyCounts,
    }
    await saveMock(nextMock)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "저장에 실패했습니다." }, { status: 500 })
  }
}
