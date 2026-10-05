"use client";

import { CheckCircle2, RotateCcw, Search, XCircle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldControlProps } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_META } from "./constants";
import { useLookupOrder, useRecheckOrder, useResolveOrder } from "./hooks";
import {
  DELIVERY_FIELDS,
  type AdminOrder,
  type DeliveryField,
  type LookupOutcome,
  type OrderDelivery,
  type OrderLookup,
} from "./types";

type ResolveMode = "SUCCESS" | "FAILED";

const ERROR_CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,50}$/;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export const DELIVERY_LABELS: Record<DeliveryField, string> = {
  msisdn: "Số thuê bao",
  serial: "Serial",
  lpa: "Mã kích hoạt eSIM (LPA)",
  qrUrl: "Link QR eSIM",
};

const OUTCOME_META: Record<LookupOutcome, { label: string; tone: BadgeTone; hint: string }> = {
  SUCCESS: {
    label: "NCC báo thành công",
    tone: "success",
    hint: "Nhà cung cấp xác nhận đơn đã thực hiện xong.",
  },
  FAILED: {
    label: "NCC báo thất bại",
    tone: "danger",
    hint: "Nhà cung cấp xác nhận đơn không thực hiện được.",
  },
  PENDING: {
    label: "NCC đang xử lý",
    tone: "info",
    hint: "Nhà cung cấp chưa xong. Nên chờ thêm rồi hỏi lại, chưa nên chốt.",
  },
  UNKNOWN: {
    label: "Chưa rõ kết quả",
    tone: "warning",
    hint: "Hub không đọc ra kết quả chắc chắn. Xem phản hồi bên dưới; nếu phản hồi đúng mà Hub đọc sai thì kiểm tra tab Trạng thái & kết quả của nhà cung cấp.",
  },
  NOT_FOUND: {
    label: "NCC không thấy đơn",
    tone: "neutral",
    hint: "Nhà cung cấp không có đơn này, thường là đơn chưa tới được NCC. Nếu chắc chắn, có thể chốt thất bại để Store gửi lại đơn mới.",
  },
};

const OUTCOME_OF_STATUS: Partial<Record<string, LookupOutcome>> = {
  COMPLETED: "SUCCESS",
  FAILED: "FAILED",
};

interface ResolveDraft {
  mode: ResolveMode;
  reason: string;
  errorCode: string;
  supplierTransId: string;
  delivery: Record<DeliveryField, string>;
}

function emptyDelivery(): Record<DeliveryField, string> {
  return { msisdn: "", serial: "", lpa: "", qrUrl: "" };
}

function initialDraft(order: AdminOrder): ResolveDraft {
  return {
    mode: "SUCCESS",
    reason: "",
    errorCode: "",
    supplierTransId: order.supplierTransId ?? "",
    delivery: { ...emptyDelivery(), ...pickDelivery(order.delivery) },
  };
}

function pickDelivery(source: Record<string, string> | OrderDelivery | null | undefined): OrderDelivery {
  const picked: OrderDelivery = {};
  if (!source) return picked;
  for (const field of DELIVERY_FIELDS) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) picked[field] = value;
  }
  return picked;
}

export function DeliveryList({
  supplierTransId,
  delivery,
}: {
  supplierTransId: string | null;
  delivery: OrderDelivery;
}) {
  const rows: Array<[string, string]> = [
    ...(supplierTransId ? [["Mã đơn phía NCC", supplierTransId] as [string, string]] : []),
    ...DELIVERY_FIELDS.flatMap((field) => {
      const value = delivery[field];
      return value ? [[DELIVERY_LABELS[field], value] as [string, string]] : [];
    }),
  ];
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono text-[12.5px] break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="rounded-md border bg-subtle">
      <summary className="cursor-pointer px-3 py-1.5 text-[12px] font-medium text-muted-foreground select-none hover:text-foreground">
        {label}
      </summary>
      <pre className="max-h-64 scrollbar-thin overflow-auto border-t px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function LookupResult({
  lookup,
  order,
  canResolve,
  onApply,
}: {
  lookup: OrderLookup;
  order: AdminOrder;
  canResolve: boolean;
  onApply: () => void;
}) {
  const meta = OUTCOME_META[lookup.outcome];
  const expected = OUTCOME_OF_STATUS[order.status];
  const mismatch =
    expected !== undefined &&
    (lookup.outcome === "SUCCESS" || lookup.outcome === "FAILED") &&
    lookup.outcome !== expected;
  const decisive = lookup.outcome === "SUCCESS" || lookup.outcome === "FAILED";

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span className="text-[12px] text-muted-foreground">
          {formatDateTime(lookup.checkedAt)}
          {lookup.httpStatus ? ` · HTTP ${lookup.httpStatus}` : ""} · {lookup.durationMs} ms
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground">{meta.hint}</p>
      {mismatch ? (
        <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">
          Khác với Hub: đơn đang lưu là {ORDER_STATUS_META[order.status].label.toLowerCase()}. Đơn đã ở trạng thái cuối
          nên không chốt lại được; cần xử lý với nhà cung cấp và Store.
        </p>
      ) : null}
      <DeliveryList supplierTransId={lookup.supplierTransId} delivery={pickDelivery(lookup.delivery)} />
      {lookup.error ? (
        <p className="text-[13px] text-danger">
          <span className="font-mono">{lookup.error.code}</span>: {lookup.error.message}
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <Json label="Request gửi nhà cung cấp" value={lookup.request} />
        <Json label="Phản hồi của nhà cung cấp" value={lookup.response} />
      </div>
      {canResolve && decisive ? (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={onApply}>
          Điền form chốt theo kết quả này
        </Button>
      ) : null}
    </div>
  );
}

function ModeButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "success" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30 [&_svg]:size-4",
        active
          ? tone === "success"
            ? "border-success/40 bg-success-soft text-success"
            : "border-danger/40 bg-danger-soft text-danger"
          : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function OrderReconcilePanel({ order }: { order: AdminOrder }) {
  const lookup = useLookupOrder();
  const resolve = useResolveOrder(order.transCode);
  const recheck = useRecheckOrder();
  const [draft, setDraft] = useState<ResolveDraft>(() => initialDraft(order));
  const [errors, setErrors] = useState<{ reason?: string; errorCode?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const canResolve = !TERMINAL_STATUSES.has(order.status);
  const idPrefix = `resolve-${order.transCode}`;

  const ask = () => {
    lookup.mutate(order.transCode, {
      onError: (error) => toast.error("Không hỏi được nhà cung cấp", { description: getErrorMessage(error) }),
    });
  };

  const reopen = () => {
    recheck.mutate(order.transCode, {
      onSuccess: () =>
        toast.success("Đã cho đơn tra cứu lại", {
          description: "Hub hỏi nhà cung cấp ngay, có kết quả cuối sẽ tự chốt",
        }),
      onError: (error) => toast.error("Không cho tra cứu lại được", { description: getErrorMessage(error) }),
    });
  };

  const applyLookup = () => {
    const result = lookup.data;
    if (!result || (result.outcome !== "SUCCESS" && result.outcome !== "FAILED")) return;
    setDraft((current) => ({
      mode: result.outcome as ResolveMode,
      reason: `Đối soát với NCC lúc ${formatDateTime(result.checkedAt)}: ${OUTCOME_META[result.outcome].label.toLowerCase()}`,
      errorCode: result.outcome === "FAILED" && result.error ? result.error.code : "",
      supplierTransId: result.supplierTransId ?? current.supplierTransId,
      delivery: { ...current.delivery, ...pickDelivery(result.delivery) },
    }));
    setErrors({});
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    reasonRef.current?.focus({ preventScroll: true });
  };

  const update = <K extends keyof ResolveDraft>(key: K, value: ResolveDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!draft.reason.trim()) next.reason = "Ghi lý do chốt để sau này tra lại";
    if (draft.mode === "FAILED" && draft.errorCode.trim() && !ERROR_CODE_PATTERN.test(draft.errorCode.trim())) {
      next.errorCode = "Mã lỗi viết liền, chỉ gồm chữ, số và _ . : -, tối đa 50 ký tự";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    const delivery = pickDelivery(draft.delivery);
    resolve.mutate(
      {
        outcome: draft.mode,
        reason: draft.reason.trim(),
        ...(draft.supplierTransId.trim() ? { supplierTransId: draft.supplierTransId.trim() } : {}),
        ...(draft.mode === "FAILED" && draft.errorCode.trim() ? { errorCode: draft.errorCode.trim() } : {}),
        ...(draft.mode === "SUCCESS" && Object.keys(delivery).length > 0 ? { delivery } : {}),
      },
      {
        onSuccess: (updated) => {
          setConfirming(false);
          toast.success(draft.mode === "SUCCESS" ? "Đã chốt đơn thành công" : "Đã chốt đơn thất bại", {
            description: `${updated.transCode} · Store tra cứu đơn sẽ thấy kết quả mới`,
          });
        },
        onError: (error) => {
          setConfirming(false);
          toast.error("Không chốt được đơn", { description: getErrorMessage(error) });
        },
      },
    );
  };

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border bg-subtle/50 p-4" aria-labelledby={`${idPrefix}-lookup`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 id={`${idPrefix}-lookup`} className="text-sm font-semibold">
              Đối soát với nhà cung cấp
            </h3>
            <p className="text-[13px] text-muted-foreground">
              Hỏi ngay nhà cung cấp đơn này đang thế nào. Chỉ xem, chưa đổi trạng thái đơn.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={ask} isLoading={lookup.isPending}>
            {lookup.isPending ? null : <Search aria-hidden />}
            {lookup.data ? "Hỏi lại" : "Hỏi nhà cung cấp"}
          </Button>
        </div>
        {lookup.data ? (
          <LookupResult lookup={lookup.data} order={order} canResolve={canResolve} onApply={applyLookup} />
        ) : null}
      </section>

      {order.status === "MANUAL_REVIEW" ? (
        <section className="grid gap-3 rounded-xl border p-4" aria-labelledby={`${idPrefix}-recheck`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64 space-y-1">
              <h3 id={`${idPrefix}-recheck`} className="text-sm font-semibold">
                Tra cứu lại tự động
              </h3>
              <p className="text-[13px] text-muted-foreground">
                Đơn quay về Đang xử lý: Hub hỏi nhà cung cấp ngay, chưa xong thì tự hỏi tiếp theo lịch tra cứu, thời
                gian chờ tính lại từ đầu. Có kết quả cuối là tự chốt. Không gửi lại đơn sang nhà cung cấp.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reopen} isLoading={recheck.isPending}>
              {recheck.isPending ? null : <RotateCcw aria-hidden />}
              Cho tra cứu lại
            </Button>
          </div>
        </section>
      ) : null}

      {canResolve ? (
        <form
          ref={formRef}
          noValidate
          className="grid scroll-mt-4 gap-4 rounded-xl border p-4"
          aria-labelledby={`${idPrefix}-title`}
          onSubmit={(event) => {
            event.preventDefault();
            if (validate()) setConfirming(true);
          }}
        >
          <div className="space-y-1">
            <h3 id={`${idPrefix}-title`} className="text-sm font-semibold">
              Chốt kết quả thủ công
            </h3>
            <p className="text-[13px] text-muted-foreground">
              Dùng khi đã biết chắc kết quả (từ bước đối soát ở trên, hoặc nhà cung cấp xác nhận qua kênh khác). Chốt
              xong là trạng thái cuối, Store tra cứu đơn sẽ thấy kết quả này.
            </p>
          </div>

          <div role="radiogroup" aria-label="Kết quả chốt" className="flex gap-2">
            <ModeButton active={draft.mode === "SUCCESS"} tone="success" onClick={() => update("mode", "SUCCESS")}>
              <CheckCircle2 aria-hidden />
              Thành công
            </ModeButton>
            <ModeButton active={draft.mode === "FAILED"} tone="danger" onClick={() => update("mode", "FAILED")}>
              <XCircle aria-hidden />
              Thất bại
            </ModeButton>
          </div>

          <div className="@container grid gap-4">
            <div className="grid gap-4 @md:grid-cols-2">
              <Field
                id={`${idPrefix}-supplier-trans-id`}
                label="Mã đơn phía NCC"
                hint="Không bắt buộc. Lưu lại để tra cứu về sau."
              >
                <Input
                  {...fieldControlProps(`${idPrefix}-supplier-trans-id`, undefined, "hint")}
                  value={draft.supplierTransId}
                  maxLength={100}
                  className="font-mono"
                  onChange={(event) => update("supplierTransId", event.target.value)}
                />
              </Field>
              {draft.mode === "FAILED" ? (
                <Field
                  id={`${idPrefix}-error-code`}
                  label="Mã lỗi trả Store"
                  hint="Để trống sẽ dùng OPERATOR_FAILED."
                  error={errors.errorCode}
                >
                  <Input
                    {...fieldControlProps(`${idPrefix}-error-code`, errors.errorCode, "hint")}
                    value={draft.errorCode}
                    maxLength={50}
                    placeholder="OPERATOR_FAILED"
                    className="font-mono"
                    onChange={(event) => update("errorCode", event.target.value)}
                  />
                </Field>
              ) : (
                DELIVERY_FIELDS.map((field) => (
                  <Field key={field} id={`${idPrefix}-${field}`} label={DELIVERY_LABELS[field]}>
                    <Input
                      id={`${idPrefix}-${field}`}
                      value={draft.delivery[field]}
                      maxLength={field === "qrUrl" ? 1000 : field === "lpa" ? 500 : 100}
                      className="font-mono"
                      onChange={(event) => update("delivery", { ...draft.delivery, [field]: event.target.value })}
                    />
                  </Field>
                ))
              )}
            </div>
            <Field id={`${idPrefix}-reason`} label="Lý do" required error={errors.reason}>
              <Textarea
                {...fieldControlProps(`${idPrefix}-reason`, errors.reason)}
                ref={reasonRef}
                rows={2}
                maxLength={500}
                value={draft.reason}
                placeholder="Ví dụ: NCC xác nhận qua Zalo lúc 10:30, đơn đã kích hoạt"
                onChange={(event) => update("reason", event.target.value)}
              />
            </Field>
          </div>

          <Button
            type="submit"
            variant={draft.mode === "SUCCESS" ? "default" : "destructive"}
            className="justify-self-end"
            disabled={resolve.isPending}
          >
            {draft.mode === "SUCCESS" ? "Chốt thành công" : "Chốt thất bại"}
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={draft.mode === "SUCCESS" ? "Chốt đơn thành công?" : "Chốt đơn thất bại?"}
        description={
          <>
            Đơn <span className="font-mono">{order.transCode}</span> sẽ chuyển sang{" "}
            {draft.mode === "SUCCESS" ? "thành công" : "thất bại"}, Store tra cứu đơn sẽ thấy kết quả này. Không hoàn
            tác được.
          </>
        }
        confirmLabel={draft.mode === "SUCCESS" ? "Chốt thành công" : "Chốt thất bại"}
        tone={draft.mode === "SUCCESS" ? "default" : "danger"}
        isPending={resolve.isPending}
        onConfirm={submit}
      />
    </div>
  );
}
