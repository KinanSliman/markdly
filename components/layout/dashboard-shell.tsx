import { ReactNode } from "react";
import Link from "next/link";
import { DashboardNav } from "./dashboard-nav";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { isAdmin } from "@/lib/auth/admin";
import { adminNavItem, baseNavItems, type NavItem } from "./nav-items";

interface DashboardShellProps {
  children: ReactNode;
}

export async function DashboardShell({ children }: DashboardShellProps) {
  const admin = await isAdmin();
  const items: NavItem[] = admin ? [...baseNavItems, adminNavItem] : baseNavItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNav items={items} />
            <Link href="/dashboard" className="font-bold text-lg sm:text-xl truncate">
              Markdly
            </Link>
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex gap-6 lg:gap-8">
        {/* Sidebar (desktop only) */}
        <aside className="w-56 lg:w-64 hidden md:block shrink-0">
          <DashboardNav items={items} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
