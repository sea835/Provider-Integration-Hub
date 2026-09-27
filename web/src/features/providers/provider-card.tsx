"use client";

import { ArrowRight, PlugZap, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/tooltip";
import { Can } from "@/features/auth/session-provider";
import { POLICIES } from "@/lib/auth/policies";
import { AUTH_TYPE_META, CATEGORY_META, syncIntervalLabel } from "./constants";
import { ProviderIcon, ProviderStatusBadge, SyncSummary } from "./provider-visuals";
import type { Provider } from "./types";
import { useProviderActions } from "./use-provider-actions";

export function ProviderCard({ provider }: { provider: Provider }) {
  const actions = useProviderActions(provider);
  const href = `/providers/${provider.id}` as const;

  return (
    <Card className="flex flex-col transition-shadow duration-200 hover:shadow-lift">
      <div className="flex-1">
        <div className="flex items-start gap-3 p-5 pb-4">
          <ProviderIcon category={provider.category} status={provider.status} />
          <div className="min-w-0 flex-1">
            <Link
              href={href}
              className="block truncate text-[15px] font-semibold hover:text-primary"
              title={provider.name}
            >
              {provider.name}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs whitespace-nowrap text-muted-foreground">
              <span className="font-mono">{provider.code}</span>
              <span aria-hidden>·</span>
              <span>{CATEGORY_META[provider.category].label}</span>
            </p>
          </div>
          <ProviderStatusBadge status={provider.status} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 text-[13px]">
          <div className="col-span-2 min-w-0">
            <dt className="text-xs text-muted-foreground">Endpoint</dt>
            <dd className="truncate font-mono text-[12.5px]" title={provider.baseUrl}>
              {provider.baseUrl}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Xác thực</dt>
            <dd>{AUTH_TYPE_META[provider.authType].label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chu kỳ</dt>
            <dd>{syncIntervalLabel(provider.syncIntervalMinutes)}</dd>
          </div>
        </dl>

        <div className="mx-5 mt-4 rounded-lg bg-subtle px-3 py-2.5">
          <SyncSummary provider={provider} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1 border-t px-3 py-2.5">
        <Can policy={POLICIES.providers.test}>
          <Button variant="ghost" size="sm" onClick={actions.test} isLoading={actions.isTesting}>
            {actions.isTesting ? null : <PlugZap aria-hidden />}
            Kiểm tra
          </Button>
        </Can>
        <Can policy={POLICIES.providers.sync}>
          <Hint label="Kích hoạt nhà cung cấp để đồng bộ" disabled={actions.canSync}>
            <span className="inline-flex">
              <Button variant="ghost" size="sm" onClick={actions.sync} disabled={!actions.canSync || actions.isSyncing}>
                <RefreshCw className={actions.isSyncing ? "animate-spin" : undefined} aria-hidden />
                {actions.isSyncing ? "Đang đồng bộ" : "Đồng bộ"}
              </Button>
            </span>
          </Hint>
        </Can>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link href={href}>
            Chi tiết
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
