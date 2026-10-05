"use client";

import { Activity, KeySquare, PlugZap, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions, useRoles } from "@/features/access/hooks";
import { usePermission, useSession } from "@/features/auth/session-provider";
import { useOrders, useSuppliers } from "@/features/suppliers/hooks";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { ACTIVE_STATUS, roleMeta } from "@/features/users/constants";
import { useUsers } from "@/features/users/hooks";
import { POLICIES } from "@/lib/auth/policies";
import { formatNumber } from "@/lib/format";
import { ActivityCard } from "./activity-card";
import { HealthCard } from "./health-card";
import { MyPermissionsCard } from "./my-permissions-card";
import { RoleDistributionCard } from "./role-distribution-card";
import { SupplierOverviewCard } from "./supplier-overview-card";

export function DashboardView() {
  const { user } = useSession();
  const canViewProviders = usePermission(POLICIES.suppliers.manage);
  const canViewOrders = usePermission(POLICIES.orders.manage);
  const canViewUsers = usePermission(POLICIES.users.view);
  const canManageAccess = usePermission(POLICIES.access.manage);

  const health = useHealth();
  const providers = useSuppliers(canViewProviders);
  const activity = useOrders({ limit: 10 }, canViewOrders);
  const users = useUsers(canViewUsers);
  const roles = useRoles(canManageAccess);
  const permissions = usePermissions(canManageAccess);

  const providerList = providers.data ?? [];
  const userList = users.data ?? [];
  const healthCopy = health.data ? HEALTH_COPY[health.data.level] : null;
  const healthTone = healthCopy?.tone ?? "neutral";
  const role = roleMeta(user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan hệ thống"
        description={`Xin chào ${user.email}. Đây là tình trạng hiện tại của các tích hợp và tài khoản trong phạm vi quyền ${role.label.toLowerCase()} của bạn.`}
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
        {canViewProviders ? (
          <StatTile
            label="Nhà cung cấp"
            value={formatNumber(providerList.length)}
            icon={PlugZap}
            loading={providers.isPending}
            hint={`${formatNumber(providerList.filter((item) => item.status === "ACTIVE").length)} đang chạy · ${formatNumber(
              providerList.filter((item) => item.status === "PAUSED").length,
            )} tạm dừng`}
          />
        ) : null}
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
        {canViewProviders ? (
          <SupplierOverviewCard
            suppliers={providers.data}
            isPending={providers.isPending}
            error={providers.error}
            onRetry={() => void providers.refetch()}
          />
        ) : (
          <MyPermissionsCard />
        )}
      </div>

      {canViewProviders || canViewUsers ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <ActivityCard
            orders={canViewOrders ? activity.data?.data : []}
            suppliers={providers.data}
            users={canViewUsers ? users.data : []}
            isPending={(canViewOrders && activity.isPending) || (canViewUsers && users.isPending)}
          />
          <div className="space-y-6">
            {canViewUsers ? <RoleDistributionCard users={users.data} isPending={users.isPending} /> : null}
            {canViewProviders ? <MyPermissionsCard /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
