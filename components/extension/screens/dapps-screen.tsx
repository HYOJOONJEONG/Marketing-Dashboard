"use client"

import { useState } from "react"
import { Search, Sparkles, Zap, TrendingUp, Gamepad2, Star, BarChart3, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface DApp {
  id: string
  name: string
  description: string
  icon: React.ElementType
  category: string
  isFeatured?: boolean
  isNew?: boolean
  iconBg: string
}

const featuredApps: DApp[] = [
  {
    id: "hari-ai",
    name: "Hari AI",
    description: "AI-powered assistant for Steem",
    icon: Sparkles,
    category: "AI",
    isFeatured: true,
    isNew: true,
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
  },
  {
    id: "hari-raid",
    name: "Hari Raid",
    description: "Community engagement tool",
    icon: Zap,
    category: "Social",
    isFeatured: true,
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
  },
]

const allApps: DApp[] = [
  {
    id: "steemit",
    name: "Steemit",
    description: "Social blogging platform",
    icon: TrendingUp,
    category: "Social",
    iconBg: "bg-gradient-to-br from-teal-400 to-teal-500",
  },
  {
    id: "splinterlands",
    name: "Splinterlands",
    description: "Play-to-earn card game",
    icon: Gamepad2,
    category: "Gaming",
    iconBg: "bg-gradient-to-br from-red-400 to-red-500",
  },
  {
    id: "steemmonsters",
    name: "Steem Monsters",
    description: "NFT collectibles",
    icon: Star,
    category: "NFT",
    iconBg: "bg-gradient-to-br from-yellow-400 to-yellow-500",
  },
  {
    id: "peakd",
    name: "PeakD",
    description: "Advanced Steem interface",
    icon: BarChart3,
    category: "Social",
    iconBg: "bg-gradient-to-br from-blue-400 to-blue-500",
  },
]

const categories = ["All", "AI", "Social", "Gaming", "NFT", "DeFi"]

export function DAppsScreen() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")

  const filteredApps = allApps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === "All" || app.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-2xl font-semibold text-foreground mb-4">DApps</h1>
        
        {/* Search */}
        <div 
          className="relative mb-4 rounded-2xl bg-card overflow-hidden"
          style={{
            boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            placeholder="Search DApps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-12 py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeCategory === cat
                  ? "bg-foreground text-background shadow-md"
                  : "bg-card text-muted-foreground shadow-sm"
              )}
              style={{
                boxShadow: activeCategory === cat 
                  ? "0 2px 8px rgba(0,0,0,0.15)"
                  : "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {/* Featured Section */}
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">FEATURED</h2>
          <div className="grid grid-cols-2 gap-3">
            {featuredApps.map((app) => {
              const Icon = app.icon
              return (
                <div
                  key={app.id}
                  className="p-4 rounded-2xl bg-card cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", app.iconBg)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {app.isNew && (
                      <span className="text-[10px] font-semibold text-[#22C55E] bg-[#22C55E]/10 px-2 py-1 rounded-full">
                        NEW
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-0.5">{app.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{app.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* All Apps */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">ALL APPS</h2>
          <div className="space-y-3">
            {filteredApps.map((app) => {
              const Icon = app.icon
              return (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-card cursor-pointer hover:scale-[1.01] transition-transform"
                  style={{
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", app.iconBg)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-foreground">{app.name}</p>
                      <p className="text-xs text-muted-foreground">{app.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      {app.category}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
