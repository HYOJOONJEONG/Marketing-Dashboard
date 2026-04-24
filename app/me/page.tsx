import path from "path"
import { redirect } from "next/navigation"
import { requirePageAuth } from "@/lib/auth/server"
import { readDashboardState } from "@/lib/shared-db-store"
import { getUserColorToken } from "@/lib/auth/model"
import { PersonalDashboard } from "@/components/me/personal-dashboard"
import { buildPersonalDashboardData } from "@/lib/personal-dashboard"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export default async function MyPage() {
  const auth = await requirePageAuth()
  if (!auth) redirect("/")

  const dashboard =
    (await readDashboardState<any>(DATA_PATH)) ||
    (await readDashboardState<any>(FALLBACK_PATH)) || { contracts: [], collection: {}, termination: {} }

  const personalData = buildPersonalDashboardData(auth.user, dashboard)

  return (
    <PersonalDashboard
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.title || auth.user.role,
        teamName: auth.teamName,
        color: getUserColorToken(auth.user.id),
        assignedIndustries: auth.user.assignedIndustries || [],
      }}
      data={personalData}
    />
  )
}
