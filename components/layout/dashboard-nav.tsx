import Link from "next/link";
import { Home, Settings, GitBranch, FileText, BarChart3, Cog, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Home,
  },
  {
    href: "/dashboard/syncs",
    label: "Sync History",
    icon: GitBranch,
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    icon: FileText,
  },
  {
    href: "/settings/sync-configs",
    label: "Sync Configs",
    icon: Cog,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export async function DashboardNav() {
  const admin = await isAdmin();

  const adminNavItems = admin
    ? [
        {
          href: "/admin",
          label: "Admin",
          icon: ShieldCheck,
        },
      ]
    : [];

  const allNavItems = [...navItems, ...adminNavItems];

  return (
    <nav className="space-y-2">
      {allNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
