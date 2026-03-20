import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  subText: string;
  trend?: "positive" | "negative" | "neutral";
}

export function KpiCard({ label, value, subText, trend = "neutral" }: KpiCardProps) {
  return (
    <div className="bg-card/95 border border-border rounded-[22px] p-5 shadow-lg">
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
      <div
        className={cn(
          "mt-2 text-sm",
          trend === "positive" && "text-success",
          trend === "negative" && "text-destructive",
          trend === "neutral" && "text-muted-foreground"
        )}
      >
        {subText}
      </div>
    </div>
  );
}
