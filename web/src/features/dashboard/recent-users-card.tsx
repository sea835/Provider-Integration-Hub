"use client";

import { ArrowRight, UserPlus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleMeta, statusMeta } from "@/features/users/constants";
import type { User } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/format";

export function RecentUsersCard({ users, isPending }: { users: User[] | undefined; isPending: boolean }) {
  const recent = [...(users ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <section aria-labelledby="recent-users" className="min-w-0 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recent-users" className="text-[15px] font-bold tracking-tight">
          Tài khoản mới
        </h2>
        <Link
          href="/users"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
        >
          Xem tất cả
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {isPending ? (
        <div className="space-y-1.5" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <EmptyState icon={UserPlus} title="Chưa có tài khoản nào" description="Tài khoản mới sẽ xuất hiện tại đây." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Vai trò</TableHead>
              <TableHead className="hidden sm:table-cell">Trạng thái</TableHead>
              <TableHead className="text-right">Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((user) => {
              const role = roleMeta(user.role);
              const status = statusMeta(user.status);
              return (
                <TableRow key={user.id}>
                  <TableCell className="max-w-[320px]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={user.email} className="size-7" />
                      <span className="truncate font-medium" title={user.email}>
                        {user.email}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge tone={role.tone}>{role.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                    <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)}>
                      {formatDate(user.createdAt)}
                    </time>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
