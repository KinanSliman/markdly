import { ReactNode } from "react";
import { DashboardNav } from "./dashboard-nav";
import { UserMenu } from "./user-menu";

interface DashboardShellProps {
  children: ReactNode;
}

export async function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl">Markdly</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 hidden md:block">
          <DashboardNav />
        </aside>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
