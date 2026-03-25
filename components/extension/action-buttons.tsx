"use client"

import { ArrowUpRight, ArrowDownLeft, RefreshCw, History } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
}

function ActionButton({ icon, label, onClick, className }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
        "hover:bg-accent active:scale-95",
        className
      )}
    >
      <div className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center text-primary">
        {icon}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}

interface ActionButtonsProps {
  onSend?: () => void
  onReceive?: () => void
  onSwap?: () => void
  onHistory?: () => void
}

export function ActionButtons({ onSend, onReceive, onSwap, onHistory }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-6 px-4 py-4">
      <ActionButton 
        icon={<ArrowUpRight className="h-5 w-5" />} 
        label="Send" 
        onClick={onSend}
      />
      <ActionButton 
        icon={<ArrowDownLeft className="h-5 w-5" />} 
        label="Receive" 
        onClick={onReceive}
      />
      <ActionButton 
        icon={<RefreshCw className="h-5 w-5" />} 
        label="Swap" 
        onClick={onSwap}
      />
      <ActionButton 
        icon={<History className="h-5 w-5" />} 
        label="History" 
        onClick={onHistory}
      />
    </div>
  )
}
