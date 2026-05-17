import { redirect } from "next/navigation"

import { requireAnyPagePermission } from "@/lib/auth/server"
import { ADMIN_CONSOLE_ACCESS_KEYS } from "@/lib/auth/model"

export default async function AdminPage() {
  const auth = await requireAnyPagePermission(ADMIN_CONSOLE_ACCESS_KEYS, "view")
  if (!auth) redirect("/")

  redirect("/?view=admin-page")
}
