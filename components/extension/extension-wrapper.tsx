"use client"

import { cn } from "@/lib/utils"

interface ExtensionWrapperProps {
  children: React.ReactNode
  className?: string
  showInContainer?: boolean
}

export function ExtensionWrapper({ children, className, showInContainer = true }: ExtensionWrapperProps) {
  const content = (
    <div
      className={cn(
        "w-[375px] h-[700px] bg-background rounded-[40px] overflow-hidden flex flex-col",
        className
      )}
      style={{
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
      }}
    >
      {children}
    </div>
  )

  if (!showInContainer) {
    return content
  }

  return (
    <div className="flex items-center justify-center">
      {content}
    </div>
  )
}
