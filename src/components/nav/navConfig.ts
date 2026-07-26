import type { Icon } from "@phosphor-icons/react";
import {
  Calendar,
  Plus,
  Microphone,
  Clock,
  Pulse,
  User,
} from "@phosphor-icons/react";

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Today", icon: Calendar },
  { to: "/add", label: "Add", icon: Plus },
  { to: "/voice", label: "Voice", icon: Microphone },
  { to: "/history", label: "History", icon: Clock },
  { to: "/summary", label: "Summary", icon: Pulse },
  { to: "/profile", label: "Profile", icon: User },
];
