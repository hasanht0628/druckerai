import { format } from "date-fns";

interface HeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, eyebrow, actions }: HeaderProps) {
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="sticky top-0 z-10 min-h-16 border-b border-border bg-background/95 px-6 py-3 backdrop-blur shrink-0 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow ?? description ?? today}
        </p>
        <h1 className="font-serif text-2xl leading-none tracking-[-0.01em] text-foreground">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
          {today}
        </span>
      </div>
    </div>
  );
}
