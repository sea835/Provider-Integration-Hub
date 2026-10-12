import type { Icon as IconType } from "@phosphor-icons/react";
import {
  ClockCounterClockwise,
  PaperPlaneTilt,
  PlugsConnected,
  ShieldCheck,
  SquaresFour,
  Users,
} from "@phosphor-icons/react/ssr";
import type { Route } from "next";
import { POLICIES, type Policy } from "@/lib/auth/policies";

export interface NavItem {
  href: Route;
  label: string;
  icon: IconType;
  policy?: Policy;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/", label: "Bảng điều khiển", icon: SquaresFour }],
  },
  {
    title: "Giám sát số dư",
    items: [
      { href: "/providers", label: "Đối tác", icon: PlugsConnected, policy: POLICIES.providers.view },
      {
        href: "/history",
        label: "Lịch sử kiểm tra",
        icon: ClockCounterClockwise,
        policy: POLICIES.balanceChecks.view,
      },
      {
        href: "/notifications",
        label: "Kênh thông báo",
        icon: PaperPlaneTilt,
        policy: POLICIES.alertChannels.view,
      },
    ],
  },
  {
    title: "Quản trị",
    items: [
      { href: "/users", label: "Người dùng", icon: Users, policy: POLICIES.users.view },
      { href: "/access", label: "Phân quyền", icon: ShieldCheck, policy: POLICIES.access.manage },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
