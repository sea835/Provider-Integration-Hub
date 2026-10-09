"use client";

import { ListChecks, MagnifyingGlass, Trash } from "@phosphor-icons/react/ssr";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Hint } from "@/components/ui/tooltip";
import type { Permission } from "@/lib/api/types";
import { actionLabel, subjectLabel } from "@/lib/auth/policies";
import { formatDate } from "@/lib/format";
import { isProtectedPermission } from "./api";
import { useDeletePermission, usePermissions } from "./hooks";
import { buildMatrix } from "./permission-matrix";

const ACTION_TONES: Record<string, "primary" | "success" | "info" | "warning" | "danger"> = {
  manage: "primary",
  create: "success",
  read: "info",
  update: "warning",
  delete: "danger",
};

export function PermissionCatalog() {
  const { data: permissions, isPending, isError, error, refetch } = usePermissions();
  const deletePermission = useDeletePermission();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Permission | null>(null);
  const term = useDeferredValue(search.trim().toLowerCase());

  const rows = useMemo(() => {
    if (!permissions) return [];
    const { subjects, actions } = buildMatrix(permissions);
    return [...permissions]
      .filter((permission) =>
        !term
          ? true
          : [
              permission.action,
              permission.subject,
              permission.description ?? "",
              subjectLabel(permission.subject),
              actionLabel(permission.action),
            ]
              .join(" ")
              .toLowerCase()
              .includes(term),
      )
      .sort(
        (a, b) =>
          subjects.indexOf(a.subject) - subjects.indexOf(b.subject) ||
          actions.indexOf(a.action) - actions.indexOf(b.action),
      );
  }, [permissions, term]);

  return (
    <Card tone="plain">
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo hành động, đối tượng hoặc mô tả…"
            aria-label="Tìm quyền hạn"
            className="pl-9"
          />
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3 p-4" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Không có quyền hạn phù hợp"
          description="Thử từ khóa khác hoặc tạo quyền hạn mới."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Hành động</TableHead>
              <TableHead>Đối tượng</TableHead>
              <TableHead>Điều kiện</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((permission) => {
              const locked = isProtectedPermission(permission);
              return (
                <TableRow key={permission.id}>
                  <TableCell>
                    <Badge tone={ACTION_TONES[permission.action] ?? "neutral"}>
                      {actionLabel(permission.action)}
                      <span className="font-mono opacity-70">{permission.action}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{subjectLabel(permission.subject)}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{permission.subject}</p>
                  </TableCell>
                  <TableCell>
                    {permission.conditions ? (
                      <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                        {JSON.stringify(permission.conditions)}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 text-muted-foreground">
                    <span className="line-clamp-2">{permission.description || "-"}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(permission.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Hint label={locked ? "Quyền toàn hệ thống được bảo vệ" : "Xóa quyền hạn"} side="left">
                      <span className="inline-flex">
                        <Button
                          variant="destructive-ghost"
                          size="icon-sm"
                          disabled={locked}
                          onClick={() => setTarget(permission)}
                          aria-label={`Xóa quyền ${permission.action} · ${permission.subject}`}
                        >
                          <Trash aria-hidden />
                        </Button>
                      </span>
                    </Hint>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {target ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? setTarget(null) : undefined)}
          title="Xóa quyền hạn này?"
          description={`Quyền “${target.action} · ${target.subject}” sẽ bị gỡ khỏi mọi vai trò đang sử dụng. Thao tác này không thể hoàn tác.`}
          confirmLabel="Xóa quyền hạn"
          tone="danger"
          isPending={deletePermission.isPending}
          onConfirm={() =>
            deletePermission.mutate(target.id, {
              onSuccess: () => {
                toast.success("Đã xóa quyền hạn", { description: `${target.action} · ${target.subject}` });
                setTarget(null);
              },
            })
          }
        />
      ) : null}
    </Card>
  );
}
