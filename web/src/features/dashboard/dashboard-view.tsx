"use client";

import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { PageBanner, type BannerStat } from "@/components/layout/page-banner";
import { Button } from "@/components/ui/button";
import { usePermissions, useRoles } from "@/features/access/hooks";
import { usePermission, useSession } from "@/features/auth/session-provider";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { roleMeta } from "@/features/users/constants";
import { useUsers } from "@/features/users/hooks";
import { POLICIES } from "@/lib/auth/policies";
import { formatNumber } from "@/lib/format";
import { displayName, greetingFor, longDate } from "./greeting";
import { HealthCard } from "./health-card";
import { MyPermissionsCard } from "./my-permissions-card";
import { RecentUsersCard } from "./recent-users-card";
import { RoleDistributionCard } from "./role-distribution-card";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function DashboardView() {
  const { user } = useSession();
  const canViewUsers = usePermission(POLICIES.users.view);
  const canManageAccess = usePermission(POLICIES.access.manage);

  const health = useHealth();
  const users = useUsers(canViewUsers);
  const roles = useRoles(canManageAccess);
  const permissions = usePermissions(canManageAccess);

  const now = new Date();
  const role = roleMeta(user.role);
  const healthCopy = health.data ? HEALTH_COPY[health.data.level] : null;
  const newThisWeek = (users.data ?? []).filter(
    (item) => now.getTime() - new Date(item.createdAt).getTime() < WEEK_MS,
  ).length;

  const summary = [
    healthCopy ? `Hệ thống ${healthCopy.label.toLowerCase()}.` : "Đang kiểm tra hệ thống.",
    canViewUsers && users.data ? `Có ${formatNumber(newThisWeek)} tài khoản mới trong 7 ngày qua.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const stats: BannerStat[] = [];
  if (canViewUsers) stats.push({ label: "Người dùng", value: users.data ? formatNumber(users.data.length) : "-" });
  if (canManageAccess) {
    stats.push({ label: "Vai trò", value: roles.data ? formatNumber(roles.data.length) : "-" });
    stats.push({ label: "Quyền hạn", value: permissions.data ? formatNumber(permissions.data.length) : "-" });
  }

  return (
    <div className="space-y-7">
      <PageBanner
        eyebrow={<span suppressHydrationWarning>{longDate(now)}</span>}
        title={`${greetingFor(now)}, ${displayName(user.email)}`}
        description={summary}
        stats={stats}
        actions={
          canViewUsers ? (
            <Button asChild variant="inverse" size="sm">
              <Link href="/users">
                Quản lý người dùng
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-hero-muted">Vai trò của bạn: {role.label}</span>
          )
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {canViewUsers ? <RecentUsersCard users={users.data} isPending={users.isPending} /> : <MyPermissionsCard />}
        <div className="grid gap-4">
          <HealthCard />
          {canViewUsers ? <RoleDistributionCard users={users.data} isPending={users.isPending} /> : null}
          {canViewUsers ? <MyPermissionsCard /> : null}
        </div>
      </div>
    </div>
  );
}
