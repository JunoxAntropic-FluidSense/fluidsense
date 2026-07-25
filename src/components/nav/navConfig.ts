export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Today", icon: "🏠" },
  { to: "/add", label: "Add", icon: "➕" },
  { to: "/voice", label: "Voice", icon: "🎙️" },
  { to: "/history", label: "History", icon: "📋" },
  { to: "/summary", label: "Summary", icon: "📊" },
  { to: "/profile", label: "Profile", icon: "👤" },
];
