"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/ui/tooltip";
import { ROLE_OPTIONS, roleMeta } from "@/features/users/constants";
import type { User } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";

export function RoleDistributionCard({ users, isPending }: { users: User[] | undefined; isPending: boolean }) {
  const list = users ?? [];
  const known = new Set<string>(ROLE_OPTIONS.map((option) => option.value));
  const rows = [
    ...ROLE_OPTIONS.map((option) => ({
      key: option.value,
      label: option.label,
      count: list.filter((user) => user.role === option.value).length,
    })),
    ...Array.from(new Set(list.map((user) => user.role).filter((role) => !known.has(role)))).map((role) => ({
      key: role,
      label: roleMeta(role).label,
      count: list.filter((user) => user.role === role).length,
    })),
  ];
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Người dùng theo vai trò</CardTitle>
          <CardDescription>Số tài khoản đang mang từng vai trò.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/users">
            Quản lý
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-4" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Số người dùng theo vai trò</caption>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="w-32 py-2 pr-3 text-left font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <Hint label={`${row.label}: ${formatNumber(row.count)} người dùng`}>
                        <span className="flex h-6 flex-1 items-center">
                          <span
                            className="h-2.5 min-w-0.5 rounded-r-[4px] bg-chart-accent transition-[filter] hover:brightness-110"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </span>
                      </Hint>
                      <span className="w-10 text-right font-medium tabular-nums">{formatNumber(row.count)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
