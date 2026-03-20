import { cn } from "@/lib/utils";

interface ValidationItemProps {
  title: string;
  description: string;
  status: "pass" | "fail" | "warn";
}

export function ValidationItem({ title, description, status }: ValidationItemProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card/80">
      <div className="flex-1">
        <div className="font-semibold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground mt-1">{description}</div>
      </div>
      <span
        className={cn(
          "min-w-[64px] text-center px-3 py-2 rounded-full text-xs font-bold text-card-foreground",
          status === "pass" && "bg-success text-success-foreground",
          status === "fail" && "bg-destructive text-destructive-foreground",
          status === "warn" && "bg-warning text-warning-foreground"
        )}
      >
        {status === "pass" && "PASS"}
        {status === "fail" && "FAIL"}
        {status === "warn" && "WARN"}
      </span>
    </div>
  );
}
