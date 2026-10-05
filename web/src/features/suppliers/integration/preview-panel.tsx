"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import {
  previewIntegration,
  type FlowOutputs,
  type IntegrationPreviewInput,
  type IntegrationPreviewOutput,
} from "../api";
import { actionLabel } from "../constants";
import { CheckVerdict, OrdersTable, PackagesTable } from "./flow-results";
import { JsonTree } from "./path-picker";
import { toIntegrationParams } from "./state";
import type { IntegrationParams } from "./types";

export type PreviewKind = IntegrationPreviewInput["kind"];
type Kind = PreviewKind;

const KIND_LABELS: Record<Kind, string> = {
  LOGIN: "Phản hồi khi đăng nhập lấy token",
  PACKAGES: "1. Phản hồi danh sách gói",
  CHECK: "2. Phản hồi kiểm tra gói",
  SUBMIT: "3. Phản hồi khi đăng ký gói",
  QUERY: "4. Phản hồi kiểm tra trạng thái",
  ORDERS: "5. Phản hồi danh sách đơn",
  TEST: "Phản hồi kiểm tra kết nối",
  CALLBACK: "Callback nhà cung cấp gửi về",
};

export const OUTCOME_META: Record<string, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  PENDING: { label: "Đang xử lý", tone: "info" },
  UNKNOWN: { label: "Chưa rõ, tra cứu lại", tone: "warning" },
  NOT_FOUND: { label: "Không có đơn, gửi lại", tone: "neutral" },
  OK: { label: "Kết nối được", tone: "success" },
  FAIL: { label: "Không kết nối được", tone: "danger" },
  ELIGIBLE: { label: "Đăng ký được", tone: "success" },
  INELIGIBLE: { label: "Không đăng ký được", tone: "danger" },
};

const LOGIN_OUTCOME_META: Record<string, { label: string; tone: BadgeTone }> = {
  OK: { label: "Lấy được token", tone: "success" },
  FAIL: { label: "Không lấy được token", tone: "danger" },
};

const PLACEHOLDERS: Record<Kind, string> = {
  LOGIN: '{"error": 0, "accessToken": "eyJhbGciOi..."}',
  PACKAGES: '{"code": 0, "data": {"items": [{"id": "...", "name": "...", "price": 50000}]}}',
  CHECK: '{"code": 0, "data": {"eligible": false, "reason": "..."}}',
  ORDERS: '{"code": 0, "data": {"items": [{"requestId": "TX...", "status": 4}]}}',
  SUBMIT: '{"code": 0, "data": {"id": "...", "status": 1}}',
  QUERY: '{"code": 0, "data": {"id": "...", "status": 4}}',
  TEST: '{"code": 0, "data": []}',
  CALLBACK: '{"eventId": "...", "data": {"requestId": "...", "status": 4}}',
};

export interface PreviewSample {
  httpStatus: string;
  body: string;
}
type Sample = PreviewSample;

const EMPTY_SAMPLE: Sample = { httpStatus: "200", body: "" };

export function emptySamples(): Record<PreviewKind, PreviewSample> {
  return {
    LOGIN: EMPTY_SAMPLE,
    PACKAGES: EMPTY_SAMPLE,
    CHECK: EMPTY_SAMPLE,
    ORDERS: EMPTY_SAMPLE,
    SUBMIT: EMPTY_SAMPLE,
    QUERY: EMPTY_SAMPLE,
    TEST: EMPTY_SAMPLE,
    CALLBACK: EMPTY_SAMPLE,
  };
}

function parseJson(text: string): { value: unknown; error: string | null } {
  if (!text.trim()) return { value: null, error: null };
  try {
    return { value: JSON.parse(text) as unknown, error: null };
  } catch {
    return { value: null, error: "JSON không hợp lệ" };
  }
}

function looksLikeIntegration(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  const spec =
    typeof source.spec === "object" && source.spec !== null ? (source.spec as Record<string, unknown>) : source;
  return "submit" in spec && "order" in spec;
}

function Block({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="grid grid-cols-1 gap-1">
      <p className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <pre className="max-h-48 scrollbar-thin overflow-auto rounded-md border bg-subtle px-2.5 py-2 font-mono text-[11.5px] leading-relaxed">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function PreviewPanel({
  baseUrl,
  buildParams,
  onImportIntegration,
  kind: selectedKind,
  onKindChange,
  samples,
  onSamplesChange,
}: {
  baseUrl: string;
  buildParams: () => IntegrationParams;
  onImportIntegration: (params: IntegrationParams) => void;
  kind: PreviewKind;
  onKindChange: (kind: PreviewKind) => void;
  samples: Record<PreviewKind, PreviewSample>;
  onSamplesChange: Dispatch<SetStateAction<Record<PreviewKind, PreviewSample>>>;
}) {
  const [order, setOrder] = useState({ action: "", packageCode: "MA_GOI", phone: "0912345678", serial: "" });
  const [result, setResult] = useState<{
    kind: Kind;
    body: string;
    data: IntegrationPreviewOutput & FlowOutputs;
  } | null>(null);
  const params = buildParams();
  const actions = params.spec.actions;
  const tokenEnabled = params.spec.token.enabled;
  const available = (value: Kind) =>
    (value !== "LOGIN" || tokenEnabled) &&
    (value !== "PACKAGES" || params.spec.packages.enabled) &&
    (value !== "CHECK" || params.spec.check.enabled) &&
    (value !== "ORDERS" || params.spec.orders.enabled);
  const kind: Kind = available(selectedKind) ? selectedKind : "SUBMIT";
  const kinds = (Object.keys(KIND_LABELS) as Kind[]).filter(available);
  const sample = samples[kind];
  const parsed = parseJson(sample.body);
  const pastedIntegration = looksLikeIntegration(parsed.value);

  const run = useMutation({
    mutationFn: () =>
      previewIntegration({
        baseUrl,
        params: params as unknown as Record<string, unknown>,
        kind,
        order: {
          action: order.action || actions[0],
          packageCode: order.packageCode,
          phone: order.phone || null,
          serial: order.serial || null,
        },
        response: sample.body.trim()
          ? { httpStatus: Number(sample.httpStatus) || 200, body: parsed.error ? sample.body : parsed.value }
          : undefined,
      }),
    onSuccess: (data) => setResult({ kind, body: sample.body, data }),
  });
  const output = result && result.kind === kind && result.body === sample.body ? result.data : null;

  const setSample = (patch: Partial<Sample>) =>
    onSamplesChange((current) => ({ ...current, [kind]: { ...current[kind], ...patch } }));
  const flow = kind === "PACKAGES" || kind === "CHECK" || kind === "ORDERS";
  const outcome = output?.result
    ? ((kind === "LOGIN" ? LOGIN_OUTCOME_META[output.result.outcome] : undefined) ??
      OUTCOME_META[output.result.outcome] ?? { label: output.result.outcome, tone: "outline" as const })
    : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" aria-hidden />
            Phân loại thử
          </CardTitle>
          <CardDescription>
            Dán một phản hồi mẫu của nhà cung cấp. Hub đọc nó đúng như khi chạy thật, không gửi gì sang nhà cung cấp.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        <Select value={kind} onValueChange={(value) => onKindChange(value as Kind)}>
          <SelectTrigger aria-label="Loại phản hồi mẫu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((value) => (
              <SelectItem key={value} value={value}>
                {KIND_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {kind === "SUBMIT" || kind === "QUERY" || kind === "CHECK" || kind === "PACKAGES" ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 grid gap-1">
              <Label className="text-[12px]">Đơn mẫu</Label>
              <Select
                value={order.action || actions[0] || ""}
                onValueChange={(action) => setOrder({ ...order, action })}
              >
                <SelectTrigger className="h-8 text-[13px]" aria-label="Thao tác của đơn mẫu">
                  <SelectValue placeholder="Chưa chọn thao tác" />
                </SelectTrigger>
                <SelectContent>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {actionLabel(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={order.packageCode}
              onChange={(event) => setOrder({ ...order, packageCode: event.target.value })}
              placeholder="Mã gói"
              aria-label="Mã gói của đơn mẫu"
              className="h-8 font-mono text-[12.5px]"
            />
            <Input
              value={order.phone}
              onChange={(event) => setOrder({ ...order, phone: event.target.value })}
              placeholder="SĐT"
              aria-label="SĐT của đơn mẫu"
              className="h-8 font-mono text-[12.5px]"
            />
            <Input
              value={order.serial}
              onChange={(event) => setOrder({ ...order, serial: event.target.value })}
              placeholder="Serial (nếu có)"
              aria-label="Serial của đơn mẫu"
              className="col-span-2 h-8 font-mono text-[12.5px]"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="preview-body" className="text-[12px]">
              Phản hồi mẫu (JSON)
            </Label>
            {kind !== "CALLBACK" ? (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="preview-status" className="text-[12px] text-muted-foreground">
                  HTTP
                </Label>
                <Input
                  id="preview-status"
                  value={sample.httpStatus}
                  onChange={(event) => setSample({ httpStatus: event.target.value })}
                  inputMode="numeric"
                  className="h-7 w-16 font-mono text-[12px]"
                />
              </div>
            ) : null}
          </div>
          <Textarea
            id="preview-body"
            value={sample.body}
            onChange={(event) => setSample({ body: event.target.value })}
            rows={7}
            spellCheck={false}
            placeholder={PLACEHOLDERS[kind]}
            className="font-mono text-[12px]"
            aria-invalid={parsed.error ? true : undefined}
          />
          {parsed.error ? <p className="text-[12px] text-danger">{parsed.error}</p> : null}
          <p className="text-[12px] leading-snug text-muted-foreground">
            Dán đúng phản hồi nhà cung cấp trả về cho lời gọi này (lấy trong tài liệu API hoặc Postman), không phải bản
            tích hợp.
          </p>
        </div>

        {pastedIntegration ? (
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px]">
            <p className="flex items-start gap-2 text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Đây là bản tích hợp, không phải phản hồi của nhà cung cấp.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => {
                onImportIntegration(toIntegrationParams(parsed.value));
                setSample({ body: "" });
                setResult(null);
              }}
            >
              Nạp làm bản tích hợp
            </Button>
          </div>
        ) : null}

        {pastedIntegration ? null : <JsonTree value={parsed.value} source={kind} />}

        <Button onClick={() => run.mutate()} isLoading={run.isPending} disabled={pastedIntegration}>
          {run.isPending ? null : <FlaskConical aria-hidden />}
          Phân loại thử
        </Button>
        {run.isError ? <p className="text-[12.5px] text-danger">{getErrorMessage(run.error)}</p> : null}

        {output ? (
          <div className="grid grid-cols-1 gap-3 border-t pt-4" aria-live="polite">
            {output.issues.length > 0 ? (
              <ul className="list-disc space-y-1 rounded-md bg-danger-soft py-2 pr-3 pl-7 text-[12.5px] text-danger">
                {output.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            {flow && output.issues.length === 0 ? (
              <div className="grid grid-cols-1 gap-2 rounded-lg border p-3">
                {output.explain ? <p className="text-[13px]">{output.explain}</p> : null}
                {output.result?.errorMessage && !output.check ? (
                  <p className="text-[12.5px] text-danger">{output.result.errorMessage}</p>
                ) : null}
                {output.packages ? <PackagesTable packages={output.packages} /> : null}
                {output.check ? <CheckVerdict check={output.check} /> : null}
                {output.orders ? <OrdersTable orders={output.orders} /> : null}
              </div>
            ) : outcome && output.result ? (
              <div className="grid grid-cols-1 gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted-foreground">Hub hiểu là</span>
                  <Badge tone={outcome.tone} className="text-[13px]">
                    {outcome.label}
                  </Badge>
                  {output.result.errorCode ? (
                    <span className="font-mono text-[12px] text-danger">{output.result.errorCode}</span>
                  ) : null}
                </div>
                {output.explain ? <p className="text-[13px]">{output.explain}</p> : null}
                <dl className="grid grid-cols-1 gap-1 text-[12.5px]">
                  {output.result.errorMessage ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Thông báo:</dt>
                      <dd>{output.result.errorMessage}</dd>
                    </div>
                  ) : null}
                  {output.result.supplierTransId ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Mã đơn NCC:</dt>
                      <dd className="font-mono">{output.result.supplierTransId}</dd>
                    </div>
                  ) : null}
                  {output.result.delivery ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Giao cho khách:</dt>
                      <dd className="font-mono break-all">{JSON.stringify(output.result.delivery)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : output.issues.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">Chưa có phản hồi mẫu nên chỉ hiện request sẽ gửi.</p>
            ) : null}
            {output.request ? (
              <div className={cn("grid gap-2")}>
                <Block
                  title="Request Hub sẽ gửi (bí mật đã che)"
                  value={`${output.request.method} ${output.request.url}`}
                />
                <Block title="Header" value={output.request.headers} />
                {output.request.body ? <Block title="Body" value={output.request.body} /> : null}
                {output.request.signature ? (
                  <p className="text-[12px] leading-snug text-muted-foreground">
                    Chữ ký ở đây tính bằng khoá đã che nên khác chữ ký thật; khi chạy, Hub ký bằng khoá thật.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
