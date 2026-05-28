import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { requireAnyApiPermission, requireApiPermission } from "@/lib/auth/server"
import { readDashboardState, readOptionsMock, writeOptionsMock } from "@/lib/shared-db-store"
import seedOptionsMock from "@/data/options-dashboard.mock.json"

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

const INDEX_COUNTABLE_SUB_TYPES = new Set([
  "기업",
  "은행",
  "증권",
  "보험",
  "자산운용",
  "공제회",
  "외국계",
  "선물",
  "정부기관",
  "공기관",
  "공사",
  "연기금/공공기관",
  "연기금",
  "공공기관",
])
const INDEX_EXCLUDED_USER_IDS = new Set([
  "E040152",
  "E040480",
  "E030406",
  "E070159",
  "E070487",
  "E100350",
  "E220351",
  "E220374",
  "E020879",
  "E040241",
  "E120049",
  "E120192",
  "E120390",
  "E120850",
  "E100356",
  "E170055",
  "E120017",
  "E130475",
  "E140026",
  "E160845",
  "E160846",
  "E020801",
  "E090550",
  "E151211",
  "E160475",
  "E160476",
  "E150459",
  "E170106",
  "E070325",
  "E170616",
  "E170617",
  "E160297",
  "E160361",
  "E190338",
  "E220466",
  "E110733",
])

const MOCK_PATH = path.join(process.cwd(), "data", "options-dashboard.mock.json")
const APP_STATE_PATH = path.join(process.cwd(), "data", "app-state.json")

const GET_CACHE_TTL_MS = 12 * 1000
const getResponseCache = new Map<string, { expiresAt: number; payload: any }>()
let industryMapCache: { expiresAt: number; value: Map<string, string> } | null = null
let bundledSofrRecordsCache: any[] | null = null

const REQUIRED_SOFR_RECORDS = [
  {
    record_id: "sofr-e070527",
    id_kind: "contract",
    category_code: "SOFR",
    category_name_ko: "SOFR",
    sub_type: "SOFR",
    industry: "일반기업",
    company_name: "CJ제일제당",
    user_id: "E070527",
    department: "자금팀",
    requester_name: "",
    contact: "",
    request_date: "",
    real_apply: "",
    billing_month: "26년 5월",
    status: "",
    agreement: "",
    customer_type: "",
    tr_cd: "",
    dedicated: "",
    quantity: "",
    recommender: "",
    receiver: "이홍민",
    apply_count: "1",
    apply_ids: "E070527",
    amount: "",
    note: "추가합의서 수령 완료",
    is_active: 1,
  },
  {
    record_id: "sofr-e260221",
    id_kind: "contract",
    category_code: "SOFR",
    category_name_ko: "SOFR",
    sub_type: "SOFR",
    industry: "기타금융",
    company_name: "우리금융캐피탈",
    user_id: "E260221",
    department: "자금부",
    requester_name: "",
    contact: "",
    request_date: "",
    real_apply: "",
    billing_month: "27년 1월",
    status: "",
    agreement: "",
    customer_type: "",
    tr_cd: "",
    dedicated: "",
    quantity: "",
    recommender: "",
    receiver: "정진영",
    apply_count: "1",
    apply_ids: "E260221",
    amount: "",
    note: "",
    is_active: 1,
  },
]

function normalizeCategoryCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function isCountableIndexRecord(row: any) {
  if (normalizeCategoryCode(row?.category_code) !== "INDEX") return true
  const subType = String(row?.sub_type || "").trim()
  const userId = String(row?.user_id || "").trim()
  return INDEX_COUNTABLE_SUB_TYPES.has(subType) && !INDEX_EXCLUDED_USER_IDS.has(userId)
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "active") return "사용중"
  if (raw === "inactive") return "중지"
  return String(value ?? "").trim()
}

function normalizeOptionIdKind(value: unknown): "contract" | "trial" | "free" {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "trial" || raw === "test" || raw === "시험" || raw === "테스트") return "trial"
  if (raw === "free" || raw === "무료" || raw === "무상") return "free"
  return "contract"
}

function getOptionIdKind(record: any): "contract" | "trial" | "free" {
  return normalizeOptionIdKind(record?.id_kind ?? record?.id_type ?? record?.idGroup ?? record?.option_id_type)
}

function isContractOptionRecord(record: any) {
  return getOptionIdKind(record) === "contract"
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
  const code = String(categoryCode || row?.category_code || "").trim()
  const isGeneric =
    !rawSubType || rawSubType === code || rawSubType === (CATEGORY_LABELS[code] || "")
  if (normalizedSubType) return normalizedSubType
  if (normalizedIndustry) return normalizedIndustry
  if (!isGeneric && rawSubType) return rawSubType
  const mappedIndustry = lookupIndustryByCompany(company, companyIndustryMap) || ""
  return (
    mappedIndustry ||
    inferIndustryFromCompany(company)
  )
}

function resolveDisplayIndustry(row: any, categoryCode?: string) {
  const company = String(row?.company_name || "").trim()
  const rawSubType = String(row?.sub_type || "").trim()
  const rawIndustry = String(row?.industry || "").trim()
  const normalizedSubType = normalizeIndustry(rawSubType)
  const normalizedIndustry = normalizeIndustry(rawIndustry)
  const code = String(categoryCode || row?.category_code || "").trim()
  const isGeneric =
    !rawSubType || rawSubType === code || rawSubType === (CATEGORY_LABELS[code] || "")
  if (normalizedSubType) return normalizedSubType
  if (normalizedIndustry) return normalizedIndustry
  if (!isGeneric && rawSubType) return rawSubType
  return inferIndustryFromCompany(company)
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
  const payload = await readOptionsMock<any>(MOCK_PATH)
  if (payload) return payload
  return {
    categories: [],
    optionRecords: [],
    seedCounts: [],
    historyCounts: [],
  }
}

function scrubOptionPrivacyFields(mock: any) {
  if (!mock || typeof mock !== "object") return false
  if (!Array.isArray(mock.optionRecords)) return false
  let changed = false
  mock.optionRecords = mock.optionRecords.map((record: any) => {
    if (!record || typeof record !== "object") return record
    if (record.requester_name === "" && record.contact === "") return record
    changed = true
    return {
      ...record,
      requester_name: "",
      contact: "",
    }
  })
  return changed
}

function splitOptionUserIds(value: unknown) {
  const matches = String(value || "").match(/E\d{6}/gi) || []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const match of matches) {
    const id = match.toUpperCase()
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function normalizeSofrOptionRecords(mock: any) {
  if (!mock || typeof mock !== "object") return false
  if (!Array.isArray(mock.optionRecords)) return false

  let changed = false
  const normalized: any[] = []
  for (const record of mock.optionRecords) {
    if (!record || typeof record !== "object" || normalizeCategoryCode(record.category_code) !== "SOFR") {
      normalized.push(record)
      continue
    }

    const applyIds = splitOptionUserIds(record.apply_ids)
    const ids = applyIds.length ? applyIds : splitOptionUserIds(record.user_id)

    const idKind = getOptionIdKind(record)
    if (!ids.length) {
      if (
        record.category_code !== "SOFR" ||
        record.category_name_ko !== "SOFR" ||
        record.id_kind !== idKind ||
        record.requester_name !== "" ||
        record.contact !== "" ||
        Number(record.is_active) !== 1
      ) {
        changed = true
      }
      normalized.push({
        ...record,
        id_kind: idKind,
        category_code: "SOFR",
        category_name_ko: "SOFR",
        requester_name: "",
        contact: "",
        is_active: 1,
      })
      continue
    }

    const originalUserId = String(record.user_id || "").trim().toUpperCase()
    const originalApplyIds = String(record.apply_ids || "").trim().toUpperCase()
    const alreadySingle =
      ids.length === 1 &&
      originalUserId === ids[0] &&
      (!originalApplyIds || originalApplyIds === ids[0]) &&
      record.category_code === "SOFR" &&
      record.category_name_ko === "SOFR" &&
      record.id_kind === idKind &&
      String(record.apply_count || "1").trim() === "1" &&
      Number(record.is_active) === 1 &&
      record.requester_name === "" &&
      record.contact === ""

    if (!alreadySingle) changed = true

    ids.forEach((id) => {
      const currentRecordId = String(record.record_id || "")
      const canKeepRecordId =
        ids.length === 1 &&
        originalUserId === id &&
        (idKind === "contract" || currentRecordId.includes(`-${idKind}-`))
      normalized.push({
        ...record,
        record_id: canKeepRecordId
          ? record.record_id
          : idKind === "contract"
            ? `sofr-${id.toLowerCase()}`
            : `sofr-${idKind}-${id.toLowerCase()}`,
        id_kind: idKind,
        category_code: "SOFR",
        category_name_ko: "SOFR",
        user_id: id,
        requester_name: "",
        contact: "",
        apply_count: "1",
        apply_ids: id,
        is_active: 1,
      })
    })
  }

  if (normalized.length !== mock.optionRecords.length) changed = true
  mock.optionRecords = normalized
  return changed
}

function getSofrRecords(mock: any) {
  return Array.isArray(mock?.optionRecords)
    ? mock.optionRecords.filter((record: any) => normalizeCategoryCode(record?.category_code) === "SOFR")
    : []
}

function getSingleOptionUserId(record: any) {
  const userIds = splitOptionUserIds(record?.user_id)
  if (userIds.length) return userIds[0]
  const applyIds = splitOptionUserIds(record?.apply_ids)
  return applyIds[0] || ""
}

function normalizeOptionUserId(value: unknown) {
  const ids = splitOptionUserIds(value)
  return ids[0] || String(value ?? "").trim().toUpperCase()
}

function getDeletedSofrUserIds(mock: any): Set<string> {
  return new Set<string>(
    (Array.isArray(mock?.sofrDeletedUserIds) ? mock.sofrDeletedUserIds : [])
      .map((value: unknown) => normalizeOptionUserId(value))
      .filter((value: string) => Boolean(value)),
  )
}

function setDeletedSofrUserIds(mock: any, deletedIds: Set<string>) {
  const ids = Array.from(deletedIds).filter(Boolean).sort()
  if (ids.length) mock.sofrDeletedUserIds = ids
  else delete mock.sofrDeletedUserIds
}

function withRequiredSofrRecords(records: any[]) {
  const byUserId = new Map<string, any>()
  for (const record of records) {
    const userId = getSingleOptionUserId(record)
    if (!userId || byUserId.has(userId)) continue
    byUserId.set(userId, {
      ...record,
      record_id: `sofr-${userId.toLowerCase()}`,
      id_kind: "contract",
      category_code: "SOFR",
      category_name_ko: "SOFR",
      user_id: userId,
      requester_name: "",
      contact: "",
      apply_count: "1",
      apply_ids: userId,
      is_active: 1,
    })
  }
  for (const record of REQUIRED_SOFR_RECORDS) {
    const userId = getSingleOptionUserId(record)
    if (!userId || byUserId.has(userId)) continue
    byUserId.set(userId, { ...record })
  }
  return Array.from(byUserId.values())
}

function buildBundledSofrRecords(source: any) {
  const parsed = JSON.parse(JSON.stringify(source || {}))
  normalizeSofrOptionRecords(parsed)
  return getSofrRecords(parsed)
    .filter((record: any) => splitOptionUserIds(record?.user_id).length === 1)
    .map((record: any) => ({
      ...record,
      id_kind: "contract",
      category_code: "SOFR",
      category_name_ko: "SOFR",
      requester_name: "",
      contact: "",
      apply_count: "1",
      apply_ids: String(record.user_id || "").trim().toUpperCase(),
      is_active: 1,
    }))
}

async function loadBundledSofrRecords(): Promise<any[]> {
  if (bundledSofrRecordsCache) return bundledSofrRecordsCache
  const importedRecords = buildBundledSofrRecords(seedOptionsMock)
  if (importedRecords.length) {
    bundledSofrRecordsCache = withRequiredSofrRecords(importedRecords)
    return bundledSofrRecordsCache
  }
  try {
    const raw = await fs.readFile(MOCK_PATH, "utf8")
    const parsed = JSON.parse(raw)
    const records = buildBundledSofrRecords(parsed)
    bundledSofrRecordsCache = withRequiredSofrRecords(records)
    return bundledSofrRecordsCache
  } catch {
    const records: any[] = []
    bundledSofrRecordsCache = records
    return records
  }
}

async function hydrateSofrFromBundledMockIfNewer(mock: any) {
  if (!Array.isArray(mock?.optionRecords)) return false
  const bundledSofrRecords = await loadBundledSofrRecords()
  if (!bundledSofrRecords.length) return false
  const deletedSofrIds = getDeletedSofrUserIds(mock)
  const availableBundledRecords = bundledSofrRecords.filter((record: any) => {
    const userId = getSingleOptionUserId(record)
    return userId && !deletedSofrIds.has(userId)
  })
  if (!availableBundledRecords.length) return false
  const currentSofrRecords = getSofrRecords(mock).filter(isContractOptionRecord)
  const currentByUserId = new Map<string, any>()
  for (const record of currentSofrRecords) {
    const userId = getSingleOptionUserId(record)
    if (userId && !currentByUserId.has(userId)) currentByUserId.set(userId, record)
  }
  const bundledIds = availableBundledRecords.map((record: any) => getSingleOptionUserId(record)).filter(Boolean)
  const bundledIdSet = new Set(bundledIds)
  const visibleCurrentIds = new Set(
    currentSofrRecords
      .filter((record: any) => Number(record?.is_active) === 1)
      .map((record: any) => getSingleOptionUserId(record))
      .filter((id: string) => id && bundledIdSet.has(id)),
  )
  const hasAllBundledVisibleIds =
    visibleCurrentIds.size === bundledIds.length && bundledIds.every((id) => visibleCurrentIds.has(id))
  if (hasAllBundledVisibleIds) return false

  const reconciledSofrRecords = availableBundledRecords.map((bundledRecord) => {
    const userId = getSingleOptionUserId(bundledRecord)
    const currentRecord = currentByUserId.get(userId) || {}
    return {
      ...bundledRecord,
      ...currentRecord,
      record_id: `sofr-${userId.toLowerCase()}`,
      id_kind: "contract",
      category_code: "SOFR",
      category_name_ko: "SOFR",
      sub_type: bundledRecord.sub_type || currentRecord.sub_type || "SOFR",
      user_id: userId,
      requester_name: "",
      contact: "",
      apply_count: "1",
      apply_ids: userId,
      is_active: 1,
    }
  })
  const extraSofrRecords = currentSofrRecords
    .map((record: any) => {
      const userId = getSingleOptionUserId(record)
      if (!userId || bundledIdSet.has(userId)) return null
      return {
        ...record,
        record_id: record.record_id || `sofr-${userId.toLowerCase()}`,
        id_kind: "contract",
        category_code: "SOFR",
        category_name_ko: "SOFR",
        user_id: userId,
        requester_name: "",
        contact: "",
        apply_count: "1",
        apply_ids: userId,
        is_active: Number(record.is_active ?? 1),
      }
    })
    .filter(Boolean)
  mock.optionRecords = [
    ...mock.optionRecords.filter(
      (record: any) => normalizeCategoryCode(record?.category_code) !== "SOFR" || !isContractOptionRecord(record),
    ),
    ...reconciledSofrRecords,
    ...extraSofrRecords,
  ]
  return true
}

async function loadAppStateIndustryMap() {
  if (industryMapCache && industryMapCache.expiresAt > Date.now()) {
    return new Map(industryMapCache.value)
  }
  try {
    const appState = (await readDashboardState<any>(APP_STATE_PATH)) || {}
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
    industryMapCache = { expiresAt: Date.now() + 60 * 1000, value: new Map(map) }
    return new Map(map)
  } catch {
    return new Map<string, string>()
  }
}

async function saveMock(payload: any) {
  scrubOptionPrivacyFields(payload)
  await writeOptionsMock(payload)
  getResponseCache.clear()
  industryMapCache = null
}

function buildCounts(records: any[], categories: any[]) {
  const counts: Record<string, number> = {}
  for (const cat of categories) {
    counts[cat.category_code] = 0
  }
  const contractRecords = records.filter(isContractOptionRecord)
  const active = contractRecords.filter((row) => Number(row.is_active) === 1)
  const getUniqueCount = (code: string) => {
    const ids = active
      .filter((row) => normalizeCategoryCode(row.category_code) === code)
      .map((row) => row.user_id)
      .filter(Boolean)
    return new Set(ids).size
  }
  for (const cat of categories) {
    const code = cat.category_code
    if (code === "BOND") {
      // 해외채권은 동일 사용자ID가 여러 행에 있을 수 있으므로 엑셀/상세목록의 행 건수 기준으로 집계합니다.
      counts[code] = contractRecords.filter((row) => normalizeCategoryCode(row.category_code) === code).length
      continue
    }
    if (code === "SOFR") {
      let sum = 0
      for (const row of active.filter((r) => normalizeCategoryCode(r.category_code) === code)) {
        const raw = String(row.apply_count || "")
        const digits = raw.replace(/[^0-9]/g, "")
        const value = digits ? Number(digits) : 0
        if (value > 0) sum += value
      }
      counts[code] = sum
      continue
    }
    if (code === "INDEX") {
      const ids = active
        .filter((row) => normalizeCategoryCode(row.category_code) === code)
        .filter(isCountableIndexRecord)
        .map((row) => row.user_id)
        .filter(Boolean)
      counts[code] = new Set(ids).size
      continue
    }
    if (code === "LME") {
      counts[code] = getUniqueCount(code)
      continue
    }
    if (code === "STOCK") {
      counts[code] = active.filter((row) => normalizeCategoryCode(row.category_code) === code).length
      continue
    }
    counts[code] = active.filter((row) => normalizeCategoryCode(row.category_code) === code).length
  }
  return counts
}

export async function GET(req: Request) {
  const auth = await requireAnyApiPermission(["optionDashboard", "manualInput", "weeklyReport"], "view")
  if (!auth.ok) return auth.response
  const { searchParams } = new URL(req.url)
  const basis = searchParams.get("basis") || "seed"
  const date = searchParams.get("date") || ""
  const rawCategoryFilter = searchParams.get("category") || "all"
  const categoryFilter = rawCategoryFilter.trim().toLowerCase() === "all" ? "all" : normalizeCategoryCode(rawCategoryFilter)
  const statusFilter = searchParams.get("status") || "all"
  const search = (searchParams.get("search") || "").toLowerCase()
  const activeOnly = searchParams.get("activeOnly") !== "0"
  const includeRecords = searchParams.get("includeRecords") !== "0"
  const refresh = searchParams.get("refresh") === "1"
  const cacheKey = `${basis}|${date}|${categoryFilter}|${statusFilter}|${search}|${activeOnly ? "1" : "0"}|${includeRecords ? "records" : "summary"}`

  const cachedResponse = getResponseCache.get(cacheKey)
  if (!refresh && cachedResponse && cachedResponse.expiresAt > Date.now()) {
    return NextResponse.json(cachedResponse.payload)
  }

  try {
    const mock = await loadMock()
    const privacyScrubbed = scrubOptionPrivacyFields(mock)
    const sofrNormalized = normalizeSofrOptionRecords(mock)
    const sofrHydrated = await hydrateSofrFromBundledMockIfNewer(mock)
    if (privacyScrubbed || sofrNormalized || sofrHydrated) {
      await writeOptionsMock(mock, {
        menuLabel: "유료 옵션 정보 현황",
        changeLabel: (sofrNormalized || sofrHydrated) ? "SOFR 적용 아이디 분리" : "옵션 개인정보 필드 정리",
      })
      getResponseCache.clear()
    }
    const categories = (mock.categories || []).map((cat: any) => ({
      ...cat,
      category_name_ko: cat.category_name_ko || CATEGORY_LABELS[cat.category_code] || cat.category_code,
    }))
    const optionRecordsRaw = mock.optionRecords || []
    const computedCounts = buildCounts(optionRecordsRaw, categories)
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
      if (key !== "API") value = computedCounts[key] ?? value
      return { ...cat, count_value: value }
    })

    let records: any[] = []
    if (includeRecords) {
      const resolvedIndustryCache = new Map<string, string>()
      records = optionRecordsRaw
        .filter((row: any) => {
          const rowCategory = normalizeCategoryCode(row.category_code)
          if (activeOnly && rowCategory !== "BOND" && Number(row.is_active) !== 1) return false
          if (activeOnly && rowCategory === "INDEX" && getOptionIdKind(row) === "contract" && !isCountableIndexRecord(row)) return false
          if (categoryFilter !== "all" && rowCategory !== categoryFilter) return false
          const normalizedStatus = normalizeStatus(row.status)
          if (statusFilter !== "all" && normalizedStatus !== statusFilter) return false
          if (!search) return true
          const target = `${row.company_name || ""} ${row.user_id || ""} ${row.department || ""}`.toLowerCase()
          return target.includes(search)
        })
        .map((row: any) => {
          const industryCacheKey = `${row.category_code || ""}|${row.company_name || ""}|${row.sub_type || ""}|${row.industry || ""}`
          let resolvedIndustry = resolvedIndustryCache.get(industryCacheKey)
          if (resolvedIndustry === undefined) {
            resolvedIndustry = resolveDisplayIndustry(row, row.category_code)
            resolvedIndustryCache.set(industryCacheKey, resolvedIndustry)
          }
          return {
            ...row,
            id_kind: getOptionIdKind(row),
            requester_name: "",
            contact: "",
            category_code: normalizeCategoryCode(row.category_code),
            category_name_ko: row.category_name_ko || CATEGORY_LABELS[normalizeCategoryCode(row.category_code)] || row.category_code,
            sub_type: resolvedIndustry,
            industry: resolvedIndustry,
            status: normalizeStatus(row.status),
          }
        })
    }

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
  const auth = await requireApiPermission("optionDashboard", "edit")
  if (!auth.ok) return auth.response
  try {
    const payload = await req.json()
    const action = payload?.action
    const mock = await loadMock()
    scrubOptionPrivacyFields(mock)
    const appStateIndustryMap = await loadAppStateIndustryMap()
    const categories = mock.categories || []
    const optionRecords = mock.optionRecords || []
    const companyIndustryMap = buildCompanyIndustryMap(optionRecords)
    for (const [company, industry] of appStateIndustryMap.entries()) {
      companyIndustryMap.set(company, industry)
    }
    const record = payload?.record
    let affectedCategoryCode = ""
    let affectedIdKind: "contract" | "trial" | "free" = "contract"

    if (action === "upsert" && record) {
      const categoryCode = normalizeCategoryCode(record.category_code)
      const idKind = getOptionIdKind(record)
      affectedCategoryCode = categoryCode
      affectedIdKind = idKind
      const normalizedUserId = normalizeOptionUserId(record.user_id || record.apply_ids)
      const recordId =
        categoryCode === "SOFR" && normalizedUserId
          ? idKind === "contract"
            ? `sofr-${normalizedUserId.toLowerCase()}`
            : `sofr-${idKind}-${normalizedUserId.toLowerCase()}`
          : record.record_id || `record-${Date.now()}`
      const existingIndex = optionRecords.findIndex(
        (row: any) => row.record_id === recordId || (record.record_id && row.record_id === record.record_id),
      )
      if (categoryCode === "SOFR") {
        if (!normalizedUserId) {
          return NextResponse.json({ ok: false, error: "SOFR 사용자ID를 입력해 주세요." }, { status: 400 })
        }
        const duplicate = optionRecords.find((row: any) => {
          if (normalizeCategoryCode(row?.category_code) !== "SOFR") return false
          if (getOptionIdKind(row) !== idKind) return false
          if (record.record_id && String(row?.record_id || "") === String(record.record_id)) return false
          return getSingleOptionUserId(row) === normalizedUserId
        })
        if (duplicate) {
          return NextResponse.json(
            { ok: false, error: `중복된 SOFR 사용자ID가 존재합니다. (${normalizedUserId})` },
            { status: 409 },
          )
        }
      }
      const categoryLabel = CATEGORY_LABELS[categoryCode] || record.category_name_ko || categoryCode
      const resolvedIndustry = resolveIndustry(record, companyIndustryMap, categoryCode)
      const nextRecord = {
        ...record,
        requester_name: "",
        contact: "",
        record_id: recordId,
        id_kind: idKind,
        category_code: categoryCode,
        category_name_ko: categoryLabel,
        sub_type: resolvedIndustry,
        industry: resolvedIndustry,
        user_id: categoryCode === "SOFR" ? normalizedUserId : record.user_id,
        apply_count: categoryCode === "SOFR" ? "1" : record.apply_count,
        apply_ids: categoryCode === "SOFR" ? normalizedUserId : record.apply_ids,
        status: normalizeStatus(record.status),
        is_active: Number(record.is_active ?? 1),
      }
      if (existingIndex >= 0) optionRecords[existingIndex] = nextRecord
      else optionRecords.unshift(nextRecord)
      if (categoryCode === "SOFR" && idKind === "contract") {
        const deletedSofrIds = getDeletedSofrUserIds(mock)
        deletedSofrIds.delete(normalizedUserId)
        setDeletedSofrUserIds(mock, deletedSofrIds)
      }
    }

    if (action === "delete" && payload?.record_id) {
      const target = payload.record_id
      const idx = optionRecords.findIndex((row: any) => row.record_id === target)
      if (idx >= 0) {
        const targetRecord = optionRecords[idx]
        affectedCategoryCode = normalizeCategoryCode(targetRecord?.category_code)
        affectedIdKind = getOptionIdKind(targetRecord)
        if (normalizeCategoryCode(targetRecord?.category_code) === "SOFR" && isContractOptionRecord(targetRecord)) {
          const userId = getSingleOptionUserId(targetRecord)
          if (userId) {
            const deletedSofrIds = getDeletedSofrUserIds(mock)
            deletedSofrIds.add(userId)
            setDeletedSofrUserIds(mock, deletedSofrIds)
          }
        }
        optionRecords.splice(idx, 1)
      }
    }

    mock.optionRecords = optionRecords
    normalizeSofrOptionRecords(mock)
    const finalOptionRecords = mock.optionRecords || []
    const counts = buildCounts(finalOptionRecords, categories)
    const previousSeedMap = new Map<string, number>(
      (mock.seedCounts || []).map((row: any) => [normalizeCategoryCode(row?.category_code), Number(row?.count_value || 0)]),
    )
    const shouldRefreshCategoryCount = affectedCategoryCode && affectedIdKind === "contract"
    const getNextCount = (categoryCode: string) => {
      const code = normalizeCategoryCode(categoryCode)
      const computed = counts[code] || 0
      const previous = previousSeedMap.get(code)
      const value = shouldRefreshCategoryCount && code === affectedCategoryCode ? computed : previous ?? computed
      return value
    }
    const seedCounts = categories.map((cat: any) => ({
      category_code: cat.category_code,
      count_value: getNextCount(cat.category_code),
    }))

    const today = new Date().toISOString().slice(0, 10)
    const historyCounts = (mock.historyCounts || []).filter((row: any) => row.snapshot_date !== today)
    for (const cat of categories) {
      historyCounts.push({
        snapshot_date: today,
        category_code: cat.category_code,
        count_value: getNextCount(cat.category_code),
      })
    }

    const nextMock = {
      ...mock,
      optionRecords: finalOptionRecords,
      seedCounts,
      historyCounts,
    }
    scrubOptionPrivacyFields(nextMock)
    await writeOptionsMock(nextMock, {
      menuLabel: "유료 옵션 정보 현황",
      changeLabel: action === "delete" ? "옵션 행 삭제" : "옵션 행 저장",
    })
    getResponseCache.clear()
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "저장에 실패했습니다." }, { status: 500 })
  }
}
