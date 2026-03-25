"use client"

import { useState } from "react"
import { 
  User, Shield, Key, Globe, Database, Bell, Info, AlertTriangle, Lock,
  ChevronRight, ChevronLeft, Plus, Users, RefreshCw, Trash2, Wallet,
  FileKey, Upload, Download, Timer, Eye, EyeOff, Check, X
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsScreenProps {
  onBack: () => void
  onLock: () => void
}

type SettingsView = 
  | "main" 
  | "accounts" 
  | "keys" 
  | "security" 
  | "assets" 
  | "network" 
  | "backup" 
  | "notifications" 
  | "about"

interface CategoryItem {
  id: SettingsView
  icon: React.ElementType
  label: string
  chevron?: boolean
}

const categories: CategoryItem[] = [
  { id: "accounts", icon: Users, label: "Accounts", chevron: true },
  { id: "keys", icon: Key, label: "Keys & Permissions", chevron: true },
  { id: "security", icon: Shield, label: "Security", chevron: true },
  { id: "assets", icon: Wallet, label: "Assets & Wallet", chevron: true },
  { id: "network", icon: Globe, label: "Network", chevron: true },
  { id: "backup", icon: Database, label: "Backup & Import", chevron: true },
  { id: "notifications", icon: Bell, label: "Notifications", chevron: true },
  { id: "about", icon: Info, label: "About", chevron: true },
]

const dangerItems = [
  { id: "reset", icon: Trash2, label: "Reset Wallet" },
  { id: "remove", icon: X, label: "Remove Local Data" },
  { id: "lock", icon: Lock, label: "Lock Wallet" },
]

export function SettingsScreen({ onBack, onLock }: SettingsScreenProps) {
  const [view, setView] = useState<SettingsView>("main")

  const renderHeader = (title: string, showBack: boolean = true) => (
    <div className="px-4 pt-4 pb-3 bg-[#E8F7F4] flex items-center gap-3 border-b border-[#10B3A3]/10">
      {showBack && (
        <button 
          onClick={() => setView("main")}
          className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#10B3A3] hover:bg-[#10B3A3] hover:text-white transition-colors shadow-sm"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <h1 className="text-lg font-bold text-[#1A1A2E]">{title}</h1>
    </div>
  )

  const renderListItem = (
    icon: React.ElementType,
    label: string,
    description?: string,
    chevron: boolean = false,
    danger: boolean = false,
    onClick?: () => void
  ) => {
    const Icon = icon
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 hover:bg-[#E8F7F4]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center",
            danger ? "bg-red-50" : "bg-[#E8F7F4]"
          )}>
            <Icon className={cn("w-4 h-4", danger ? "text-red-500" : "text-[#10B3A3]")} />
          </div>
          <div className="text-left">
            <p className={cn("text-sm font-medium", danger ? "text-red-500" : "text-[#1A1A2E]")}>
              {label}
            </p>
            {description && <p className="text-xs text-[#5F7471]">{description}</p>}
          </div>
        </div>
        {chevron && <ChevronRight className="w-4 h-4 text-[#10B3A3]" />}
      </button>
    )
  }

  // Main Settings Screen
  if (view === "main") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 bg-[#E8F7F4] flex items-center gap-3 border-b border-[#10B3A3]/10">
          <button 
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#10B3A3] hover:bg-[#10B3A3] hover:text-white transition-colors shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-[#1A1A2E]">Settings</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile Card */}
          <div className="p-4">
            <div 
              className="p-4 rounded-2xl flex items-center gap-4 shadow-lg"
              style={{ 
                background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
                boxShadow: "0 8px 32px rgba(16, 179, 163, 0.3)"
              }}
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold backdrop-blur-sm">
                H
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">@h4lab.user</p>
                <p className="text-white/70 text-sm">Main Account</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-colors backdrop-blur-sm">
                Manage
              </button>
            </div>
          </div>

          {/* Category List */}
          <div className="px-4 pb-2">
            <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
              {categories.map((cat) => (
                <div key={cat.id}>
                  {renderListItem(cat.icon, cat.label, undefined, cat.chevron, false, () => setView(cat.id))}
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="px-4 py-4">
            <h2 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Danger Zone</h2>
            <div className="rounded-2xl bg-white overflow-hidden border border-red-100 divide-y divide-[#F5F7FA] shadow-sm">
              {dangerItems.map((item) => (
                <div key={item.id}>
                  {renderListItem(
                    item.icon, 
                    item.label, 
                    undefined, 
                    false, 
                    true, 
                    item.id === "lock" ? onLock : undefined
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Accounts Screen
  if (view === "accounts") {
    const accounts = [
      { name: "h4lab.user", type: "Main", active: true },
      { name: "h4lab.dev", type: "Developer", active: false },
    ]
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Accounts")}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide mb-2">Account List</h2>
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {accounts.map((acc) => (
              <div key={acc.name} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {acc.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E]">@{acc.name}</p>
                    <p className="text-xs text-[#5F7471]">{acc.type}</p>
                  </div>
                </div>
                {acc.active && (
                  <div className="w-6 h-6 rounded-full bg-[#10B3A3]/10 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-[#10B3A3]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="p-3 rounded-xl bg-white text-sm font-medium text-[#10B3A3] flex items-center justify-center gap-2 hover:bg-[#10B3A3] hover:text-white transition-colors shadow-sm border border-[#10B3A3]/20">
              <Plus className="w-4 h-4" /> Add Account
            </button>
            <button className="p-3 rounded-xl bg-white text-sm font-medium text-[#10B3A3] flex items-center justify-center gap-2 hover:bg-[#10B3A3] hover:text-white transition-colors shadow-sm border border-[#10B3A3]/20">
              <RefreshCw className="w-4 h-4" /> Switch
            </button>
          </div>

          <button className="w-full mt-3 p-3 rounded-xl bg-red-50 text-sm font-medium text-red-500 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
            <Trash2 className="w-4 h-4" /> Remove Account
          </button>
        </div>
      </div>
    )
  }

  // Keys & Permissions Screen
  if (view === "keys") {
    const keys = [
      { name: "Posting Key", desc: "For social actions", icon: Key },
      { name: "Active Key", desc: "For transfers", icon: Key },
      { name: "Memo Key", desc: "For encrypted memos", icon: FileKey },
    ]
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Keys & Permissions")}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide mb-2">Key Management</h2>
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {keys.map((key) => (
              <div key={key.name}>
                {renderListItem(key.icon, key.name, key.desc, true)}
              </div>
            ))}
          </div>

          <h2 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide mb-2 mt-4">Permissions</h2>
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {renderListItem(Globe, "Authorized Websites", "3 sites", true)}
            {renderListItem(Shield, "Approved Operations", "5 ops", true)}
          </div>
        </div>
      </div>
    )
  }

  // Security Screen
  if (view === "security") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Security")}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {renderListItem(Timer, "Auto Lock Timer", "5 minutes", true)}
            {renderListItem(Key, "Change Password", undefined, true)}
            {renderListItem(Lock, "Session Lock", "Enabled", true)}
            {renderListItem(Shield, "Device Security", "Biometric off", true)}
          </div>
        </div>
      </div>
    )
  }

  // Assets & Wallet Screen
  if (view === "assets") {
    const assets = [
      { symbol: "STEEM", visible: true },
      { symbol: "SBD", visible: true },
      { symbol: "SP", visible: true },
      { symbol: "HARI POINT", visible: true },
    ]
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Assets & Wallet")}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide mb-2">Asset Preferences</h2>
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {assets.map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F7F4] flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-[#10B3A3]" />
                  </div>
                  <span className="text-sm font-medium text-[#1A1A2E]">{asset.symbol}</span>
                </div>
                <button className="text-[#10B3A3]">
                  {asset.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>

          <h2 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide mb-2 mt-4">Display Order</h2>
          <div className="rounded-2xl bg-white overflow-hidden shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {renderListItem(RefreshCw, "Default Asset Order", "Drag to reorder", true)}
          </div>
        </div>
      </div>
    )
  }

  // Network Screen
  if (view === "network") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Network")}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {renderListItem(Globe, "Network Selection", "Steem Mainnet", true)}
            {renderListItem(Database, "RPC / Node Selection", "api.steemit.com", true)}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#10B3A3]/10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B3A3]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">Connection Status</p>
                  <p className="text-xs text-[#10B3A3]">Connected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Backup & Import Screen
  if (view === "backup") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Backup & Import")}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {renderListItem(Upload, "Export Keys", "Backup your keys", true)}
            {renderListItem(Download, "Import Wallet", "Restore from backup", true)}
            {renderListItem(Database, "Import Settings", "Load config", true)}
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-[#10B3A3]/10 border border-[#10B3A3]/20">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-[#10B3A3]" />
              <span className="text-sm font-medium text-[#1A1A2E]">Backup Status</span>
            </div>
            <p className="text-xs text-[#5F7471]">Last backup: March 10, 2026</p>
          </div>
        </div>
      </div>
    )
  }

  // Notifications Screen
  if (view === "notifications") {
    const notifications = [
      { name: "Transaction Alerts", enabled: true },
      { name: "Feed Notifications", enabled: true },
      { name: "Hari Raid Updates", enabled: false },
      { name: "Hari AI Notifications", enabled: true },
    ]
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("Notifications")}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {notifications.map((notif) => (
              <div key={notif.name} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F7F4] flex items-center justify-center">
                    <Bell className="w-4 h-4 text-[#10B3A3]" />
                  </div>
                  <span className="text-sm font-medium text-[#1A1A2E]">{notif.name}</span>
                </div>
                <div className={cn(
                  "w-11 h-6 rounded-full p-0.5 transition-colors",
                  notif.enabled ? "bg-[#10B3A3]" : "bg-[#E5E7EB]"
                )}>
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-white shadow transition-transform",
                    notif.enabled && "translate-x-5"
                  )} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // About Screen
  if (view === "about") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#E8F7F4]">
        {renderHeader("About")}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Logo & Version */}
          <div className="flex flex-col items-center py-6">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg"
              style={{ 
                background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
                boxShadow: "0 8px 32px rgba(16, 179, 163, 0.3)"
              }}
            >
              H4
            </div>
            <p className="text-lg font-bold text-[#1A1A2E]">H4LAB Steem Keychain</p>
            <p className="text-sm text-[#5F7471]">Version 1.0.0</p>
          </div>

          <div className="rounded-2xl bg-white overflow-hidden divide-y divide-[#E8F7F4] shadow-sm" style={{ boxShadow: "0 2px 12px rgba(16, 179, 163, 0.08)" }}>
            {renderListItem(Info, "Terms of Service", undefined, true)}
            {renderListItem(Shield, "Privacy Policy", undefined, true)}
            {renderListItem(Users, "Help / Support", undefined, true)}
          </div>

          <p className="text-center text-xs text-[#5F7471] mt-6">
            Built with care by H4LAB
          </p>
        </div>
      </div>
    )
  }

  return null
}
