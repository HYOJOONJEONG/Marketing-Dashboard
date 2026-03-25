"use client"

import { Sparkles, Globe, Wallet, Rss } from "lucide-react"
import { cn } from "@/lib/utils"

export type TabId = "home" | "raid" | "feed" | "ai" | "browser"

interface BottomTabsProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

// Game Icon - Game controller shape
function GameIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {/* Controller body */}
      <rect x="2" y="6" width="20" height="12" rx="4" />
      {/* D-pad */}
      <path d="M6 12h4" />
      <path d="M8 10v4" />
      {/* Buttons */}
      <circle cx="17" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

// Order: Wallet, AI, Steemit (center), Game, Browser
const tabs = [
  { id: "home" as const, label: "Wallet", icon: Wallet },
  { id: "ai" as const, label: "AI", icon: Sparkles },
  { id: "feed" as const, label: "Steemit", icon: Rss, isCenter: true },
  { id: "raid" as const, label: "Game", icon: GameIcon },
  { id: "browser" as const, label: "Browser", icon: Globe },
]

export function BottomTabs({ activeTab, onTabChange }: BottomTabsProps) {
  return (
    <div 
      className="flex items-center justify-around px-2 py-2.5 bg-white border-t border-[#E0EEEB]"
      style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.04)" }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const isCenter = tab.isCenter
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl transition-all",
              isCenter ? "px-3 py-1" : "px-2 py-1",
              isActive ? "text-[#10B3A3]" : "text-[#7C8F8C] hover:text-[#1F2A2A]"
            )}
          >
            <div className={cn(
              "flex items-center justify-center transition-all",
              isCenter ? "w-10 h-10 rounded-2xl" : "w-8 h-8 rounded-xl",
              isActive && isCenter && "bg-[#10B3A3] text-white shadow-md",
              isActive && !isCenter && "bg-[#10B3A3]/10",
              !isActive && isCenter && "bg-[#F3FAF8]"
            )}
            style={isActive && isCenter ? { boxShadow: "0 4px 12px rgba(16, 179, 163, 0.4)" } : {}}
            >
              <Icon className={cn(
                "transition-all",
                isCenter ? "w-5 h-5" : "w-[18px] h-[18px]"
              )} />
            </div>
            <span className={cn(
              "font-medium",
              isCenter ? "text-[10px]" : "text-[9px]",
              isActive && "font-semibold"
            )}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
