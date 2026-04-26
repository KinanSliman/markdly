import {
  Home,
  Settings,
  GitBranch,
  FileText,
  BarChart3,
  Cog,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const baseNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/syncs", label: "Sync History", icon: GitBranch },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/settings/sync-configs", label: "Sync Configs", icon: Cog },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const adminNavItem: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
};
