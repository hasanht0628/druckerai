import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/editorial/SectionHead";

export default function DecisionsPage() {
  return (
    <>
      <Header
        title="Decisions Journal"
        eyebrow="Coaching · Prediction and calibration"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Import from notes</Button>
            <Button size="sm">Log a decision</Button>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto">
        <div className="view view-narrow space-y-6">
          <p className="precept">
            Good judgment compounds when you write down what you expected before the outcome arrives.
          </p>

          <div className="editorial-card border-dashed">
            <p className="metric-label">Calibration</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Calibration will appear after real decisions and outcomes are logged.
            </p>
          </div>

          <section>
            <SectionHead eyebrow="01" title="Decision log" />
            <div className="editorial-card border-dashed">
              <p className="text-sm text-muted-foreground">
                No decisions logged yet. Use “Log a decision” once persistence is connected.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
