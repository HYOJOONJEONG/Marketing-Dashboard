"use client"

import { useMemo, useState, useTransition } from "react"

type ViewKey = "weekly-report" | "contracts" | "weekly-selection" | "manual-input" | "collection" | "termination"
type CollectionTabKey = "integrated" | "long-term"
type SectionKey = "performance" | "termination"

const viewTitles: Record<ViewKey, string> = {
  "weekly-report": "주간실적보고",
  contracts: "신규계약 리스트",
  "weekly-selection": "주간 반영 리스트",
  "manual-input": "수동 입력 리스트",
  collection: "계약서통합관리",
  termination: "해지 진행사항",
}

const performanceViews: ViewKey[] = ["weekly-report", "contracts", "weekly-selection", "manual-input", "collection"]

const cardClass = "rounded-[24px] border border-slate-200 bg-white shadow-sm"
const tableClass = "w-full text-[14px]"
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-600"
const tdClass = "border-t border-slate-200 px-3 py-2.5 align-middle text-[14px] text-slate-800"

function toNumber(value: unknown) {
  const num = Number(String(value ?? "").replace(/,/g, ""))
  return Number.isNaN(num) ? 0 : num
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("ko-KR")
}

function formatMoney(value: unknown) {
  return `${formatNumber(value)}원`
}

function normalizeDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 6) return `20${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`
  return String(value ?? "")
}

function toInputDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return ""
}

function parseDateKey(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 6) return Number(`20${digits}`)
  if (digits.length === 8) return Number(digits)
  return 0
}

function sortByDateDesc<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return [...items].sort((a, b) => parseDateKey(b[key]) - parseDateKey(a[key]))
}

function sortByKey<T extends Record<string, unknown>>(items: T[], key: keyof T, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1
  return [...items].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    const leftDate = parseDateKey(left)
    const rightDate = parseDateKey(right)
    if (leftDate || rightDate) {
      return (leftDate - rightDate) * factor
    }
    return String(left ?? "").localeCompare(String(right ?? ""), "ko", {
      numeric: true,
      sensitivity: "base",
    }) * factor
  })
}

function sanitizeText(text: unknown, fallback: string) {
  const value = String(text ?? "").trim()
  if (!value) return fallback
  if (/[가-힣]/.test(value)) return value
  if (/원/.test(value)) return value
  return fallback
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function renderChip(text: string, tone: "blue" | "green" | "red" | "gray" = "blue") {
  const className =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "bg-rose-50 text-rose-700"
        : tone === "gray"
          ? "bg-slate-100 text-slate-600"
          : "bg-blue-50 text-blue-700"
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${className}`}>{text}</span>
}

function summaryPairs(summary: any) {
  return [
    ["주간순증 합계", `${formatNumber(summary?.weeklyNetUnits)}대`],
    ["신규계약", `${formatNumber(summary?.weeklyNewContracts)}대`],
    ["해지계약", `${formatNumber(summary?.weeklyTerminationContracts)}대`],
    ["누적순증 합계", `${formatNumber(summary?.cumulativeNetUnits)}대`],
    ["누적신규 계약", `${formatNumber(summary?.cumulativeNewContracts)}대`],
    ["누적해지계약", `${formatNumber(summary?.cumulativeTerminationContracts)}대`],
    ["총 계약대수", `${formatNumber(summary?.totalContracts)}대`],
  ]
}

export function DashboardShell({
  initialData,
  initialView = "weekly-report",
  initialCollectionTab = "integrated",
  initialSheetId,
}: {
  initialData: any
  initialView?: ViewKey
  initialCollectionTab?: CollectionTabKey
  initialSheetId?: string
}) {
  const [data, setData] = useState<any>(initialData)
  const [view, setView] = useState<ViewKey>(initialView)
  const [collectionTab, setCollectionTab] = useState<CollectionTabKey>(initialCollectionTab)
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ performance: true, termination: true })
  const [terminationSheetId, setTerminationSheetId] = useState<string | undefined>(
    initialSheetId || initialData?.termination?.currentSheetId || initialData?.termination?.sheets?.[0]?.id,
  )
  const [isPending, startTransition] = useTransition()
  const [manualDraft, setManualDraft] = useState<any>(() => {
    const weekly = initialData?.weeklyReport || {}
    const summary = weekly.manualSummary || {}
    const headerFallback = `주간 순증 매출 (약 ${formatMoney(toNumber(summary?.weeklyNetUnits) * 6160000)})`
    return {
      revenueHeaderText: sanitizeText(weekly.revenueHeaderText, headerFallback),
      subtitleOne: sanitizeText(weekly.subtitleOne, "2025년 순증 매출"),
      subtitleTwo: sanitizeText(weekly.subtitleTwo, "연간 누적 매출"),
      manualSummary: { ...summary },
    }
  })
  const [contractDraft, setContractDraft] = useState<any>({
    companyName: "",
    departmentName: "",
    idCode: "",
    industry: "국내증권",
    contractMonth: "",
    recommender: "",
    documentStatus: "미회수",
  })
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [editingContractDraft, setEditingContractDraft] = useState<any>({})
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingCollectionDraft, setEditingCollectionDraft] = useState<any>({})
  const [collectionYearFilter, setCollectionYearFilter] = useState<number | "all">(initialData?.collection?.yearFilter || 2026)
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<string>(initialData?.collection?.statusFilter || "all")
  const [historyStack, setHistoryStack] = useState<any[]>([])
  const [terminationEntryMode, setTerminationEntryMode] = useState<"termination" | "hold">("termination")
  const [terminationDraft, setTerminationDraft] = useState<any>({
    receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
    manager: "",
    customerId: "",
    companyName: "",
    departmentName: "",
    reason: "계약만료",
    reasonDetail: "",
    terminationDate: "",
    penalty: "",
  })
  const [holdDraft, setHoldDraft] = useState<any>({
    receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
    manager: "",
    customerId: "",
    companyName: "",
    departmentName: "",
    reason: "사용자퇴사",
    startDate: "",
    endDate: "",
  })
  const [terminationSort, setTerminationSort] = useState<{ key: "receivedDate" | "terminationDate"; dir: "asc" | "desc" }>({
    key: "receivedDate",
    dir: "desc",
  })
  const [holdSort, setHoldSort] = useState<{ key: "receivedDate" | "startDate" | "endDate"; dir: "asc" | "desc" }>({
    key: "receivedDate",
    dir: "desc",
  })
  const [editingTerminationId, setEditingTerminationId] = useState<string | null>(null)
  const [editingTerminationDraft, setEditingTerminationDraft] = useState<any>({})
  const [editingHoldId, setEditingHoldId] = useState<string | null>(null)
  const [editingHoldDraft, setEditingHoldDraft] = useState<any>({})

  const weeklyReport = data.weeklyReport || {}
  const contracts = data.contracts || []
  const collection = data.collection || { integrated: [], longTerm: [] }
  const termination = data.termination || { sheets: [], currentSheetId: undefined }
  const currentYear = data.currentYear
  const availableYears = data.availableYears || data.years || []

  const selectedSheet = useMemo(
    () => termination.sheets?.find((sheet: any) => sheet.id === terminationSheetId) || termination.sheets?.[0] || null,
    [termination.sheets, terminationSheetId],
  )
  const includedContracts = useMemo(() => contracts.filter((row: any) => row.includedInWeekly), [contracts])
  const collectionRows = useMemo(
    () => (collectionTab === "long-term" ? collection.longTerm || [] : collection.integrated || []),
    [collection, collectionTab],
  )
  const filteredCollectionRows = useMemo(() => {
    return collectionRows.filter((row: any) => {
      const yearOk = collectionYearFilter === "all" ? true : Number(row.year) === Number(collectionYearFilter)
      const statusOk = collectionStatusFilter === "all" ? true : (row.status || "미정") === collectionStatusFilter
      return yearOk && statusOk
    })
  }, [collectionRows, collectionStatusFilter, collectionYearFilter])
  const terminationItems = useMemo(
    () => sortByKey(selectedSheet?.items || [], terminationSort.key, terminationSort.dir),
    [selectedSheet, terminationSort],
  )
  const holdItems = useMemo(
    () => sortByKey(selectedSheet?.holdItems || [], holdSort.key, holdSort.dir),
    [selectedSheet, holdSort],
  )
  const reasonSummary = useMemo(() => {
    const map = new Map<string, number>()
    terminationItems.forEach((row: any) => {
      map.set(row.reason || "기타", (map.get(row.reason || "기타") || 0) + 1)
    })
    return [...map.entries()]
  }, [terminationItems])

  async function persist(nextData: any) {
    setHistoryStack((prev) => [cloneData(data), ...prev].slice(0, 20))
    setData(nextData)
    await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextData),
    })
  }

  function handleUndoLastAction() {
    if (!historyStack.length) {
      window.alert("되돌릴 작업이 없습니다.")
      return
    }
    const [previous, ...rest] = historyStack
    startTransition(async () => {
      setHistoryStack(rest)
      setData(previous)
      await fetch("/api/dashboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previous),
      })
    })
  }

  function handleYearChange(nextYear: number) {
    setData((prev: any) => ({ ...prev, currentYear: nextYear }))
  }

  function handleCreateYear() {
    const now = new Date()
    const isOpen = now.getFullYear() > 2026 || (now.getFullYear() === 2026 && now.getMonth() >= 11)
    if (!isOpen) {
      window.alert("26년 12월에 기능이 열립니다.")
      return
    }
    const nextYear = Math.max(...(availableYears || [Number(currentYear)]).map((year: number) => Number(year))) + 1
    if ((availableYears || []).includes(nextYear)) {
      window.alert(`${nextYear}년은 이미 있습니다.`)
      setData((prev: any) => ({ ...prev, currentYear: nextYear }))
      return
    }
    startTransition(async () => {
      const nextData = {
        ...data,
        currentYear: nextYear,
        availableYears: [nextYear, ...availableYears],
        years: [nextYear, ...(data.years || [])],
      }
      await persist(nextData)
    })
  }

  function updateManualField(field: string, value: string) {
    setManualDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateContractDraft(field: string, value: string) {
    setContractDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function startContractEdit(row: any) {
    setEditingContractId(row.id)
    setEditingContractDraft({
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      idCode: row.idCode || "",
      industry: row.industry || "국내증권",
      contractMonth: row.contractMonth || "",
      recommender: row.recommender || "",
      documentStatus: row.documentStatus || "미회수",
    })
  }

  function updateEditingContractDraft(field: string, value: string) {
    setEditingContractDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateManualSummaryField(field: string, value: string) {
    setManualDraft((prev: any) => ({
      ...prev,
      manualSummary: { ...prev.manualSummary, [field]: value },
    }))
  }

  function toggleWeeklySelection(contractId: string) {
    startTransition(async () => {
      const nextContracts = contracts.map((row: any) =>
        row.id === contractId ? { ...row, includedInWeekly: !row.includedInWeekly } : row,
      )
      await persist({ ...data, contracts: nextContracts })
    })
  }

  function handleContractCreate() {
    if (!contractDraft.companyName.trim() || !contractDraft.idCode.trim()) {
      window.alert("회사명과 아이디는 필수입니다.")
      return
    }
    startTransition(async () => {
      const nextContracts = [
        {
          id: `c${Date.now()}`,
          companyName: contractDraft.companyName.trim(),
          departmentName: contractDraft.departmentName.trim(),
          idCode: contractDraft.idCode.trim(),
          industry: contractDraft.industry,
          contractMonth: contractDraft.contractMonth.trim(),
          documentStatus: contractDraft.documentStatus,
          includedInWeekly: false,
          recommender: contractDraft.recommender.trim(),
          replacementType: "신규",
          note: "",
        },
        ...contracts,
      ]
      await persist({ ...data, contracts: nextContracts })
      setContractDraft({
        companyName: "",
        departmentName: "",
        idCode: "",
        industry: "국내증권",
        contractMonth: "",
        recommender: "",
        documentStatus: "미회수",
      })
    })
  }

  function handleContractUpdate(contractId: string) {
    if (!editingContractDraft.companyName?.trim() || !editingContractDraft.idCode?.trim()) {
      window.alert("회사명과 아이디는 필수입니다.")
      return
    }
    startTransition(async () => {
      const nextContracts = contracts.map((row: any) =>
        row.id === contractId
          ? {
              ...row,
              companyName: editingContractDraft.companyName.trim(),
              departmentName: editingContractDraft.departmentName.trim(),
              idCode: editingContractDraft.idCode.trim(),
              industry: editingContractDraft.industry,
              contractMonth: editingContractDraft.contractMonth.trim(),
              recommender: editingContractDraft.recommender.trim(),
              documentStatus: editingContractDraft.documentStatus,
            }
          : row,
      )
      await persist({ ...data, contracts: nextContracts })
      setEditingContractId(null)
      setEditingContractDraft({})
    })
  }

  function handleContractDelete(contractId: string) {
    if (!window.confirm("이 계약을 삭제할까요?")) return
    startTransition(async () => {
      const nextContracts = contracts.filter((row: any) => row.id !== contractId)
      await persist({ ...data, contracts: nextContracts })
      if (editingContractId === contractId) {
        setEditingContractId(null)
        setEditingContractDraft({})
      }
    })
  }

  function handleCollectionDelete(rowId: string) {
    if (!window.confirm("이 항목을 삭제할까요?")) return
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).filter((row: any) => row.id !== rowId)
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
    })
  }

  function startCollectionEdit(row: any) {
    setEditingCollectionId(row.id)
    setEditingCollectionDraft({
      year: row.year || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      idCode: row.idCode || "",
      industry: row.industry || "",
      claimMonth: row.claimMonth || "",
      receiptDate: row.receiptDate || "",
      status: row.status || "미정",
    })
  }

  function updateEditingCollectionDraft(field: string, value: string) {
    setEditingCollectionDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleCollectionUpdate(rowId: string) {
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).map((row: any) =>
        row.id === rowId
          ? {
              ...row,
              year: editingCollectionDraft.year,
              companyName: editingCollectionDraft.companyName,
              departmentName: editingCollectionDraft.departmentName,
              idCode: editingCollectionDraft.idCode,
              industry: editingCollectionDraft.industry,
              claimMonth: editingCollectionDraft.claimMonth,
              receiptDate: editingCollectionDraft.receiptDate,
              status: editingCollectionDraft.status,
            }
          : row,
      )
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
      setEditingCollectionId(null)
      setEditingCollectionDraft({})
    })
  }

  function handleCollectionStatusToggle(rowId: string, nextStatus: string) {
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).map((row: any) =>
        row.id === rowId
          ? {
              ...row,
              status: nextStatus,
              receiptDate:
                nextStatus === "회수"
                  ? row.receiptDate || normalizeDate(new Date().toISOString().slice(0, 10))
                  : "",
            }
          : row,
      )
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
    })
  }

  function handleCollectionReceiptDateChange(rowId: string, nextValue: string) {
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).map((row: any) =>
        row.id === rowId
          ? {
              ...row,
              receiptDate: nextValue,
            }
          : row,
      )
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
    })
  }


  function handleCollectionTabChange(nextTab: CollectionTabKey) {
    setCollectionTab(nextTab)
    if (nextTab === "long-term") {
      setCollectionYearFilter("all")
      setCollectionStatusFilter("미회수")
    } else {
      setCollectionYearFilter(2026)
      setCollectionStatusFilter("all")
    }
  }

  function toggleTerminationSelected(itemId: string) {
    if (!selectedSheet) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).map((row: any) =>
                row.id === itemId ? { ...row, selected: !row.selected } : row,
              ),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
    })
  }

  function updateTerminationDraft(field: string, value: string) {
    setTerminationDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateHoldDraft(field: string, value: string) {
    setHoldDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function resetTerminationDraft() {
    setTerminationDraft({
      receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
      manager: "",
      customerId: "",
      companyName: "",
      departmentName: "",
      reason: "계약만료",
      reasonDetail: "",
      terminationDate: "",
      penalty: "",
    })
  }

  function resetHoldDraft() {
    setHoldDraft({
      receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
      manager: "",
      customerId: "",
      companyName: "",
      departmentName: "",
      reason: "사용자퇴사",
      startDate: "",
      endDate: "",
    })
  }

  function handleTerminationCreate() {
    if (!selectedSheet) return
    if (!terminationDraft.customerId.trim() || !terminationDraft.companyName.trim()) {
      window.alert("고객번호와 고객사는 필수입니다.")
      return
    }
    const nextItem = {
      id: `term-${Date.now()}`,
      no: "0",
      selected: false,
      receivedDate: normalizeDate(terminationDraft.receivedDate),
      manager: terminationDraft.manager.trim(),
      customerId: terminationDraft.customerId.trim(),
      companyName: terminationDraft.companyName.trim(),
      departmentName: terminationDraft.departmentName.trim(),
      reason: terminationDraft.reason === "기타" && terminationDraft.reasonDetail.trim()
        ? `기타(${terminationDraft.reasonDetail.trim()})`
        : terminationDraft.reason,
      terminationDate: normalizeDate(terminationDraft.terminationDate),
      penalty: toNumber(terminationDraft.penalty),
    }
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: [nextItem, ...(sheet.items || [])],
              weeklyTerminationCount: (sheet.weeklyTerminationCount || 0) + 1,
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      resetTerminationDraft()
    })
  }

  function handleHoldCreate() {
    if (!selectedSheet) return
    if (!holdDraft.customerId.trim() || !holdDraft.companyName.trim()) {
      window.alert("고객번호와 고객사는 필수입니다.")
      return
    }
    const nextItem = {
      id: `hold-${Date.now()}`,
      no: "0",
      receivedDate: normalizeDate(holdDraft.receivedDate),
      manager: holdDraft.manager.trim(),
      customerId: holdDraft.customerId.trim(),
      companyName: holdDraft.companyName.trim(),
      departmentName: holdDraft.departmentName.trim(),
      reason: holdDraft.reason,
      startDate: normalizeDate(holdDraft.startDate),
      endDate: normalizeDate(holdDraft.endDate),
    }
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: [nextItem, ...(sheet.holdItems || [])],
              weeklyBillingHoldCount: (sheet.weeklyBillingHoldCount || 0) + 1,
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      resetHoldDraft()
    })
  }

  function toggleTerminationSort(key: "receivedDate" | "terminationDate") {
    setTerminationSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    )
  }

  function toggleHoldSort(key: "receivedDate" | "startDate" | "endDate") {
    setHoldSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    )
  }

  function handleCreateTerminationSheet() {
    const baseSheet = selectedSheet || termination.sheets?.[0] || {}
    const carriedItems = (baseSheet.items || [])
      .filter((row: any) => !row.selected)
      .map((row: any, index: number) => ({
        ...row,
        no: String(index + 1),
        selected: false,
      }))
    const carriedHoldItems = (baseSheet.holdItems || []).map((row: any, index: number) => ({
      ...row,
      no: String(index + 1),
    }))
    const newSheet = {
      id: `sheet-${Date.now()}`,
      name: "새시트",
      title: "단말기 해지 진행사항(새시트)",
      teamLabel: baseSheet.teamLabel || "정보사업본부 정보사업1팀",
      guidelines: baseSheet.guidelines || ["1. 해지 발생 시 본부장님 보고 진행", "2. CRM 및 해지 리스트 등록"],
      weeklyTerminationCount: carriedItems.length,
      weeklyBillingHoldCount: carriedHoldItems.length,
      items: carriedItems,
      holdItems: carriedHoldItems,
    }
    startTransition(async () => {
      const nextSheets = [newSheet, ...(termination.sheets || [])]
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: newSheet.id,
          sheets: nextSheets,
        },
      })
      setTerminationSheetId(newSheet.id)
    })
  }

  function handleRenameTerminationSheet() {
    if (!selectedSheet) return
    const nextName = window.prompt("시트명을 입력하세요.", selectedSheet.name || "새시트")
    if (!nextName || !nextName.trim()) return
    const trimmed = nextName.trim()
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              name: trimmed,
              title: `단말기 해지 진행사항(${trimmed})`,
            }
          : sheet,
      )
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: selectedSheet.id,
          sheets: nextSheets,
        },
      })
    })
  }

  function handleDeleteTerminationSheet() {
    if (!selectedSheet) return
    if (!window.confirm("이 시트를 삭제할까요?")) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).filter((sheet: any) => sheet.id !== selectedSheet.id)
      const nextCurrentId = nextSheets[0]?.id
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: nextCurrentId,
          sheets: nextSheets,
        },
      })
      setTerminationSheetId(nextCurrentId)
    })
  }

  function startTerminationEdit(row: any) {
    setEditingTerminationId(row.id)
    setEditingTerminationDraft({
      receivedDate: toInputDate(row.receivedDate),
      manager: row.manager || "",
      customerId: row.customerId || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      reason: row.reason === "기타" || String(row.reason || "").startsWith("기타(") ? "기타" : row.reason || "계약만료",
      reasonDetail: String(row.reason || "").startsWith("기타(") ? String(row.reason).replace(/^기타\((.*)\)$/, "$1") : "",
      terminationDate: toInputDate(row.terminationDate),
      penalty: row.penalty ? String(row.penalty) : "",
    })
  }

  function updateEditingTerminationDraft(field: string, value: string) {
    setEditingTerminationDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleTerminationUpdate(rowId: string) {
    if (!selectedSheet) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).map((row: any) =>
                row.id === rowId
                  ? {
                      ...row,
                      receivedDate: normalizeDate(editingTerminationDraft.receivedDate),
                      manager: editingTerminationDraft.manager?.trim() || "",
                      customerId: editingTerminationDraft.customerId?.trim() || "",
                      companyName: editingTerminationDraft.companyName?.trim() || "",
                      departmentName: editingTerminationDraft.departmentName?.trim() || "",
                      reason:
                        editingTerminationDraft.reason === "기타" && editingTerminationDraft.reasonDetail?.trim()
                          ? `기타(${editingTerminationDraft.reasonDetail.trim()})`
                          : editingTerminationDraft.reason,
                      terminationDate: normalizeDate(editingTerminationDraft.terminationDate),
                      penalty: toNumber(editingTerminationDraft.penalty),
                    }
                  : row,
              ),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      setEditingTerminationId(null)
      setEditingTerminationDraft({})
    })
  }

  function handleDeleteTerminationRow(rowId: string) {
    if (!selectedSheet) return
    if (!window.confirm("이 해지 건을 삭제할까요?")) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).filter((row: any) => row.id !== rowId),
              weeklyTerminationCount: Math.max(0, (sheet.weeklyTerminationCount || 0) - 1),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingTerminationId === rowId) {
        setEditingTerminationId(null)
        setEditingTerminationDraft({})
      }
    })
  }

  function startHoldEdit(row: any) {
    setEditingHoldId(row.id)
    setEditingHoldDraft({
      receivedDate: toInputDate(row.receivedDate),
      manager: row.manager || "",
      customerId: row.customerId || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      reason: row.reason || "사용자퇴사",
      startDate: toInputDate(row.startDate),
      endDate: toInputDate(row.endDate),
    })
  }

  function updateEditingHoldDraft(field: string, value: string) {
    setEditingHoldDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleHoldUpdate(rowId: string) {
    if (!selectedSheet) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: (sheet.holdItems || []).map((row: any) =>
                row.id === rowId
                  ? {
                      ...row,
                      receivedDate: normalizeDate(editingHoldDraft.receivedDate),
                      manager: editingHoldDraft.manager?.trim() || "",
                      customerId: editingHoldDraft.customerId?.trim() || "",
                      companyName: editingHoldDraft.companyName?.trim() || "",
                      departmentName: editingHoldDraft.departmentName?.trim() || "",
                      reason: editingHoldDraft.reason,
                      startDate: normalizeDate(editingHoldDraft.startDate),
                      endDate: normalizeDate(editingHoldDraft.endDate),
                    }
                  : row,
              ),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      setEditingHoldId(null)
      setEditingHoldDraft({})
    })
  }

  function handleDeleteHoldRow(rowId: string) {
    if (!selectedSheet) return
    if (!window.confirm("이 청구보류 건을 삭제할까요?")) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: (sheet.holdItems || []).filter((row: any) => row.id !== rowId),
              weeklyBillingHoldCount: Math.max(0, (sheet.weeklyBillingHoldCount || 0) - 1),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingHoldId === rowId) {
        setEditingHoldId(null)
        setEditingHoldDraft({})
      }
    })
  }

  function handleMoveHoldToTermination(rowId: string) {
    if (!selectedSheet) return
    const row = (selectedSheet.holdItems || []).find((item: any) => item.id === rowId)
    if (!row) return
    const movedItem = {
      id: `term-${Date.now()}`,
      no: "0",
      selected: false,
      receivedDate: row.receivedDate,
      manager: row.manager,
      customerId: row.customerId,
      companyName: row.companyName,
      departmentName: row.departmentName,
      reason: row.reason,
      terminationDate: row.endDate || "",
      penalty: 0,
    }
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: [movedItem, ...(sheet.items || [])],
              holdItems: (sheet.holdItems || []).filter((item: any) => item.id !== rowId),
              weeklyTerminationCount: (sheet.weeklyTerminationCount || 0) + 1,
              weeklyBillingHoldCount: Math.max(0, (sheet.weeklyBillingHoldCount || 0) - 1),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingHoldId === rowId) {
        setEditingHoldId(null)
        setEditingHoldDraft({})
      }
    })
  }

  function renderSortLabel(
    label: string,
    active: boolean,
    dir: "asc" | "desc",
    onClick: () => void,
  ) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-[13px] font-semibold ${active ? "text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
      >
        <span>{label}</span>
        <span className="text-[11px]">{active ? (dir === "asc" ? "ASC" : "DESC") : "↕"}</span>
      </button>
    )
  }

  function handleManualUpdate() {
    startTransition(async () => {
      const nextWeekly = {
        ...weeklyReport,
        revenueHeaderText: manualDraft.revenueHeaderText,
        subtitleOne: manualDraft.subtitleOne,
        subtitleTwo: manualDraft.subtitleTwo,
        manualSummary: { ...manualDraft.manualSummary },
      }
      await persist({ ...data, weeklyReport: nextWeekly })
      setView("weekly-report")
    })
  }

  const revenueHeaderText = sanitizeText(
    weeklyReport.revenueHeaderText,
    `주간 순증 매출 (약 ${formatMoney(toNumber(weeklyReport?.manualSummary?.weeklyNetUnits) * 6160000)})`,
  )

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside className="w-[272px] border-r border-slate-200 bg-white px-4 py-4">
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Marketing Division</div>
            <div className="mt-3 text-[15px] font-extrabold leading-[1.45] tracking-[-0.04em] text-slate-900">
              정보사업본부
              <br />
              통합 대시보드
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-11 rounded-full bg-blue-500" />
              <span className="text-[11px] font-medium text-slate-400">Internal Dashboard</span>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, performance: !prev.performance }))}
                className="flex w-full items-center justify-between px-2 py-1 text-[15px] font-bold text-slate-900"
              >
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />실적 관리</span>
                <span className="text-slate-400">{sections.performance ? "⌄" : "›"}</span>
              </button>
              {sections.performance && (
                <div className="mt-2 space-y-1">
                  {performanceViews.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                        view === key ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {viewTitles[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, termination: !prev.termination }))}
                className="flex w-full items-center justify-between px-2 py-1 text-[15px] font-bold text-slate-900"
              >
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />해지 관리</span>
                <span className="text-slate-400">{sections.termination ? "⌄" : "›"}</span>
              </button>
              {sections.termination && (
                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => setView("termination")}
                    className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                      view === "termination" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    해지 진행사항
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 px-5 py-5">
          <div className={`${cardClass} mb-5 flex items-start justify-between px-5 py-4`}>
            <div>
              <div className="text-[14px] text-slate-500">기준일 {weeklyReport.baseDate}</div>
              <h1 className="mt-2 text-[20px] font-black tracking-[-0.04em] text-slate-950">{viewTitles[view]}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700">
                {currentYear}년도
              </div>
              <button
                type="button"
                onClick={handleUndoLastAction}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!historyStack.length || isPending}
              >
                이전 작업 되돌리기
              </button>
            </div>
          </div>

          {view === "weekly-report" && (
            <div className="space-y-4">
              <section className={`${cardClass} p-5`}>
                <div className="mb-4 text-[18px] font-bold">계약 내역</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={tableClass}>
                    <thead><tr>{["회사명","부서","아이디","업종","계약월","계약서 회수","미회수"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                    <tbody>
                      {includedContracts.length ? includedContracts.map((row: any) => (
                        <tr key={row.id}>
                          <td className={tdClass}>{row.companyName}</td>
                          <td className={tdClass}>{row.departmentName}</td>
                          <td className={tdClass}>{row.idCode}</td>
                          <td className={tdClass}>{row.industry}</td>
                          <td className={tdClass}>{row.contractMonth}</td>
                          <td className={tdClass}>{row.documentStatus === "회수" ? "o" : ""}</td>
                          <td className={tdClass}>{row.documentStatus === "미회수" ? "o" : ""}</td>
                        </tr>
                      )) : <tr><td className={tdClass} colSpan={7}>금주 반영 계약이 없습니다.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={tableClass}>
                    <thead><tr>{["구분(월)","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","합계"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                    <tbody>
                      {(weeklyReport.revenueRows || []).map((row: any) => {
                        const total = (row.months || []).reduce((sum: number, value: number) => sum + toNumber(value), 0)
                        return (
                          <tr key={row.key}>
                            <td className={`${tdClass} font-semibold`}>{row.label}</td>
                            {(row.months || []).map((monthValue: number, index: number) => <td key={`${row.key}-${index}`} className={tdClass}>{formatNumber(monthValue)}</td>)}
                            <td className={`${tdClass} font-semibold`}>{formatNumber(total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-[13px] font-semibold text-slate-700">{revenueHeaderText}</div>
                <div className="mt-1 text-[12px] text-slate-500">{sanitizeText(weeklyReport.subtitleOne, "2025년 순증 매출")} / {sanitizeText(weeklyReport.subtitleTwo, "연간 누적 매출")}</div>
              </section>

              <section className={`${cardClass} p-5`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={tableClass}>
                    <thead><tr>{summaryPairs(weeklyReport.manualSummary).map(([label]) => <th key={label} className={thClass}>{label}</th>)}</tr></thead>
                    <tbody><tr>{summaryPairs(weeklyReport.manualSummary).map(([label, value]) => <td key={label} className={`${tdClass} text-center font-semibold`}>{value}</td>)}</tr></tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {view === "contracts" && (
            <div className={`${cardClass} p-5`}>
              <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-bold">신규계약 리스트</div><div className="text-[13px] text-slate-500">총 {formatNumber(contracts.length)}건</div></div>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-[14px] font-bold text-slate-800">신규계약 입력</div>
                <div className="grid grid-cols-7 gap-3">
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="회사명" value={contractDraft.companyName} onChange={(e)=>updateContractDraft("companyName", e.target.value)} />
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="부서" value={contractDraft.departmentName} onChange={(e)=>updateContractDraft("departmentName", e.target.value)} />
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="아이디" value={contractDraft.idCode} onChange={(e)=>updateContractDraft("idCode", e.target.value)} />
                  <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.industry} onChange={(e)=>updateContractDraft("industry", e.target.value)}>
                    {["국내증권","국내은행","외국계","자산운용","보험","일반기업","공사/정부","연기금","기타금융"].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="계약월" value={contractDraft.contractMonth} onChange={(e)=>updateContractDraft("contractMonth", e.target.value)} />
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="권유자" value={contractDraft.recommender} onChange={(e)=>updateContractDraft("recommender", e.target.value)} />
                  <div className="flex gap-2">
                    <select className="h-10 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.documentStatus} onChange={(e)=>updateContractDraft("documentStatus", e.target.value)}>
                      <option value="미회수">미회수</option>
                      <option value="회수">회수</option>
                    </select>
                    <button type="button" onClick={handleContractCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white">
                      {isPending ? "등록 중..." : "등록"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className={tableClass}>
                  <thead><tr>{["회사명","부서","아이디","업종","계약월","권유자","계약서 상태","작업"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                  <tbody>
                    {contracts.map((row: any) => {
                      const editing = editingContractId === row.id
                      return (
                        <tr key={row.id}>
                          <td className={`${tdClass} min-w-[180px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.companyName || ""} onChange={(e)=>updateEditingContractDraft("companyName", e.target.value)} /> : row.companyName}
                          </td>
                          <td className={`${tdClass} min-w-[180px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.departmentName || ""} onChange={(e)=>updateEditingContractDraft("departmentName", e.target.value)} /> : row.departmentName}
                          </td>
                          <td className={`${tdClass} min-w-[140px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.idCode || ""} onChange={(e)=>updateEditingContractDraft("idCode", e.target.value)} /> : row.idCode}
                          </td>
                          <td className={`${tdClass} min-w-[120px]`}>
                            {editing ? (
                              <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.industry || "국내증권"} onChange={(e)=>updateEditingContractDraft("industry", e.target.value)}>
                                {["국내증권","국내은행","외국계","자산운용","보험","일반기업","공사/정부","연기금","기타금융"].map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                            ) : row.industry}
                          </td>
                          <td className={`${tdClass} min-w-[140px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.contractMonth || ""} onChange={(e)=>updateEditingContractDraft("contractMonth", e.target.value)} /> : row.contractMonth}
                          </td>
                          <td className={`${tdClass} min-w-[140px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.recommender || ""} onChange={(e)=>updateEditingContractDraft("recommender", e.target.value)} /> : row.recommender}
                          </td>
                          <td className={`${tdClass} min-w-[130px]`}>
                            {editing ? (
                              <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.documentStatus || "미회수"} onChange={(e)=>updateEditingContractDraft("documentStatus", e.target.value)}>
                                <option value="미회수">미회수</option>
                                <option value="회수">회수</option>
                              </select>
                            ) : row.documentStatus}
                          </td>
                          <td className={`${tdClass} min-w-[220px]`}>
                            {editing ? (
                              <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleContractUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white whitespace-nowrap">수정완료</button>
                                <button type="button" onClick={() => handleContractDelete(row.id)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 whitespace-nowrap">삭제</button>
                                <button type="button" onClick={() => { setEditingContractId(null); setEditingContractDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold whitespace-nowrap">취소</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startContractEdit(row)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold">수정</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "weekly-selection" && (
            <div className={`${cardClass} p-5`}>
              <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-bold">주간 반영 리스트</div><div className="text-[13px] text-slate-500">현재 {formatNumber(contracts.length)}건 / 선택 {formatNumber(includedContracts.length)}건</div></div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className={tableClass}>
                  <thead><tr>{["선택","No.","회사명","부서명","ID","업종","계약월","권유자","계약서 상태"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                  <tbody>
                    {contracts.map((row: any, index: number) => (
                      <tr key={row.id} className={row.includedInWeekly ? "bg-blue-50" : ""}>
                        <td className={`${tdClass} text-center`}>
                          <input
                            type="checkbox"
                            checked={Boolean(row.includedInWeekly)}
                            onChange={() => toggleWeeklySelection(row.id)}
                          />
                        </td>
                        <td className={tdClass}>{index + 1}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{row.companyName}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{row.departmentName}</td>
                        <td className={tdClass}>{row.idCode}</td>
                        <td className={tdClass}>{row.industry}</td>
                        <td className={tdClass}>{row.contractMonth}</td>
                        <td className={tdClass}>{row.recommender}</td>
                        <td className={tdClass}>{row.documentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "manual-input" && (
            <div className={`${cardClass} space-y-4 p-5`}>
              <div className="flex items-center justify-between"><div className="text-[18px] font-bold">수동 입력 리스트</div><div className="text-[12px] font-semibold text-slate-400">핵심 지표</div></div>
              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-2"><div className="text-[12px] font-semibold text-slate-500">매출 헤더</div><input className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-[14px]" value={manualDraft.revenueHeaderText} onChange={(e)=>updateManualField("revenueHeaderText", e.target.value)} /></label>
                <label className="space-y-2"><div className="text-[12px] font-semibold text-slate-500">매출 부제 1</div><input className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-[14px]" value={manualDraft.subtitleOne} onChange={(e)=>updateManualField("subtitleOne", e.target.value)} /></label>
                <label className="space-y-2"><div className="text-[12px] font-semibold text-slate-500">매출 부제 2</div><input className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-[14px]" value={manualDraft.subtitleTwo} onChange={(e)=>updateManualField("subtitleTwo", e.target.value)} /></label>
              </div>
              <div className="grid grid-cols-7 gap-3">
                {[
                  ["weeklyNetUnits", "주간순증 합계"],
                  ["weeklyNewContracts", "신규계약"],
                  ["weeklyTerminationContracts", "해지계약"],
                  ["cumulativeNetUnits", "누적순증 합계"],
                  ["cumulativeNewContracts", "누적신규 계약"],
                  ["cumulativeTerminationContracts", "누적해지계약"],
                  ["totalContracts", "총 계약대수"],
                ].map(([field, label]) => (
                  <label key={field} className="space-y-2">
                    <div className="text-[12px] font-semibold text-slate-500">{label}</div>
                    <input className="h-10 w-full rounded-2xl border border-slate-200 px-4 text-[14px]" value={String(manualDraft.manualSummary?.[field] ?? "")} onChange={(e)=>updateManualSummaryField(field, e.target.value)} />
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={handleManualUpdate} className="h-11 rounded-2xl bg-blue-600 px-5 text-[14px] font-semibold text-white">{isPending ? "업데이트 중..." : "업데이트"}</button>
              </div>
            </div>
          )}

          {view === "collection" && (
            <div className="space-y-4">
              <div className={`${cardClass} p-5`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[18px] font-bold">계약서통합관리</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleCollectionTabChange("integrated")} className={`rounded-2xl px-4 py-2 text-[13px] font-semibold ${collectionTab === "integrated" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>통합관리</button>
                    <button type="button" onClick={() => handleCollectionTabChange("long-term")} className={`rounded-2xl px-4 py-2 text-[13px] font-semibold ${collectionTab === "long-term" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>장기미회수</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {renderChip(`전체 ${formatNumber(filteredCollectionRows.length)}건`, "blue")}
                  {renderChip(`회수 ${formatNumber(filteredCollectionRows.filter((row: any) => row.status === "회수").length)}건`, "green")}
                  {renderChip(`미회수 ${formatNumber(filteredCollectionRows.filter((row: any) => row.status === "미회수").length)}건`, "red")}
                  {renderChip(`미정 ${formatNumber(filteredCollectionRows.filter((row: any) => !row.status || row.status === "미정").length)}건`, "gray")}
                </div>
              </div>
              <div className={`${cardClass} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setCollectionYearFilter("all")} className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ${collectionYearFilter === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>전체</button>
                  {availableYears.map((year: number) => (
                    <button key={year} type="button" onClick={() => setCollectionYearFilter(year)} className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ${collectionYearFilter === year ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{year}년</button>
                  ))}
                  <div className="mx-1 h-6 w-px bg-slate-200" />
                  {[
                    ["all", "전체"],
                    ["회수", "회수"],
                    ["미회수", "미회수"],
                    ["미정", "미정"],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setCollectionStatusFilter(value)} className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ${collectionStatusFilter === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className={`${cardClass} p-5`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={tableClass}>
                    <thead><tr>{["No.","연도","회사명","부서명","ID","업종","청구월","회수일","상태","작업"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                    <tbody>
                      {filteredCollectionRows.map((row: any, index: number) => {
                        const editing = editingCollectionId === row.id
                        return (
                          <tr key={row.id}>
                            <td className={tdClass}>{index + 1}</td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-20 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.year || ""} onChange={(e)=>updateEditingCollectionDraft("year", e.target.value)} /> : row.year}
                            </td>
                            <td className={`${tdClass} whitespace-nowrap`}>
                              {editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.companyName || ""} onChange={(e)=>updateEditingCollectionDraft("companyName", e.target.value)} /> : row.companyName}
                            </td>
                            <td className={`${tdClass} whitespace-nowrap`}>
                              {editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.departmentName || ""} onChange={(e)=>updateEditingCollectionDraft("departmentName", e.target.value)} /> : row.departmentName}
                            </td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-full min-w-[100px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.idCode || ""} onChange={(e)=>updateEditingCollectionDraft("idCode", e.target.value)} /> : row.idCode}
                            </td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-full min-w-[100px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.industry || ""} onChange={(e)=>updateEditingCollectionDraft("industry", e.target.value)} /> : row.industry}
                            </td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-full min-w-[90px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.claimMonth || ""} onChange={(e)=>updateEditingCollectionDraft("claimMonth", e.target.value)} /> : row.claimMonth}
                            </td>
                            <td className={tdClass}>
                              {editing ? (
                                <input
                                  value={editingCollectionDraft.receiptDate || ""}
                                  onChange={(e) => updateEditingCollectionDraft("receiptDate", e.target.value)}
                                  placeholder="YYYY.MM.DD"
                                  className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
                                />
                              ) : (
                                row.receiptDate || ""
                              )}
                            </td>
                            <td className={tdClass}>
                              {editing ? (
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${
                                    row.status === "회수"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : row.status === "미회수"
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {row.status || "미정"}
                                </span>
                              ) : (
                                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionStatusToggle(row.id, "회수")}
                                    className={`rounded-lg px-3 py-1 text-[12px] font-semibold leading-none transition ${
                                      row.status === "회수"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "text-slate-500 hover:bg-white"
                                    }`}
                                  >
                                    회수
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionStatusToggle(row.id, "미회수")}
                                    className={`rounded-lg px-3 py-1 text-[12px] font-semibold leading-none transition ${
                                      row.status === "미회수"
                                        ? "bg-rose-50 text-rose-700"
                                        : "text-slate-500 hover:bg-white"
                                    }`}
                                  >
                                    미회수
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className={tdClass}>
                              {editing ? (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionUpdate(row.id)}
                                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                                  >
                                    수정완료
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionDelete(row.id)}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                  >
                                    삭제
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCollectionId(null)
                                      setEditingCollectionDraft({})
                                    }}
                                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startCollectionEdit(row)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  수정
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === "termination" && selectedSheet && (
            <div className="space-y-4">
              <div className={`${cardClass} p-5`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[18px] font-bold">{selectedSheet.title || `단말기 해지 진행사항(${selectedSheet.name})`}</div>
                    <div className="mt-2 text-[13px] text-slate-500">{selectedSheet.teamLabel}</div>
                    <div className="mt-1 space-y-1 text-[13px] text-slate-600">{(selectedSheet.guidelines || []).map((line: string) => <div key={line}>{line}</div>)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[12px] text-slate-500">금주 해지 건수</div><div className="mt-1 text-[20px] font-extrabold">{formatNumber(selectedSheet.weeklyTerminationCount)}건</div></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[12px] text-slate-500">금주 청구보류 건수</div><div className="mt-1 text-[20px] font-extrabold">{formatNumber(selectedSheet.weeklyBillingHoldCount)}건</div></div>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateTerminationSheet}
                    className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-[18px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    +
                  </button>
                  {(termination.sheets || []).map((sheet: any) => (
                    <button key={sheet.id} type="button" onClick={() => setTerminationSheetId(sheet.id)} className={`rounded-full px-3 py-2 text-[13px] font-semibold ${sheet.id === selectedSheet.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{sheet.name}</button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRenameTerminationSheet}
                      disabled={!selectedSheet}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      시트명 수정
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteTerminationSheet}
                      disabled={!selectedSheet}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      시트삭제
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="mb-2 text-[13px] font-semibold text-slate-700">해지 현황 구분</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white">
                      합계 {formatNumber(reasonSummary.reduce((sum, [, value]) => sum + Number(value), 0))}건
                    </span>
                    {reasonSummary.map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700"
                      >
                        <span className="mr-2 text-slate-500">{key}</span>
                        <span className="font-semibold text-slate-900">{formatNumber(value)}건</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`${cardClass} p-4`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-bold text-slate-900">
                        {terminationEntryMode === "termination" ? "해지 입력" : "청구보류 입력"}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500">
                        필수 항목을 입력한 뒤 등록하면 현재 시트에 바로 반영됩니다.
                      </div>
                    </div>
                    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setTerminationEntryMode("termination")}
                        className={`rounded-2xl px-3 py-1.5 text-[13px] font-semibold ${terminationEntryMode === "termination" ? "bg-blue-600 text-white" : "text-slate-600"}`}
                      >
                        해지 입력
                      </button>
                      <button
                        type="button"
                        onClick={() => setTerminationEntryMode("hold")}
                        className={`rounded-2xl px-3 py-1.5 text-[13px] font-semibold ${terminationEntryMode === "hold" ? "bg-blue-600 text-white" : "text-slate-600"}`}
                      >
                        청구보류 입력
                      </button>
                    </div>
                  </div>
                  {terminationEntryMode === "termination" ? (
                    <div className="grid grid-cols-4 gap-3">
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">접수일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={terminationDraft.receivedDate} onChange={(e)=>updateTerminationDraft("receivedDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">담당자</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="담당자" value={terminationDraft.manager} onChange={(e)=>updateTerminationDraft("manager", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객번호</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객번호" value={terminationDraft.customerId} onChange={(e)=>updateTerminationDraft("customerId", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객사</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객사" value={terminationDraft.companyName} onChange={(e)=>updateTerminationDraft("companyName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객 부서</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객 부서" value={terminationDraft.departmentName} onChange={(e)=>updateTerminationDraft("departmentName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">해지 사유</div>
                        <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={terminationDraft.reason} onChange={(e)=>updateTerminationDraft("reason", e.target.value)}>
                          {["계약만료","비용절감","사용자퇴사","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">해지일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={terminationDraft.terminationDate} onChange={(e)=>updateTerminationDraft("terminationDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">위약금</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="위약금" value={terminationDraft.penalty} onChange={(e)=>updateTerminationDraft("penalty", e.target.value)} />
                      </label>
                      {terminationDraft.reason === "기타" && (
                        <label className="space-y-1">
                          <div className="text-[12px] font-medium text-slate-600">기타 사유</div>
                          <input
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                            placeholder="기타 사유"
                            value={terminationDraft.reasonDetail}
                            onChange={(e)=>updateTerminationDraft("reasonDetail", e.target.value)}
                          />
                        </label>
                      )}
                      <div className="col-span-4 flex justify-end pt-1">
                        <button type="button" onClick={handleTerminationCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white">
                          {isPending ? "등록 중..." : "등록"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">접수일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.receivedDate} onChange={(e)=>updateHoldDraft("receivedDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">담당자</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="담당자" value={holdDraft.manager} onChange={(e)=>updateHoldDraft("manager", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객번호</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객번호" value={holdDraft.customerId} onChange={(e)=>updateHoldDraft("customerId", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객사</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객사" value={holdDraft.companyName} onChange={(e)=>updateHoldDraft("companyName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객 부서</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객 부서" value={holdDraft.departmentName} onChange={(e)=>updateHoldDraft("departmentName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">보류 사유</div>
                        <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={holdDraft.reason} onChange={(e)=>updateHoldDraft("reason", e.target.value)}>
                          {["사용자퇴사","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">시작일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.startDate} onChange={(e)=>updateHoldDraft("startDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">종료일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.endDate} onChange={(e)=>updateHoldDraft("endDate", e.target.value)} />
                      </label>
                      <div className="col-span-4 flex justify-end pt-1">
                        <button type="button" onClick={handleHoldCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white">
                          {isPending ? "등록 중..." : "등록"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className={`${cardClass} overflow-hidden p-0`}>
                  <div className="border-b border-slate-200 px-4 py-3 text-[17px] font-bold text-slate-900">해지 리스트</div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>No.</th>
                        <th className={`${thClass} text-center`}>선택</th>
                        <th className={thClass}>
                          {renderSortLabel("접수일", terminationSort.key === "receivedDate", terminationSort.dir, () => toggleTerminationSort("receivedDate"))}
                        </th>
                        <th className={thClass}>담당자</th>
                        <th className={thClass}>고객번호</th>
                        <th className={thClass}>고객사</th>
                        <th className={thClass}>고객 부서</th>
                        <th className={thClass}>해지 사유</th>
                        <th className={thClass}>
                          {renderSortLabel("해지일", terminationSort.key === "terminationDate", terminationSort.dir, () => toggleTerminationSort("terminationDate"))}
                        </th>
                        <th className={`${thClass} text-right`}>위약금</th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terminationItems.map((row: any, index: number) => {
                        const editing = editingTerminationId === row.id
                        return (
                        <tr key={row.id} className={row.selected ? "bg-rose-50" : ""}>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} text-center`}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.selected)}
                              onChange={() => toggleTerminationSelected(row.id)}
                            />
                          </td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.receivedDate || ""} onChange={(e)=>updateEditingTerminationDraft("receivedDate", e.target.value)} /> : normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.manager || ""} onChange={(e)=>updateEditingTerminationDraft("manager", e.target.value)} /> : row.manager}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.customerId || ""} onChange={(e)=>updateEditingTerminationDraft("customerId", e.target.value)} /> : row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.companyName || ""} onChange={(e)=>updateEditingTerminationDraft("companyName", e.target.value)} /> : row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.departmentName || ""} onChange={(e)=>updateEditingTerminationDraft("departmentName", e.target.value)} /> : row.departmentName}</td>
                          <td className={tdClass}>
                            {editing ? (
                              <div className="space-y-2">
                                <select className="h-9 w-full min-w-[120px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.reason || "계약만료"} onChange={(e)=>updateEditingTerminationDraft("reason", e.target.value)}>
                                  {["계약만료","비용절감","사용자퇴사","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                                {editingTerminationDraft.reason === "기타" && (
                                  <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.reasonDetail || ""} onChange={(e)=>updateEditingTerminationDraft("reasonDetail", e.target.value)} placeholder="기타 사유" />
                                )}
                              </div>
                            ) : row.reason}
                          </td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.terminationDate || ""} onChange={(e)=>updateEditingTerminationDraft("terminationDate", e.target.value)} /> : normalizeDate(row.terminationDate)}</td>
                          <td className={`${tdClass} text-right tabular-nums`}>{editing ? <input className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.penalty || ""} onChange={(e)=>updateEditingTerminationDraft("penalty", e.target.value)} /> : row.penalty ? formatNumber(row.penalty) : ""}</td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleTerminationUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료</button>
                                <button type="button" onClick={() => handleDeleteTerminationRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                <button type="button" onClick={() => { setEditingTerminationId(null); setEditingTerminationDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startTerminationEdit(row)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                              >
                                수정
                              </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className={`${cardClass} overflow-hidden p-0`}>
                  <div className="border-b border-slate-200 px-4 py-3 text-[17px] font-bold text-slate-900">청구보류 리스트</div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>No.</th>
                        <th className={thClass}>
                          {renderSortLabel("접수일", holdSort.key === "receivedDate", holdSort.dir, () => toggleHoldSort("receivedDate"))}
                        </th>
                        <th className={thClass}>담당자</th>
                        <th className={thClass}>고객번호</th>
                        <th className={thClass}>고객사</th>
                        <th className={thClass}>고객 부서</th>
                        <th className={thClass}>보류 사유</th>
                        <th className={thClass}>
                          {renderSortLabel("시작일", holdSort.key === "startDate", holdSort.dir, () => toggleHoldSort("startDate"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("종료일", holdSort.key === "endDate", holdSort.dir, () => toggleHoldSort("endDate"))}
                        </th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdItems.map((row: any, index: number) => {
                        const editing = editingHoldId === row.id
                        return (
                        <tr key={row.id}>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.receivedDate || ""} onChange={(e)=>updateEditingHoldDraft("receivedDate", e.target.value)} /> : normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.manager || ""} onChange={(e)=>updateEditingHoldDraft("manager", e.target.value)} /> : row.manager}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.customerId || ""} onChange={(e)=>updateEditingHoldDraft("customerId", e.target.value)} /> : row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.companyName || ""} onChange={(e)=>updateEditingHoldDraft("companyName", e.target.value)} /> : row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.departmentName || ""} onChange={(e)=>updateEditingHoldDraft("departmentName", e.target.value)} /> : row.departmentName}</td>
                          <td className={tdClass}>{editing ? <select className="h-9 w-full min-w-[120px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.reason || "사용자퇴사"} onChange={(e)=>updateEditingHoldDraft("reason", e.target.value)}>{["사용자퇴사","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}</select> : row.reason}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.startDate || ""} onChange={(e)=>updateEditingHoldDraft("startDate", e.target.value)} /> : normalizeDate(row.startDate)}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.endDate || ""} onChange={(e)=>updateEditingHoldDraft("endDate", e.target.value)} /> : normalizeDate(row.endDate)}</td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleHoldUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료</button>
                                <button type="button" onClick={() => handleMoveHoldToTermination(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">해지이동</button>
                                <button type="button" onClick={() => handleDeleteHoldRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                <button type="button" onClick={() => { setEditingHoldId(null); setEditingHoldDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startHoldEdit(row)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                              >
                                수정
                              </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}



