"use client";

import { ArrowRight, ShieldCheck, UserPlus, UsersThree } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatCard, type Stat } from "@/components/ui/stat-card";
import { usePermissions, useRoles } from "@/features/access/hooks";
import { usePermission, useSession } from "@/features/auth/session-provider";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { ACTIVE_STATUS, roleMeta } from "@/features/users/constants";
import { useUsers } from "@/features/users/hooks";
import { POLICIES } from "@/lib/auth/policies";
import { formatNumber } from "@/lib/format";
import { displayName, greetingFor, longDate } from "./greeting";
import { GrowthChartCard } from "./growth-chart-card";
import { HealthCard } from "./health-card";
import { MyPermissionsCard } from "./my-permissions-card";
import { RecentUsersCard } from "./recent-users-card";
import { RoleRingsCard } from "./role-rings-card";
import { WeeklySignupsCard } from "./weekly-signups-card";

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
  const list = users.data ?? [];
  const newThisWeek = list.filter((item) => now.getTime() - new Date(item.createdAt).getTime() < WEEK_MS).length;
  const activeCount = list.filter((item) => item.status === ACTIVE_STATUS).length;

  const summary = [
    healthCopy ? `Hệ thống ${healthCopy.label.toLowerCase()}.` : "Đang kiểm tra hệ thống.",
    canViewUsers && users.data ? `Có ${formatNumber(newThisWeek)} tài khoản mới trong 7 ngày qua.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const stats: Stat[] = [
    {
      label: "Đang hoạt động",
      value: users.data ? formatNumber(activeCount) : "-",
      icon: UsersThree,
      hint: users.data ? `${formatNumber(list.length - activeCount)} tài khoản bị khóa hoặc vô hiệu` : undefined,
    },
    canManageAccess
      ? {
          label: "Vai trò",
          value: roles.data ? formatNumber(roles.data.length) : "-",
          icon: ShieldCheck,
          tone: "success",
          hint: permissions.data ? `${formatNumber(permissions.data.length)} quyền hạn trong danh mục` : undefined,
        }
      : {
          label: "Mới trong 7 ngày",
          value: users.data ? formatNumber(newThisWeek) : "-",
          icon: UserPlus,
          tone: "success",
        },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={<span suppressHydrationWarning>{longDate(now)}</span>}
        title={`${greetingFor(now)}, ${displayName(user.email)}!`}
        description={summary}
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

      {canViewUsers ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
            <GrowthChartCard users={users.data} isPending={users.isPending} now={now} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_288px]">
            <RoleRingsCard users={users.data} isPending={users.isPending} />
            <WeeklySignupsCard users={users.data} isPending={users.isPending} now={now} />
            <HealthCard className="md:col-span-2 xl:col-span-1" />
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
            <RecentUsersCard users={users.data} isPending={users.isPending} />
            <MyPermissionsCard />
          </div>
        </>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_304px]">
          <MyPermissionsCard />
          <HealthCard />
        </div>
      )}
    </div>
  );
}
