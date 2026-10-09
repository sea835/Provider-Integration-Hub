"use client";

import { Activity, KeySquare, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions, useRoles } from "@/features/access/hooks";
import { usePermission, useSession } from "@/features/auth/session-provider";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { ACTIVE_STATUS, roleMeta } from "@/features/users/constants";
import { useUsers } from "@/features/users/hooks";
import { POLICIES } from "@/lib/auth/policies";
import { formatNumber } from "@/lib/format";
import { ActivityCard } from "./activity-card";
import { HealthCard } from "./health-card";
import { MyPermissionsCard } from "./my-permissions-card";
import { RoleDistributionCard } from "./role-distribution-card";

export function DashboardView() {
  const { user } = useSession();
  const canViewUsers = usePermission(POLICIES.users.view);
  const canManageAccess = usePermission(POLICIES.access.manage);

  const health = useHealth();
  const users = useUsers(canViewUsers);
  const roles = useRoles(canManageAccess);
  const permissions = usePermissions(canManageAccess);

  const userList = users.data ?? [];
  const healthCopy = health.data ? HEALTH_COPY[health.data.level] : null;
  const healthTone = healthCopy?.tone ?? "neutral";
  const role = roleMeta(user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan hệ thống"
        description={`Xin chào ${user.email}. Đây là tình trạng hiện tại của hệ thống và tài khoản trong phạm vi quyền ${role.label.toLowerCase()} của bạn.`}
      />

      <section aria-label="Chỉ số chính" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          label="Trạng thái hệ thống"
          value={healthCopy?.label ?? "—"}
          icon={Activity}
          tone={healthTone}
          loading={health.isPending}
          className="[&>p]:text-xl [&>p]:leading-tight"
          hint={health.data?.database ? `Database phản hồi ${health.data.database.latencyMs} ms` : "Đang chờ phản hồi"}
        />
        {canViewUsers ? (
          <StatTile
            label="Người dùng"
            value={formatNumber(userList.length)}
            icon={Users}
            tone="info"
            loading={users.isPending}
            hint={`${formatNumber(userList.filter((item) => item.status === ACTIVE_STATUS).length)} đang hoạt động`}
          />
        ) : null}
        {canManageAccess ? (
          <StatTile
            label="Vai trò · quyền hạn"
            value={`${formatNumber(roles.data?.length ?? 0)} · ${formatNumber(permissions.data?.length ?? 0)}`}
            icon={KeySquare}
            tone="warning"
            loading={roles.isPending || permissions.isPending}
            hint="Được quản lý động qua CASL"
          />
        ) : (
          <StatTile
            label="Vai trò của bạn"
            value={role.label}
            icon={ShieldCheck}
            tone="neutral"
            hint={user.role}
            className="[&>p]:text-xl"
          />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <HealthCard />
        <MyPermissionsCard />
      </div>

      {canViewUsers ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <ActivityCard users={users.data} isPending={users.isPending} />
          <RoleDistributionCard users={users.data} isPending={users.isPending} />
        </div>
      ) : null}
    </div>
  );
}
