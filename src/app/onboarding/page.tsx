import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/editorial/SectionHead";

const steps = [
  ["Connect data sources", "Calendar, notes, and documents give Drucker the evidence it needs.", "Begin →"],
  ["Tell us what matters", "Add projects, goals, hard deadlines, and active constraints.", "Add context"],
  ["How do you decide?", "Write the principles that should shape recommendations.", "Define"],
  ["Who is a meeting for?", "Name the people whose trust and cadence matter.", "Add people"],
  ["Pick a coaching tone", "Choose subtle, classic, operator, or reflective coaching.", "Later"],
] as const;

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <section>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Setup · 8 minutes
          </p>
          <h1 className="text-display mb-4 max-w-[20ch]">The chief of staff you wish you had.</h1>
          <p className="precept">
            Drucker needs a small amount of judgment from you before it can protect your time and attention.
          </p>
        </section>

        <div className="rounded-lg border border-border bg-paper px-5">
          {steps.map(([title, body, action], index) => (
            <div key={title} className="flex gap-4 border-b border-border py-5 last:border-b-0">
              <div className="w-10 shrink-0 font-serif text-[40px] italic leading-none text-ink-4">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="flex-1">
                <h2 className="font-serif text-2xl leading-tight">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
              <div className="hidden items-start sm:flex">
                {index === 0 ? (
                  <Button asChild size="sm">
                    <Link href="/auth/login">{action}</Link>
                  </Button>
                ) : index < 4 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/context">{action}</Link>
                  </Button>
                ) : (
                  <Tag>— —</Tag>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button asChild variant="outline">
          <Link href="/dashboard">Skip to brief</Link>
        </Button>
      </div>
    </main>
  );
}
