import type { Icon } from "@phosphor-icons/react";
import {
  HouseLine,
  PlusCircle,
  Microphone,
  ClockCounterClockwise,
  ChartBar,
  UserCircle,
} from "@phosphor-icons/react";

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Today", icon: HouseLine },
  { to: "/add", label: "Add", icon: PlusCircle },
  { to: "/voice", label: "Voice", icon: Microphone },
  { to: "/history", label: "History", icon: ClockCounterClockwise },
  { to: "/summary", label: "Summary", icon: ChartBar },
  { to: "/profile", label: "Profile", icon: UserCircle },
];
