import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <div className={cn("bg-card/95 border border-border rounded-3xl p-5 shadow-lg", className)}>
      <h4 className="text-lg font-semibold mb-4 text-foreground">{title}</h4>
      {children}
    </div>
  );
}
