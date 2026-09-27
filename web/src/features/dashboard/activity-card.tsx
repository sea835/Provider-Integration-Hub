"use client";

import { History, PlugZap, RefreshCw, Settings2, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { LOG_TYPE_META } from "@/features/providers/constants";
import { LogStatusBadge } from "@/features/providers/provider-visuals";
import type { ProviderLog, ProviderLogType } from "@/features/providers/types";
import { roleMeta } from "@/features/users/constants";
import type { User } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";

const LOG_ICONS: Record<ProviderLogType, LucideIcon> = {
  SYNC: RefreshCw,
  CONNECTION_TEST: PlugZap,
  CONFIG_UPDATE: Settings2,
};

interface ActivityItem {
  id: string;
  at: string;
  icon: LucideIcon;
  title: string;
  description: string;
  href?: `/providers/${string}` | "/users";
  log?: ProviderLog;
}

interface ActivityCardProps {
  logs: ProviderLog[] | undefined;
  users: User[] | undefined;
  isPending: boolean;
}

export function ActivityCard({ logs, users, isPending }: ActivityCardProps) {
  const items = useMemo(() => {
    const fromLogs: ActivityItem[] = (logs ?? []).map((log) => ({
      id: `log-${log.id}`,
      at: log.createdAt,
      icon: LOG_ICONS[log.type],
      title: `${LOG_TYPE_META[log.type].label} · ${log.providerName}`,
      description: log.triggeredBy ? `${log.message} — ${log.triggeredBy}` : log.message,
      href: `/providers/${log.providerId}`,
      log,
    }));
    const fromUsers: ActivityItem[] = [...(users ?? [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((user) => ({
        id: `user-${user.id}`,
        at: user.createdAt,
        icon: UserPlus,
        title: "Tài khoản mới",
        description: `${user.email} · ${roleMeta(user.role).label}`,
        href: "/users",
      }));
    return [...fromLogs, ...fromUsers].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  }, [logs, users]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Hoạt động gần đây</CardTitle>
          <CardDescription>Đồng bộ, kiểm tra kết nối, thay đổi cấu hình và tài khoản mới.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {isPending ? (
          <div className="space-y-3 px-3" aria-hidden>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Chưa có hoạt động"
            description="Các thao tác mới sẽ xuất hiện tại đây."
            className="py-8"
          />
        ) : (
          <ul>
            {items.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      {item.log ? <LogStatusBadge status={item.log.status} /> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground" title={item.description}>
                      {item.description}
                    </span>
                  </span>
                  <time
                    dateTime={item.at}
                    title={formatDateTime(item.at)}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatRelative(item.at)}
                  </time>
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-subtle"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
