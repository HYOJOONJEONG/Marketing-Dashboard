"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  CalendarCheck,
  PenLine,
  CheckCircle,
  FileOutput,
  Settings,
} from "lucide-react";

const menuItems = [
  {
    title: "대시보드",
    description: "이번 주 KPI와 검증 현황",
    href: "#",
    icon: LayoutDashboard,
    active: true,
  },
  {
    title: "신규 계약 원장",
    description: "계약 등록, 수정, 필터 조회",
    href: "#",
    icon: FileText,
    active: false,
  },
  {
    title: "주간 반영 관리",
    description: "이번 주 반영 대상 확정",
    href: "#",
    icon: CalendarCheck,
    active: false,
  },
  {
    title: "주간 보고 입력",
    description: "매출, 옵션, 해지, 목표 입력",
    href: "#",
    icon: PenLine,
    active: false,
  },
  {
    title: "검증 센터",
    description: "불일치와 누락 자동 점검",
    href: "#",
    icon: CheckCircle,
    active: false,
  },
  {
    title: "보고서 / PDF",
    description: "최종 보고서와 PDF 출력",
    href: "#",
    icon: FileOutput,
    active: false,
  },
  {
    title: "기준정보 관리",
    description: "권유자, 업종, 옵션 코드 관리",
    href: "#",
    icon: Settings,
    active: false,
  },
];

export function Sidebar() {
  return (
    <aside className="w-[280px] min-h-screen p-5 bg-card/80 border-r border-border backdrop-blur-sm">
      <div className="p-5 border border-border rounded-[22px] bg-gradient-to-br from-[#fffaf3] to-[#f4e6d3] shadow-lg">
        <span className="block text-xs text-muted-foreground tracking-wider uppercase mb-2">
          INFOMAX MARKETING HQ
        </span>
        <h1 className="text-xl font-bold leading-tight text-foreground">
          정보사업본부
          <br />
          주간실적 대시보드
        </h1>
      </div>

      <nav className="mt-6 flex flex-col gap-2">
        {menuItems.map((item) => (
          <a
            key={item.title}
            href={item.href}
            className={cn(
              "block p-4 rounded-2xl border transition-all duration-200",
              item.active
                ? "bg-secondary border-border font-bold"
                : "border-transparent hover:bg-secondary/50 hover:border-border/50"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-foreground">{item.title}</span>
            </div>
            <span className="block mt-1 ml-8 text-xs text-muted-foreground">
              {item.description}
            </span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
