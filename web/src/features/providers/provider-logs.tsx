"use client";

import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatDuration, formatNumber, formatRelative } from "@/lib/format";
import { LOG_STATUS_META, LOG_TYPE_META } from "./constants";
import { LogStatusBadge } from "./provider-visuals";
import type { ProviderLog, ProviderLogStatus, ProviderLogType } from "./types";

interface ProviderLogsProps {
  logs: ProviderLog[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}

export function ProviderLogs({ logs, isPending, error, onRetry }: ProviderLogsProps) {
  const [type, setType] = useState<"all" | ProviderLogType>("all");
  const [status, setStatus] = useState<"all" | ProviderLogStatus>("all");

  const rows = useMemo(
    () =>
      (logs ?? []).filter(
        (log) => (type === "all" || log.type === type) && (status === "all" || log.status === status),
      ),
    [logs, type, status],
  );

  return (
    <div>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold sm:mr-auto">
          Nhật ký hoạt động{" "}
          {logs ? <span className="font-normal text-muted-foreground tabular-nums">({rows.length})</span> : null}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
            <SelectTrigger className="sm:w-48" aria-label="Lọc theo loại">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi loại</SelectItem>
              {(Object.keys(LOG_TYPE_META) as ProviderLogType[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {LOG_TYPE_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger className="sm:w-40" aria-label="Lọc theo trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              {(Object.keys(LOG_STATUS_META) as ProviderLogStatus[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {LOG_STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3 p-4" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Không có bản ghi nhật ký"
          description="Chưa có hoạt động nào khớp với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="text-right">Thời lượng</TableHead>
                  <TableHead className="text-right">Bản ghi</TableHead>
                  <TableHead>Thực hiện bởi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)}>
                        {formatRelative(log.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{LOG_TYPE_META[log.type].label}</TableCell>
                    <TableCell>
                      <LogStatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="line-clamp-2 text-muted-foreground" title={log.message}>
                        {log.message}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                      {log.durationMs !== null ? formatDuration(log.durationMs) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {log.recordsProcessed !== null ? formatNumber(log.recordsProcessed) : "—"}
                    </TableCell>
                    <TableCell className="max-w-44 truncate text-muted-foreground" title={log.triggeredBy ?? undefined}>
                      {log.triggeredBy ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y md:hidden">
            {rows.map((log) => (
              <li key={log.id} className="space-y-1.5 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{LOG_TYPE_META[log.type].label}</span>
                  <LogStatusBadge status={log.status} />
                </div>
                <p className="text-[13px] text-muted-foreground">{log.message}</p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
                  {log.durationMs !== null ? ` · ${formatDuration(log.durationMs)}` : ""}
                  {log.triggeredBy ? ` · ${log.triggeredBy}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
