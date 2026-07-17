import type { LucideIcon } from "lucide-react";
import {
  CheckSquare,
  Columns3,
  Table2,
  GitBranch,
  Calendar,
  LayoutGrid,
  BarChart3,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "My Tasks", href: "/", icon: CheckSquare },
  { label: "Board", href: "/board", icon: Columns3 },
  { label: "Table", href: "/table", icon: Table2 },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Gallery", href: "/gallery", icon: LayoutGrid },
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
];
