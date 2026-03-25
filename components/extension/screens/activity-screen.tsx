"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface Activity {
  id: string
  name: string
  date: string
  amount: string
  type: "incoming" | "outgoing"
  icon: string
  iconBg: string
}

const mockActivities: Activity[] = [
  {
    id: "1",
    name: "steemit",
    date: "April 7",
    amount: "+ $ 2 049.00",
    type: "incoming",
    icon: "S",
    iconBg: "bg-gradient-to-br from-orange-400 to-orange-500",
  },
  {
    id: "2",
    name: "binance",
    date: "April 5",
    amount: "$ 50.00",
    type: "outgoing",
    icon: "B",
    iconBg: "bg-gradient-to-br from-yellow-400 to-yellow-500",
  },
  {
    id: "3",
    name: "upbit",
    date: "April 3",
    amount: "+ $ 125.50",
    type: "incoming",
    icon: "U",
    iconBg: "bg-gradient-to-br from-blue-400 to-blue-500",
  },
  {
    id: "4",
    name: "curators",
    date: "April 1",
    amount: "$ 1 000.00",
    type: "outgoing",
    icon: "C",
    iconBg: "bg-gradient-to-br from-purple-400 to-purple-500",
  },
  {
    id: "5",
    name: "rewards",
    date: "March 28",
    amount: "+ $ 89.25",
    type: "incoming",
    icon: "R",
    iconBg: "bg-gradient-to-br from-teal-400 to-teal-500",
  },
]

const filters = ["All", "Incoming", "Outgoing"]

export function ActivityScreen() {
  const [activeFilter, setActiveFilter] = useState("All")

  const filteredActivities = mockActivities.filter((activity) => {
    if (activeFilter === "All") return true
    if (activeFilter === "Incoming") return activity.type === "incoming"
    if (activeFilter === "Outgoing") return activity.type === "outgoing"
    return true
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <h1 className="text-2xl font-semibold text-foreground mb-4">Activity</h1>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeFilter === filter
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-card text-muted-foreground shadow-sm"
              )}
              style={{
                boxShadow: activeFilter === filter 
                  ? "0 2px 8px rgba(0,0,0,0.15)"
                  : "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-card"
              style={{
                border: "1px dashed #E0E4EA",
              }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-white font-medium",
                  activity.iconBg
                )}>
                  <span className="text-lg">{activity.icon}</span>
                </div>
                <div>
                  <p className="text-base font-medium text-foreground">{activity.name}</p>
                  <p className="text-sm text-muted-foreground">{activity.date}</p>
                </div>
              </div>
              <span className={cn(
                "text-base font-semibold",
                activity.type === "incoming" ? "text-[#22C55E]" : "text-foreground"
              )}>
                {activity.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
