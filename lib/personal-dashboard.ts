import { UserRecord } from "@/lib/auth/model"
import { getIndustryGroupLabel, normalizeAssignedIndustries } from "@/lib/industry-groups"

function parseContractMonthKey(value: unknown) {
  const text = String(value ?? "").trim()
  const match = text.match(/(\d{2,4})\D+(\d{1,2})/)
  if (match) {
    const year = match[1].length === 2 ? Number(`20${match[1]}`) : Number(match[1])
    const month = Number(match[2])
    if (year && month >= 1 && month <= 12) return year * 100 + month
  }
  const digits = text.replace(/[^\d]/g, "")
  if (digits.length === 6) return Number(digits)
  if (digits.length === 4) return Number(`20${digits}`)
  return 0
}

function parseDateKey(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 8) return Number(digits)
  if (digits.length === 6) return Number(`${digits}01`)
  return 0
}

function sortByContractMonthDesc<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return [...rows].sort((a, b) => parseContractMonthKey(b[key]) - parseContractMonthKey(a[key]))
}

function sortByDateDesc<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return [...rows].sort((a, b) => parseDateKey(b[key]) - parseDateKey(a[key]))
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeTerminationRows(rows: any[], sectionLabel: string) {
  return rows.map((row) => ({
    id: String(row?.id || `${sectionLabel}-${Math.random().toString(36).slice(2, 8)}`),
    sectionLabel,
    manager: normalizeText(row?.manager),
    customerId: normalizeText(row?.customerId),
    companyName: normalizeText(row?.companyName),
    departmentName: normalizeText(row?.departmentName),
    reason: normalizeText(row?.reason),
    receivedDate: normalizeText(row?.receivedDate),
    startDate: normalizeText(row?.startDate),
    endDate: normalizeText(row?.endDate),
    terminationDate: normalizeText(row?.terminationDate || row?.endDate),
    reflectedDate: normalizeText(row?.reflectedDate),
    penalty: Number(row?.penalty || 0),
  }))
}

export function buildPersonalDashboardData(user: UserRecord, data: any) {
  const allContracts = Array.isArray(data?.contracts) ? data.contracts : []
  const myContracts = sortByContractMonthDesc(
    allContracts.filter((row: any) => {
      const recommenderUserId = normalizeText(row?.recommenderUserId)
      const createdBy = normalizeText(row?.createdBy)
      const recommender = normalizeText(row?.recommender)
      return recommenderUserId === user.id || createdBy === user.id || recommender === user.name
    }).map((row: any) => ({
      ...row,
      industryGroup: getIndustryGroupLabel(row?.industry, row?.companyName),
    })),
    "contractMonth",
  )

  const myContractMonthlySummary = Array.from(
    myContracts.reduce((map: Map<string, { month: string; total: number; pending: number; recovered: number }>, row: any) => {
      const month = normalizeText(row?.contractMonth) || "미분류"
      const bucket = map.get(month) || { month, total: 0, pending: 0, recovered: 0 }
      bucket.total += 1
      if (normalizeText(row?.documentStatus) === "회수") {
        bucket.recovered += 1
      } else {
        bucket.pending += 1
      }
      map.set(month, bucket)
      return map
    }, new Map()),
  )
    .map(([, value]) => value)
    .sort((a, b) => parseContractMonthKey(b.month) - parseContractMonthKey(a.month))

  const assignedIndustries = normalizeAssignedIndustries(user.assignedIndustries)
  const collectionRows = [
    ...(Array.isArray(data?.collection?.integrated) ? data.collection.integrated : []),
    ...(Array.isArray(data?.collection?.longTerm) ? data.collection.longTerm : []),
  ]

  const myPendingDocuments = sortByContractMonthDesc(
    collectionRows
      .map((row: any) => ({
        ...row,
        industryGroup: getIndustryGroupLabel(row?.industry, row?.companyName),
      }))
      .filter((row: any) => {
      const industry = normalizeText(row?.industryGroup || row?.industry)
      const status = normalizeText(row?.status)
      return assignedIndustries.includes(industry) && status !== "회수"
    }),
    "claimMonth",
  )
  const pendingDocumentSource = sortByContractMonthDesc(
    collectionRows.map((row: any) => ({
      ...row,
      industryGroup: getIndustryGroupLabel(row?.industry, row?.companyName),
    })),
    "claimMonth",
  )

  const terminationSheets = Array.isArray(data?.termination?.sheets) ? data.termination.sheets : []
  const myTerminationRows = sortByDateDesc(
    terminationSheets
      .flatMap((sheet: any) => [
        ...normalizeTerminationRows(Array.isArray(sheet?.items) ? sheet.items : [], "해지 진행"),
        ...normalizeTerminationRows(Array.isArray(sheet?.confirmedItems) ? sheet.confirmedItems : [], "해지 확정"),
      ])
      .filter((row) => row.manager === user.name),
    "terminationDate",
  )

  const myHoldRows = sortByDateDesc(
    terminationSheets
      .flatMap((sheet: any) => normalizeTerminationRows(Array.isArray(sheet?.holdItems) ? sheet.holdItems : [], "청구보류"))
      .filter((row) => row.manager === user.name),
    "terminationDate",
  )

  return {
    myContracts,
    myContractMonthlySummary,
    myPendingDocuments,
    pendingDocumentSource,
    myTerminationRows,
    myHoldRows,
    assignedIndustries,
  }
}
