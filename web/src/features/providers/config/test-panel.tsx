"use client";

import { CheckCircle, CursorClick, FloppyDisk, Play, WarningOctagon } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { isApiError } from "@/lib/api/errors";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProbeStep, TestConnectionResult } from "../types";

const MAPPING_PENDING = new Set(["TOKEN_PATH_MISSING", "BALANCE_PATH_MISSING"]);

const STEP_LABELS: Record<ProbeStep["kind"], string> = { login: "Đăng nhập lấy token", balance: "Gọi API số dư" };

function pretty(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function CodeBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <pre
        tabIndex={0}
        className="max-h-56 scrollbar-thin overflow-auto rounded-md bg-subtle px-3 py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
      >
        {pretty(value)}
      </pre>
    </div>
  );
}

function StepView({
  step,
  index,
  onSaveSample,
  isSavingSample,
}: {
  step: ProbeStep;
  index: number;
  onSaveSample: (step: ProbeStep) => void;
  isSavingSample: boolean;
}) {
  const { request, response } = step;
  return (
    <li className="rounded-lg bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold">
          {index + 1}. {STEP_LABELS[step.kind]}
        </span>
        <Badge tone={step.ok ? "success" : "danger"}>{step.ok ? "Thành công" : "Thất bại"}</Badge>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {response.status ? `HTTP ${response.status} · ` : ""}
          {formatNumber(response.durationMs)} ms
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{step.note}</p>
      <div className="mt-3 grid gap-3">
        <CodeBlock label="Request" value={`${request.method} ${request.url}`} />
        <CodeBlock label="Headers gửi đi" value={request.headers} />
        {request.body !== undefined ? <CodeBlock label="Body gửi đi" value={request.body} /> : null}
        {request.signedPayload !== undefined ? (
          <CodeBlock
            label="Chuỗi đem ký và chữ ký"
            value={`${request.signedPayload || "(chuỗi rỗng)"}\n→ ${request.signature ?? ""}`}
          />
        ) : null}
        <CodeBlock label="Phản hồi" value={response.error ?? response.body ?? "(không có nội dung)"} />
        {response.status !== undefined ? (
          <div>
            <Button variant="outline" size="sm" disabled={isSavingSample} onClick={() => onSaveSample(step)}>
              <FloppyDisk aria-hidden />
              Lưu làm payload mẫu
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function TestPanel({
  result,
  error,
  isPending,
  onRun,
  onSaveSample,
  isSavingSample,
  className,
}: {
  result: TestConnectionResult | undefined;
  error: unknown;
  isPending: boolean;
  onRun: () => void;
  onSaveSample: (step: ProbeStep) => void;
  isSavingSample: boolean;
  className?: string;
}) {
  const messages = isApiError(error) ? error.messages : error ? ["Không gọi được máy chủ. Vui lòng thử lại."] : [];
  const mappingPending = Boolean(result && !result.ok && MAPPING_PENDING.has(result.errorCode ?? ""));

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Kết quả gọi thử</CardTitle>
          <CardDescription>
            Chạy bằng cấu hình đang soạn, chưa cần lưu. Không ghi lịch sử, không gửi cảnh báo. Lưu phản hồi làm payload
            mẫu để chọn trường cho các ô đường dẫn.
          </CardDescription>
        </div>
        <Button onClick={onRun} isLoading={isPending} className="shrink-0">
          {isPending ? null : <Play weight="fill" aria-hidden />}
          Thử kết nối
        </Button>
      </div>

      <div aria-live="polite" className="mt-4 grid gap-3">
        {messages.length > 0 ? (
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] leading-relaxed text-danger">
            <p className="flex items-center gap-2 font-semibold">
              <WarningOctagon className="size-4 shrink-0" aria-hidden />
              Chưa thử được
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-6 text-foreground/85">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {result ? (
          <>
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-3",
                result.ok ? "bg-success-soft" : mappingPending ? "bg-info-soft" : "bg-danger-soft",
              )}
            >
              {result.ok ? (
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-success" weight="fill" aria-hidden />
              ) : mappingPending ? (
                <CursorClick className="mt-0.5 size-5 shrink-0 text-info" weight="fill" aria-hidden />
              ) : (
                <WarningOctagon className="mt-0.5 size-5 shrink-0 text-danger" weight="fill" aria-hidden />
              )}
              <div className="min-w-0">
                {result.ok && result.balance !== null ? (
                  <>
                    <p className="text-lg leading-tight font-bold">{formatMoney(result.balance)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Giá trị đọc được: <span className="font-mono">{result.rawValue}</span> ·{" "}
                      {formatNumber(result.latencyMs ?? 0)} ms
                    </p>
                  </>
                ) : result.ok ? (
                  <p className="text-sm leading-snug font-semibold">
                    Đăng nhập thành công · {formatNumber(result.latencyMs ?? 0)} ms
                  </p>
                ) : (
                  <>
                    <p className="text-sm leading-snug font-semibold">{result.errorMessage}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{result.errorCode}</p>
                  </>
                )}
                {result.tokenPreview ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Token: <span className="font-mono">{result.tokenPreview}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <ol className="grid gap-2">
              {result.steps.map((step, index) => (
                <StepView
                  key={`${step.kind}-${index}`}
                  step={step}
                  index={index}
                  onSaveSample={onSaveSample}
                  isSavingSample={isSavingSample}
                />
              ))}
            </ol>
          </>
        ) : messages.length === 0 ? (
          <p className="rounded-lg bg-subtle px-3 py-6 text-center text-[13px] text-muted-foreground">
            Bấm Gọi thử ở từng API, hoặc Thử kết nối để chạy cả luồng, rồi xem dữ liệu gửi đi và phản hồi tại đây.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
