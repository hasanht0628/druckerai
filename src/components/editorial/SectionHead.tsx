import { cn } from "@/lib/utils";

interface SectionHeadProps {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHead({ eyebrow, title, action, className }: SectionHeadProps) {
  return (
    <div className={cn("mb-3 flex items-baseline gap-3", className)}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="section-title">{title}</h2>
      <div className="h-px flex-1 bg-border" />
      {action}
    </div>
  );
}

interface TagProps {
  children: React.ReactNode;
  kind?: "accent" | "good" | "warn" | "bad";
  className?: string;
}

export function Tag({ children, kind, className }: TagProps) {
  return (
    <span className={cn("tag", kind && `tag-${kind}`, className)}>
      {children}
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  tone?: "good" | "warn" | "bad" | "accent";
  helper?: string;
}

export function MetricCard({ label, value, tone, helper }: MetricCardProps) {
  const toneStyle =
    tone === "good"
      ? "text-good"
      : tone === "warn"
      ? "text-warn"
      : tone === "bad"
      ? "text-bad"
      : tone === "accent"
      ? "text-accent"
      : "text-ink";

  return (
    <div className="editorial-card">
      <div className="metric-label mb-2">{label}</div>
      <div className={cn("metric-num", toneStyle)}>{value}</div>
      {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
