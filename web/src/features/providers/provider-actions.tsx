"use client";

import { ArrowClockwise, DotsThree, GearSix, Pause, Play, SlidersHorizontal, Trash } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermission } from "@/features/auth/session-provider";
import { POLICIES } from "@/lib/auth/policies";
import { useCheckNow, useDeleteProvider, useUpdateProvider } from "./hooks";
import { ProviderFormDialog } from "./provider-form-dialog";
import type { Provider } from "./types";

export function useProviderCommands(provider: Provider) {
  const update = useUpdateProvider();
  const check = useCheckNow();
  const active = provider.status === "ACTIVE";
  return {
    active,
    isChecking: check.isPending,
    isToggling: update.isPending,
    checkNow: () => check.mutate(provider),
    toggle: () =>
      update.mutate({
        id: provider.id,
        input: { status: active ? "PAUSED" : "ACTIVE" },
        notice: active ? "Đã tạm dừng quét" : "Đã bật quét số dư",
      }),
  };
}

export function ProviderActions({ provider, onDeleted }: { provider: Provider; onDeleted?: () => void }) {
  const canUpdate = usePermission(POLICIES.providers.update);
  const canConfigure = usePermission(POLICIES.providers.configure);
  const canDelete = usePermission(POLICIES.providers.remove);
  const commands = useProviderCommands(provider);
  const remove = useDeleteProvider();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);

  if (!canUpdate && !canConfigure && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${provider.name}`}>
            <DotsThree aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{provider.name}</DropdownMenuLabel>
          {canUpdate ? (
            <>
              <DropdownMenuItem disabled={!commands.active || commands.isChecking} onSelect={commands.checkNow}>
                <ArrowClockwise aria-hidden />
                Kiểm tra ngay
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("edit")}>
                <SlidersHorizontal aria-hidden />
                Sửa ngưỡng và chu kỳ
              </DropdownMenuItem>
              <DropdownMenuItem disabled={commands.isToggling} onSelect={commands.toggle}>
                {commands.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                {commands.active ? "Tạm dừng quét" : "Bật quét"}
              </DropdownMenuItem>
            </>
          ) : null}
          {canConfigure ? (
            <DropdownMenuItem asChild>
              <Link href={`/providers/${provider.id}`}>
                <GearSix aria-hidden />
                Cấu hình API
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setDialog("delete")}>
                <Trash aria-hidden />
                Xóa đối tác
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "edit" ? <ProviderFormDialog provider={provider} onClose={() => setDialog(null)} /> : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? setDialog(null) : undefined)}
          title={`Xóa đối tác “${provider.name}”?`}
          description="Lịch quét, cấu hình, bí mật và toàn bộ lịch sử kiểm tra của đối tác sẽ bị xóa. Thao tác này không thể hoàn tác."
          confirmLabel="Xóa đối tác"
          tone="danger"
          isPending={remove.isPending}
          onConfirm={() =>
            remove.mutate(provider, {
              onSuccess: () => {
                setDialog(null);
                onDeleted?.();
              },
            })
          }
        />
      ) : null}
    </>
  );
}
