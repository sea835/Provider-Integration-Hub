"use client";

import { ArrowClockwise, MagnifyingGlass, UserPlus, Users, X } from "@phosphor-icons/react/ssr";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { PageBanner } from "@/components/layout/page-banner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Can, useSession } from "@/features/auth/session-provider";
import type { User } from "@/lib/api/types";
import { POLICIES } from "@/lib/auth/policies";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ACTIVE_STATUS, ROLE_OPTIONS, roleMeta, STATUS_FILTERS, statusMeta } from "./constants";
import { CreateUserDialog } from "./create-user-dialog";
import { useUsers } from "./hooks";
import { UserActions } from "./user-actions";

const PAGE_SIZE = 20;

function useUrlParams() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };
  return { searchParams, update };
}

function UserIdentity({ user, isSelf }: { user: User; isSelf: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={user.email} />
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium">
          <span className="truncate" title={user.email}>
            {user.email}
          </span>
          {isSelf ? <Badge tone="primary">Bạn</Badge> : null}
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground" title={user.id}>
          {user.id}
        </p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const meta = roleMeta(role);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function TableSkeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3 even:bg-subtle/60">
          <Skeleton className="size-8" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-52" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="hidden h-5 w-20 md:block" />
          <Skeleton className="hidden h-5 w-20 md:block" />
          <Skeleton className="hidden h-3.5 w-24 lg:block" />
        </div>
      ))}
    </div>
  );
}

export function UsersView() {
  const { user: currentUser } = useSession();
  const { searchParams, update } = useUrlParams();
  const { data: users, isPending, isError, error, refetch, isFetching } = useUsers();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const deferredSearch = useDeferredValue(search);

  const roleFilter = searchParams.get("role") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const stats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      active: list.filter((user) => user.status === ACTIVE_STATUS).length,
      admins: list.filter((user) => user.role === "ADMIN").length,
      locked: list.filter((user) => user.status !== ACTIVE_STATUS).length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return (users ?? []).filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && user.status !== ACTIVE_STATUS) return false;
      if (statusFilter === "inactive" && user.status === ACTIVE_STATUS) return false;
      return !term || user.email.toLowerCase().includes(term) || user.id.startsWith(term);
    });
  }, [users, deferredSearch, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search !== "" || roleFilter !== "all" || statusFilter !== "all";
  const isStale = search !== deferredSearch;

  const clearFilters = () => {
    setSearch("");
    update({ q: null, role: null, status: null, page: null });
  };

  return (
    <div className="space-y-6">
      <PageBanner
        eyebrow="Quản trị"
        title="Người dùng"
        description="Quản lý tài khoản, vai trò và trạng thái truy cập của thành viên trong hệ thống."
        stats={[
          { label: "Tổng", value: isPending ? "-" : formatNumber(stats.total) },
          { label: "Hoạt động", value: isPending ? "-" : formatNumber(stats.active) },
          { label: "Quản trị viên", value: isPending ? "-" : formatNumber(stats.admins) },
          { label: "Bị khóa", value: isPending ? "-" : formatNumber(stats.locked) },
        ]}
        actions={
          <>
            <Can policy={POLICIES.users.create}>
              <Button variant="inverse" size="sm" onClick={() => setCreateOpen(true)}>
                <UserPlus aria-hidden />
                Thêm người dùng
              </Button>
            </Can>
            <Button variant="inverse-ghost" size="sm" onClick={() => void refetch()}>
              <ArrowClockwise className={cn(isFetching && "animate-spin")} aria-hidden />
              Tải lại
            </Button>
          </>
        }
      />

      <Card tone="plain">
        <div className="flex flex-col gap-2 pb-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                update({ q: event.target.value, page: null });
              }}
              placeholder="Tìm theo email hoặc mã người dùng"
              aria-label="Tìm kiếm người dùng"
              className="pl-9"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={roleFilter} onValueChange={(value) => update({ role: value, page: null })}>
              <SelectTrigger className="sm:w-44" aria-label="Lọc theo vai trò">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi vai trò</SelectItem>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => update({ status: value, page: null })}>
              <SelectTrigger className="sm:w-48" aria-label="Lọc theo trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start lg:self-auto">
              <X aria-hidden />
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>

        {isPending ? (
          <TableSkeleton />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? "Không tìm thấy người dùng phù hợp" : "Chưa có người dùng nào"}
            description={
              hasFilters
                ? "Thử thay đổi từ khóa hoặc bộ lọc để xem thêm kết quả."
                : "Tạo tài khoản đầu tiên để bắt đầu."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : null
            }
          />
        ) : (
          <div className={cn("transition-opacity", isStale && "opacity-60")}>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="w-14">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="max-w-[420px]">
                        <UserIdentity user={user} isSelf={user.id === currentUser.id} />
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)}>
                          {formatRelative(user.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions user={user} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="md:hidden">
              {visible.map((user) => (
                <li key={user.id} className="flex items-start gap-3 px-4 py-3 even:bg-subtle/60">
                  <div className="min-w-0 flex-1 space-y-2">
                    <UserIdentity user={user} isSelf={user.id === currentUser.id} />
                    <div className="flex flex-wrap items-center gap-2 pl-11">
                      <RoleBadge role={user.role} />
                      <StatusBadge status={user.status} />
                      <time dateTime={user.createdAt} className="text-xs text-muted-foreground">
                        {formatRelative(user.createdAt)}
                      </time>
                    </div>
                  </div>
                  <UserActions user={user} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isPending && !isError && filtered.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 pt-3 text-[13px] text-muted-foreground sm:flex-row">
            <p className="tabular-nums" aria-live="polite">
              Hiển thị {formatNumber((page - 1) * PAGE_SIZE + 1)}-
              {formatNumber(Math.min(page * PAGE_SIZE, filtered.length))} trên {formatNumber(filtered.length)} người
              dùng
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                Trước
              </Button>
              <span className="min-w-16 text-center tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => update({ page: String(page + 1) })}
              >
                Sau
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
