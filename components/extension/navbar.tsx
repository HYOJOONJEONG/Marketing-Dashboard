"use client"

import { Settings, ChevronDown, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NavbarProps {
  username: string
  onSettingsClick?: () => void
}

export function Navbar({ username, onSettingsClick }: NavbarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/H4LAB_logo%28%EB%B0%B0%EA%B2%BDx%29-cLLp6bwyE1Rl7L13pSahrS4rYHsAM7.png"
          alt="H4LAB"
          className="h-7 w-auto"
        />
        <span className="text-sm font-semibold text-foreground">Keychain</span>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground">
              <span className="font-medium text-foreground">@{username}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Address
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View on Explorer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              Switch Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onSettingsClick}
        >
          <Settings className="h-4.5 w-4.5" />
        </Button>
      </div>
    </header>
  )
}
