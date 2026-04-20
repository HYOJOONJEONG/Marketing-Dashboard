import { useEffect, useMemo, useState } from "react"

export type OptionCategory = {
  category_code: string
  category_name_ko: string
  display_order: number
  count_value?: number
}

export type OptionRecord = {
  record_id?: string
  category_code: string
  category_name_ko: string
  sub_type: string
  industry?: string
  company_name: string
  user_id: string
  department: string
  requester_name: string
  contact?: string
  request_date?: string
  real_apply?: string
  billing_month: string
  status: string
  agreement?: string
  customer_type?: string
  tr_cd?: string
  dedicated?: string
  quantity?: string
  recommender?: string
  receiver?: string
  apply_count?: string
  apply_ids?: string
  amount?: string
  note: string
  is_active: number
}

export type OptionDashboardResponse = {
  source: string
  basis: string
  date: string
  categories: OptionCategory[]
  cards: OptionCategory[]
  historyDates: string[]
  records: OptionRecord[]
}

type Params = {
  basis: "seed" | "latest" | "date"
  date?: string
  category?: string
  search?: string
  refreshKey?: number
}

const CACHE_TTL_MS = 30 * 1000
const responseCache = new Map<string, { timestamp: number; data: OptionDashboardResponse }>()

function buildQuery(params: Params) {
  const searchParams = new URLSearchParams()
  searchParams.set("basis", params.basis)
  if (params.date) searchParams.set("date", params.date)
  if (params.category && params.category !== "all") searchParams.set("category", params.category)
  if (params.search) searchParams.set("search", params.search)
  return searchParams.toString()
}

export function useOptionDashboardData(params: Params) {
  const [data, setData] = useState<OptionDashboardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => buildQuery(params), [params])

  useEffect(() => {
    let mounted = true
    const cached = responseCache.get(query)
    const isFreshCache = cached && Date.now() - cached.timestamp < CACHE_TTL_MS
    if (isFreshCache) {
      setData(cached.data)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const controller = new AbortController()
    fetch(`/api/options?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `옵션 데이터를 불러오지 못했습니다. (${res.status})`)
        }
        return res.json()
      })
      .then((json) => {
        if (!mounted) return
        responseCache.set(query, { timestamp: Date.now(), data: json })
        setData(json)
      })
      .catch((err) => {
        if (!mounted) return
        if (err?.name === "AbortError") return
        setError(err?.message || "데이터를 불러오지 못했습니다.")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
      controller.abort()
    }
  }, [query, params.refreshKey])

  return { data, loading, error }
}
