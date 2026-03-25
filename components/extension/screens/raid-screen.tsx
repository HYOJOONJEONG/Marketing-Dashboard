"use client"

import { useState } from "react"
import { 
  Zap, Trophy, Clock, CheckCircle2, 
  ChevronRight, Users, Star, Filter, MoreVertical
} from "lucide-react"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "active" | "completed" | "upcoming"

interface Campaign {
  id: string
  title: string
  description: string
  reward: string
  participants: number
  status: "active" | "completed" | "upcoming"
  progress?: number
  timeLeft?: string
}

const campaigns: Campaign[] = [
  { id: "1", title: "Steemit Engagement Boost", description: "Like and comment on trending posts", reward: "50 STEEM", participants: 234, status: "active", progress: 65, timeLeft: "2h 30m" },
  { id: "2", title: "New DApp Launch Promo", description: "Share the announcement post", reward: "25 STEEM", participants: 156, status: "active", progress: 40, timeLeft: "5h 15m" },
  { id: "3", title: "Community AMA Event", description: "Participate in Q&A session", reward: "100 STEEM", participants: 89, status: "upcoming" },
  { id: "4", title: "Weekly Curation Challenge", description: "Curate quality content", reward: "75 STEEM", participants: 312, status: "completed" },
]

const stats = [
  { label: "Total Earned", value: "1,250", unit: "STEEM", icon: Trophy },
  { label: "Raids Joined", value: "24", unit: "", icon: Zap },
  { label: "Rank", value: "#156", unit: "", icon: Star },
]

const filters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
]

export function RaidScreen() {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all")

  const filteredCampaigns = campaigns.filter(c => activeFilter === "all" ? true : c.status === activeFilter)

  const getStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#22C55E] bg-[#22C55E]/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            Active
          </span>
        )
      case "upcoming":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            Upcoming
          </span>
        )
      case "completed":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-[#F5F7FA] px-2 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F7FA]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Hari Raid</h1>
              <p className="text-xs text-muted-foreground">Campaign Hub</p>
            </div>
          </div>
          <button className="w-9 h-9 rounded-xl bg-[#F5F7FA] flex items-center justify-center text-muted-foreground">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#F5F7FA] mb-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <stat.icon className="w-4 h-4 text-primary mb-1" />
              <span className="text-sm font-bold text-foreground">{stat.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{stat.unit}</span></span>
              <span className="text-[10px] text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeFilter === filter.id
                  ? "bg-[#1A1A2E] text-white"
                  : "bg-white text-muted-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => (
            <div key={campaign.id} className="p-3.5 rounded-2xl bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground">{campaign.title}</h3>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{campaign.description}</p>
                </div>
                <button className="text-muted-foreground">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {campaign.status === "active" && campaign.progress && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-foreground">{campaign.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F5F7FA] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70" style={{ width: `${campaign.progress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    {campaign.participants}
                  </div>
                  {campaign.timeLeft && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      {campaign.timeLeft}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-primary">{campaign.reward}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
