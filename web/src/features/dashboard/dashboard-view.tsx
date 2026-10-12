"use client";

import { ArrowRight, Wallet, Warning, WifiSlash } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatCard, type Stat } from "@/components/ui/stat-card";
import { usePermission, useSession } from "@/features/auth/session-provider";
import { useProviders } from "@/features/providers/hooks";
import { summarize } from "@/features/providers/providers-view";
import { HEALTH_COPY, useHealth } from "@/features/system/use-health";
import { roleMeta } from "@/features/users/constants";
import { POLICIES } from "@/lib/auth/policies";
import { formatMoney, formatNumber } from "@/lib/format";
import { BalanceChartCard } from "./balance-chart-card";
import { displayName, greetingFor, longDate } from "./greeting";
import { HealthCard } from "./health-card";
import { MyPermissionsCard } from "./my-permissions-card";
import { ProviderStatusCard } from "./provider-status-card";

export function DashboardView() {
  const { user } = useSession();
  const canViewProviders = usePermission(POLICIES.providers.view);
  const canViewBalances = usePermission(POLICIES.balanceChecks.view);

  const health = useHealth();
  const providers = useProviders(canViewProviders);

  const now = new Date();
  const role = roleMeta(user.role);
  const healthCopy = health.data ? HEALTH_COPY[health.data.level] : null;
  const balances = summarize(providers.data ?? []);
  const needTopUp = balances.warning + balances.critical;

  const summary = [
    healthCopy ? `Hệ thống ${healthCopy.label.toLowerCase()}.` : "Đang kiểm tra hệ thống.",
    canViewProviders && providers.data
      ? needTopUp > 0
        ? `Có ${formatNumber(needTopUp)} đối tác cần nạp tiền.`
        : providers.data.length > 0 && providers.data.every((provider) => provider.currentBalance !== null)
          ? "Số dư mọi đối tác đang trên ngưỡng."
          : null
      : null,
    canViewProviders && balances.failing > 0 ? `${formatNumber(balances.failing)} đối tác đang lỗi kết nối.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const stats: Stat[] = [
    {
      label: "Tổng số dư",
      value: providers.data && balances.hasBalance ? formatMoney(balances.total) : "-",
      icon: Wallet,
      hint: providers.data ? `${formatNumber(providers.data.length)} đối tác, ${balances.active} đang quét` : undefined,
    },
    {
      label: "Cần nạp tiền",
      value: providers.data ? formatNumber(needTopUp) : "-",
      icon: Warning,
      tone: needTopUp > 0 ? "danger" : "success",
      hint: providers.data ? `${balances.critical} khẩn cấp, ${balances.warning} sắp hết` : undefined,
    },
    {
      label: "Lỗi kết nối",
      value: providers.data ? formatNumber(balances.failing) : "-",
      icon: WifiSlash,
      tone: balances.failing > 0 ? "danger" : "success",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={<span suppressHydrationWarning>{longDate(now)}</span>}
        title={`${greetingFor(now)}, ${displayName(user.email)}!`}
        description={summary}
        actions={
          canViewProviders ? (
            <Button asChild variant="inverse" size="sm">
              <Link href="/providers">
                Quản lý đối tác
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-hero-muted">Vai trò của bạn: {role.label}</span>
          )
        }
      />

      {canViewProviders ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
            {canViewBalances ? (
              <BalanceChartCard providers={providers.data} isPending={providers.isPending} now={now} />
            ) : (
              <ProviderStatusCard providers={providers.data} isPending={providers.isPending} />
            )}
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
            {canViewBalances ? <ProviderStatusCard providers={providers.data} isPending={providers.isPending} /> : null}
            <HealthCard className={canViewBalances ? undefined : "xl:col-start-2"} />
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
