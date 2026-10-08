"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, History, Play } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/errors";
import { callIntegration, type IntegrationCallOutput, type LiveCallKind, type LiveExchange } from "../api";
import { actionLabel, ORDER_STATUS_META } from "../constants";
import { useOrders } from "../hooks";
import { BalanceVerdict, CheckVerdict, OrdersTable, PackagesTable } from "./flow-results";
import { JsonTree, type PickSource } from "./path-picker";
import { OUTCOME_META } from "./preview-panel";
import type { IntegrationParams, RequestSpec, ExtraField } from "./types";

function statusTone(status: number): BadgeTone {
  if (status >= 200 && status < 300) return "success";
  if (status >= 500) return "danger";
  return "warning";
}

function hostOf(baseUrl: string, path: string): string {
  try {
    return new URL(/^https?:\/\//i.test(path) ? path : baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function ExchangeView({ title, exchange, source }: { title: string; exchange: LiveExchange; source: PickSource }) {
  const { request, response } = exchange;
  const isTree = response.ok && typeof response.body === "object" && response.body !== null;
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="font-medium">{title}</span>
        {response.ok ? (
          <Badge tone={statusTone(response.httpStatus)} className="font-mono">
            HTTP {response.httpStatus}
          </Badge>
        ) : (
          <Badge tone="danger">{response.error === "TIMEOUT" ? "Hết thời gian chờ" : "Không kết nối được"}</Badge>
        )}
        <span className="text-muted-foreground">{response.durationMs} ms</span>
      </div>
      <p className="rounded-md border bg-subtle px-2.5 py-1.5 font-mono text-[11.5px] break-all">
        {request.method} {request.url}
      </p>
      {response.ok ? (
        <>
          {isTree ? (
            <JsonTree value={response.body} source={source} />
          ) : (
            <pre className="max-h-60 scrollbar-thin overflow-auto rounded-md border bg-subtle px-2.5 py-2 font-mono text-[11.5px] whitespace-pre-wrap">
              {typeof response.body === "string" ? response.body || "(phản hồi rỗng)" : JSON.stringify(response.body)}
            </pre>
          )}
          {response.truncated ? <p className="text-[12px] text-warning">Phản hồi quá dài, chỉ hiện phần đầu.</p> : null}
        </>
      ) : (
        <p className="rounded-md bg-danger-soft px-2.5 py-2 text-[12.5px] text-danger">{response.message}</p>
      )}
      <details className="text-[12px]">
        <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
          Header và body đã gửi (bí mật đã che)
        </summary>
        <pre className="mt-1.5 max-h-48 scrollbar-thin overflow-auto rounded-md border bg-subtle px-2.5 py-2 font-mono text-[11.5px]">
          {JSON.stringify({ headers: request.headers, body: request.body }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ResultView({
  output,
  source,
  onUseAsSample,
}: {
  output: IntegrationCallOutput;
  source: PickSource;
  onUseAsSample?: (httpStatus: number, body: unknown) => void;
}) {
  const response = output.call?.response;
  const flow =
    output.packages !== undefined ||
    output.check !== undefined ||
    output.orders !== undefined ||
    output.balance !== undefined;
  const outcome =
    output.result && !flow
      ? (OUTCOME_META[output.result.outcome] ?? { label: output.result.outcome, tone: "outline" as const })
      : null;
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3" aria-live="polite">
      {output.issues.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-md bg-danger-soft py-2 pr-3 pl-7 text-[12.5px] text-danger">
          {output.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {outcome ? (
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Hub hiểu là</span>
            <Badge tone={outcome.tone} className="text-[13px]">
              {outcome.label}
            </Badge>
            {output.result?.errorCode ? (
              <span className="font-mono text-[12px] text-danger">{output.result.errorCode}</span>
            ) : null}
            {output.result?.supplierTransId ? (
              <span className="font-mono text-[12px] text-muted-foreground">
                mã NCC {output.result.supplierTransId}
              </span>
            ) : null}
          </div>
          {output.explain ? <p className="text-[13px]">{output.explain}</p> : null}
        </div>
      ) : flow && output.explain ? (
        <p className="text-[13px]">{output.explain}</p>
      ) : output.explain ? (
        <p className="flex items-start gap-2 text-[13px] text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {output.explain}
        </p>
      ) : null}
      {output.packages ? <PackagesTable packages={output.packages} /> : null}
      {output.check ? <CheckVerdict check={output.check} /> : null}
      {output.balance ? <BalanceVerdict balance={output.balance} /> : null}
      {output.orders ? <OrdersTable orders={output.orders} /> : null}
      {output.login ? (
        output.login.ok && output.call ? (
          <details className="text-[12.5px]">
            <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
              Đăng nhập lấy token: thành công ({output.login.response.durationMs} ms), bấm để xem
            </summary>
            <div className="mt-2">
              <ExchangeView title="Đăng nhập" exchange={output.login} source="LOGIN" />
            </div>
          </details>
        ) : (
          <ExchangeView title="Đăng nhập" exchange={output.login} source="LOGIN" />
        )
      ) : null}
      {output.call ? <ExchangeView title="Phản hồi" exchange={output.call} source={source} /> : null}
      {onUseAsSample && response?.ok ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onUseAsSample(response.httpStatus, response.body)}
        >
          <FlaskConical aria-hidden />
          Dùng làm phản hồi mẫu
        </Button>
      ) : null}
    </div>
  );
}

const ANY_ACTION = "__any";

function localInput(ms: number): string {
  const date = new Date(ms - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

const NO_EXTRA = "__none__";

export function LiveCall({
  supplierId,
  supplierCode,
  baseUrl,
  kind,
  request,
  actions,
  extraFields = [],
  submitRequest,
  buildParams,
  draftSecrets,
  onUseAsSample,
}: {
  supplierId: string;
  supplierCode: string;
  baseUrl: string;
  kind: LiveCallKind;
  request: RequestSpec;
  actions: string[];
  extraFields?: ExtraField[];
  submitRequest?: RequestSpec;
  buildParams: () => IntegrationParams;
  draftSecrets: () => Record<string, string> | undefined;
  onUseAsSample?: (httpStatus: number, body: unknown) => void;
}) {
  const [transCode, setTransCode] = useState("");
  const [supplierTransId, setSupplierTransId] = useState("");
  const [action, setAction] = useState(kind === "CHECK" ? (actions[0] ?? "") : ANY_ACTION);
  const [packageCode, setPackageCode] = useState("");
  const [phone, setPhone] = useState("");
  const [serial, setSerial] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const chosenForExtra = action === ANY_ACTION ? null : action;
  const extraInputs = extraFields.filter(
    (field) => field.key && (!chosenForExtra || field.actions.length === 0 || field.actions.includes(chosenForExtra)),
  );
  const extraValue = Object.fromEntries(
    extraInputs
      .map((field): [string, unknown] => {
        const raw = (extra[field.key] ?? "").trim();
        if (!raw) return [field.key, ""];
        if (field.type === "NUMBER") return [field.key, Number(raw)];
        if (field.type === "TEXT_LIST")
          return [
            field.key,
            raw
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          ];
        return [field.key, raw];
      })
      .filter(([, value]) => value !== ""),
  );
  const [from, setFrom] = useState(() => localInput(Date.now() - 86_400_000));
  const [to, setTo] = useState(() => localInput(Date.now()));
  const recent = useOrders({ supplierCode, limit: 10 }, kind === "QUERY");
  const recentOrders = recent.data?.data ?? [];
  const sameAsSubmit =
    kind === "CHECK" &&
    submitRequest !== undefined &&
    submitRequest.method === request.method &&
    submitRequest.path === request.path;
  const methodAllowed = kind === "CHECK" ? !sameAsSubmit : request.method === "GET";
  const chosenAction = action === ANY_ACTION ? undefined : action || undefined;

  const run = useMutation({
    mutationFn: () =>
      callIntegration(supplierId, {
        params: buildParams() as unknown as Record<string, unknown>,
        kind,
        order:
          kind === "QUERY"
            ? { transCode: transCode.trim(), supplierTransId: supplierTransId.trim() || undefined }
            : kind === "PACKAGES" || kind === "CHECK"
              ? {
                  action: chosenAction,
                  packageCode: packageCode.trim() || undefined,
                  phone: phone.trim() || undefined,
                  serial: serial.trim() || undefined,
                  extra: extraValue,
                }
              : undefined,
        range: kind === "ORDERS" ? { from: new Date(from).toISOString(), to: new Date(to).toISOString() } : undefined,
        secrets: draftSecrets(),
      }),
  });

  const blocker = !request.path
    ? "Nhập đường dẫn trước khi gọi thử."
    : !methodAllowed
      ? sameAsSubmit
        ? "API kiểm tra đang trùng API đăng ký gói; gọi thử sẽ tạo đơn thật nên không gọi."
        : `Chỉ gọi thử được request GET; request này đang là ${request.method} nên có thể làm thay đổi dữ liệu phía nhà cung cấp.`
      : kind === "QUERY" && !transCode.trim()
        ? "Nhập mã đơn của Hub (hoặc chọn đơn gần đây) để kiểm tra."
        : kind === "CHECK" && !packageCode.trim()
          ? "Nhập mã gói cần kiểm tra."
          : null;
  const inputClass = "h-8 font-mono text-[13px]";

  return (
    <div className="grid grid-cols-1 gap-3">
      {kind === "PACKAGES" || kind === "CHECK" ? (
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8 text-[13px]" aria-label="Thao tác">
              <SelectValue placeholder="Thao tác" />
            </SelectTrigger>
            <SelectContent>
              {kind === "PACKAGES" ? <SelectItem value={ANY_ACTION}>Mọi thao tác</SelectItem> : null}
              {actions.map((item) => (
                <SelectItem key={item} value={item}>
                  {actionLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kind === "CHECK" ? (
            <Input
              value={packageCode}
              onChange={(event) => setPackageCode(event.target.value)}
              placeholder="Mã gói"
              aria-label="Mã gói cần kiểm tra"
              spellCheck={false}
              className={inputClass}
            />
          ) : null}
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Số thuê bao (nếu cần)"
            aria-label="Số thuê bao"
            inputMode="tel"
            className={inputClass}
          />
          <Input
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            placeholder="Serial (nếu cần)"
            aria-label="Serial SIM"
            spellCheck={false}
            className={inputClass}
          />
          {extraInputs.map((field) =>
            field.options.length > 0 && field.type === "TEXT" ? (
              <Select
                key={field.key}
                value={extra[field.key] || NO_EXTRA}
                onValueChange={(value) =>
                  setExtra((current) => ({ ...current, [field.key]: value === NO_EXTRA ? "" : value }))
                }
              >
                <SelectTrigger className="h-8 text-[13px]" aria-label={field.label || field.key}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EXTRA}>{`${field.label || field.key}: không gửi`}</SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {`${field.label || field.key}: ${option}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                key={field.key}
                value={extra[field.key] ?? ""}
                onChange={(event) => setExtra((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={`${field.label || field.key} (extra.${field.key})${field.type === "TEXT_LIST" ? ", cách nhau dấu phẩy" : ""}`}
                aria-label={field.label || field.key}
                spellCheck={false}
                className={inputClass}
              />
            ),
          )}
        </div>
      ) : null}
      {kind === "ORDERS" ? (
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Từ
            <Input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-muted-foreground">
            Đến
            <Input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      ) : null}
      {kind === "QUERY" ? (
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            value={transCode}
            onChange={(event) => setTransCode(event.target.value)}
            placeholder="Mã đơn Hub (TX...)"
            aria-label="Mã đơn của Hub để tra cứu"
            spellCheck={false}
            className={inputClass}
          />
          <Input
            value={supplierTransId}
            onChange={(event) => setSupplierTransId(event.target.value)}
            placeholder="Mã đơn NCC"
            aria-label="Mã đơn phía nhà cung cấp"
            spellCheck={false}
            className={inputClass}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={recentOrders.length === 0}>
                <History aria-hidden />
                Đơn gần đây
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Chọn một đơn của nhà cung cấp này</DropdownMenuLabel>
              {recentOrders.map((order) => (
                <DropdownMenuItem
                  key={order.transCode}
                  onSelect={() => {
                    setTransCode(order.transCode);
                    setSupplierTransId(order.supplierTransId ?? "");
                  }}
                >
                  <span className="font-mono text-[12px]">{order.transCode}</span>
                  <span className="ml-auto pl-3 text-[11.5px] text-muted-foreground">
                    {ORDER_STATUS_META[order.status].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run.mutate()}
          isLoading={run.isPending}
          disabled={blocker !== null}
        >
          {run.isPending ? null : <Play aria-hidden />}
          Gọi thử
        </Button>
        <p className={blocker && !methodAllowed ? "text-[12px] text-warning" : "text-[12px] text-muted-foreground"}>
          {blocker ??
            `Gọi thật tới ${hostOf(baseUrl, request.path)} bằng bản đang sửa (chưa cần lưu). ${
              kind === "CHECK" && request.method !== "GET"
                ? "Dùng " + request.method + " nhưng chỉ để hỏi, không tạo đơn."
                : "Chỉ đọc, không tạo đơn."
            }`}
        </p>
      </div>
      {run.isError ? <p className="text-[12.5px] text-danger">{getErrorMessage(run.error)}</p> : null}
      {run.data ? <ResultView output={run.data} source={kind} onUseAsSample={onUseAsSample} /> : null}
    </div>
  );
}
