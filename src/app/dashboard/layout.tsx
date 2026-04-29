import { Sidebar } from "@/components/layout/Sidebar";
import { AgentPanel } from "@/components/agent/AgentPanel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
      <AgentPanel />
    </div>
  );
}
