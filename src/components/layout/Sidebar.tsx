"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Layers,
  Users,
  FileText,
  BookOpen,
  Mail,
  MessageSquare,
  Gauge,
  Flame,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isNew?: boolean;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Today",
    items: [
      { href: "/dashboard", label: "Brief", icon: LayoutDashboard },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Inputs",
    items: [
      { href: "/dashboard/notes", label: "Notes", icon: FileText },
      { href: "/dashboard/email", label: "Email", icon: Mail, isNew: true },
      { href: "/dashboard/collaborators", label: "Collaborators", icon: Users },
      { href: "/dashboard/context", label: "Context", icon: Layers },
      { href: "/dashboard/documents", label: "Documents", icon: BookOpen },
    ],
  },
  {
    label: "Coaching",
    items: [
      { href: "/dashboard/coach", label: "Coach", icon: MessageSquare, isNew: true },
      { href: "/dashboard/decisions", label: "Decisions Journal", icon: Gauge, isNew: true },
      { href: "/dashboard/energy", label: "Energy Map", icon: Flame, isNew: true },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/onboarding", label: "Onboarding", icon: Settings, isNew: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 lg:w-60 shrink-0 border-r border-border bg-paper-2 flex flex-col h-screen sticky top-0 px-2 lg:px-3 py-5 gap-5 overflow-y-auto">
      <div className="flex items-baseline justify-center lg:justify-start gap-2 px-2 lg:px-3">
        <span className="font-serif text-[22px] lg:text-[28px] italic leading-none tracking-[-0.02em] text-foreground">
          Drucker
        </span>
        <span className="hidden lg:inline font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          v0.4
        </span>
      </div>

      <nav className="flex-1 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="hidden lg:block px-3 pb-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-4">
              {group.label}
            </div>
            {group.items.map(({ href, label, icon: Icon, isNew }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  title={label}
                  className={cn(
                    "relative flex items-center justify-center lg:justify-start gap-2.5 rounded-md px-0 lg:px-3 py-2 text-[13.5px] font-medium text-ink-2 transition-colors",
                    "hover:bg-paper-3 hover:text-foreground",
                    isActive && "bg-paper-3 text-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-r before:bg-accent"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 text-ink-3", isActive && "text-accent")} />
                  <span className="hidden lg:inline truncate">{label}</span>
                  {isNew && (
                    <span className="hidden lg:inline ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                      NEW
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto hidden px-3 py-2 lg:block">
        <p className="text-xs text-muted-foreground">Focus on contribution.</p>
      </div>
    </aside>
  );
}
