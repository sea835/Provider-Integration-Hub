import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { CHECK_META } from "./constants";
import type { BalanceCheck } from "./types";

export function ChecksTable({
  checks,
  providerName,
}: {
  checks: BalanceCheck[];
  providerName?: (providerId: string) => string;
}) {
  return (
    <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Thời gian</TableHead>
          {providerName ? <TableHead>Đối tác</TableHead> : null}
          <TableHead>Kết quả</TableHead>
          <TableHead className="text-right">Số dư</TableHead>
          <TableHead className="text-right">HTTP</TableHead>
          <TableHead className="text-right">Độ trễ</TableHead>
          <TableHead>Lỗi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {checks.map((check) => {
          const meta = CHECK_META[check.status];
          return (
            <TableRow key={check.id}>
              <TableCell className="whitespace-nowrap tabular-nums">
                <time dateTime={check.checkedAt}>{formatDateTime(check.checkedAt)}</time>
              </TableCell>
              {providerName ? (
                <TableCell className="max-w-[220px] truncate font-medium">{providerName(check.providerId)}</TableCell>
              ) : null}
              <TableCell>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                {check.balance === null ? (
                  <span className="font-normal text-muted-foreground">-</span>
                ) : (
                  formatMoney(check.balance)
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{check.httpStatus ?? "-"}</TableCell>
              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                {check.latencyMs === null ? "-" : `${formatNumber(check.latencyMs)} ms`}
              </TableCell>
              <TableCell className="max-w-[340px]">
                {check.errorCode ? (
                  <span className="grid gap-0.5">
                    <span className="font-mono text-[11px] text-danger">{check.errorCode}</span>
                    <span className="text-[13px] leading-snug text-muted-foreground">{check.errorMessage}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
