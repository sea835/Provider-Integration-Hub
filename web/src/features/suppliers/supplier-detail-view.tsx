"use client";

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CirclePause,
  CircleSlash,
  Inbox,
  MoreHorizontal,
  Play,
  PlugZap,
  Settings2,
  Webhook,
  Workflow,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { actionLabel, callbackUrlOf, HUB_PUBLIC_URL, SUPPLIER_STATUS_META } from "./constants";
import { CopyButton } from "./copy-button";
import { useAdapterTypes, useSupplier, useTestConnection, useUpdateSupplier } from "./hooks";
import { IntegrationEditor } from "./integration/integration-editor";
import { toIntegrationParams } from "./integration/state";
import { SupplierForm, toUpdateInput } from "./supplier-form";
import { SupplierNccOrders } from "./supplier-ncc-orders";
import { SupplierOrders } from "./supplier-orders";
import { AdapterBadge, SupplierStatusBadge } from "./supplier-visuals";
import type { AdapterType, ConnectionTestResult, Supplier, SupplierStatus } from "./types";

const TABS = ["overview", "integration", "orders", "settings"] as const;
type TabValue = (typeof TABS)[number];

interface LastTest {
  version: number;
  result: ConnectionTestResult;
  at: string;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

function ConnectionCard({
  supplier,
  lastTest,
  onTest,
  isTesting,
}: {
  supplier: Supplier;
  lastTest: LastTest | null;
  onTest: () => void;
  isTesting: boolean;
}) {
  const result = lastTest?.result;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Kết nối</CardTitle>
          <CardDescription>Hub gọi thử nhà cung cấp bằng cấu hình đang lưu, không tạo đơn.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onTest} isLoading={isTesting}>
          {isTesting ? null : <PlugZap aria-hidden />}
          Thử kết nối
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg p-3.5",
            !result ? "bg-muted" : result.ok ? "bg-success-soft" : "bg-danger-soft",
          )}
          aria-live="polite"
        >
          {!result ? (
            <PlugZap className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          ) : result.ok ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {!result ? "Chưa thử kết nối" : result.ok ? "Kết nối thành công" : "Kết nối thất bại"}
            </p>
            <p className="mt-0.5 text-[13px] break-words text-muted-foreground">
              {!result
                ? "Bấm Thử kết nối để kiểm tra địa chỉ API và thông tin xác thực."
                : `${result.message} · ${result.latencyMs} ms · ${formatRelative(lastTest.at)}`}
            </p>
          </div>
        </div>
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Địa chỉ API</dt>
            <dd className="truncate font-mono text-[12.5px]" title={supplier.baseUrl}>
              {supplier.baseUrl}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chờ gửi đơn / tra cứu</dt>
            <dd className="tabular-nums">
              {supplier.submitTimeoutMs / 1000} giây / {supplier.queryTimeoutMs / 1000} giây
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Giới hạn</dt>
            <dd className="tabular-nums">
              {supplier.rateLimitPerMin} lời gọi/phút · {supplier.concurrency} song song
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Lịch tra cứu (giây)</dt>
            <dd className="font-mono text-[12.5px]">{supplier.pollScheduleSec.join(", ")}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function CallbackCard({ supplier, adapter }: { supplier: Supplier; adapter: AdapterType | undefined }) {
  const url = callbackUrlOf(supplier.code);
  const isLocal = /localhost|127\.0\.0\.1/.test(HUB_PUBLIC_URL);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Callback</CardTitle>
          <CardDescription>Địa chỉ nhà cung cấp gọi về khi đơn có kết quả.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adapter && !adapter.callback ? (
          <p className="text-sm text-muted-foreground">
            Loại kết nối này không nhận callback. Hub tự tra cứu kết quả theo lịch.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-subtle p-3">
              <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all">{url}</code>
              <CopyButton value={url} />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>Gửi địa chỉ này cho nhà cung cấp để đăng ký callback.</li>
              {supplier.callbackIpWhitelist.length > 0 ? (
                <li>Chỉ nhận từ {supplier.callbackIpWhitelist.length} IP đã khai báo trong phần Cấu hình.</li>
              ) : adapter?.editor === "HTTP_CONFIG" ? (
                <li className="text-warning">
                  Chưa khai báo IP được phép gửi callback (tab Cấu hình, phần Nâng cao): mọi callback sẽ bị từ chối.
                </li>
              ) : (
                <li>Callback phải có chữ ký đúng với Secret kiểm callback, nếu không sẽ bị từ chối.</li>
              )}
              <li>Mất callback không mất đơn: Hub vẫn tra cứu định kỳ.</li>
              {isLocal ? (
                <li className="text-warning">
                  Địa chỉ đang là localhost. Khi chạy thật, đặt NEXT_PUBLIC_HUB_PUBLIC_URL thành domain public của Hub.
                </li>
              ) : null}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StoreExampleCard({ supplier, adapter }: { supplier: Supplier; adapter: AdapterType | undefined }) {
  const actions =
    adapter?.editor === "HTTP_CONFIG" ? toIntegrationParams(supplier.params).spec.actions : (adapter?.actions ?? []);
  const action = actions[0] ?? "BUY_DATA";
  const extraFields =
    adapter?.editor === "HTTP_CONFIG"
      ? toIntegrationParams(supplier.params).spec.extraFields.filter(
          (field) => field.key && (field.actions.length === 0 || field.actions.includes(action)),
        )
      : [];
  const extraSample: Record<string, unknown> = { TEXT: "abc", NUMBER: 1, DATE: "2026-10-15", TEXT_LIST: ["8988..."] };
  const body = {
    requestId: "DON-0001",
    supplierCode: supplier.code,
    action,
    packageCode: "MA_GOI",
    ...(action === "ACTIVATE_SIM" ? { serial: "8984012601500769003" } : { phone: "0912345678" }),
    ...(extraFields.length > 0
      ? { extra: Object.fromEntries(extraFields.map((field) => [field.key, extraSample[field.type]])) }
      : {}),
  };
  const curl = `curl -X POST ${HUB_PUBLIC_URL}/v1/orders \\
  -H "x-api-key: <API key của Store>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Store gửi đơn tới nhà cung cấp này</CardTitle>
          <CardDescription>
            Store chỉ cần ghi đúng supplierCode. Thao tác hỗ trợ: {actions.map(actionLabel).join(", ") || "—"}.
          </CardDescription>
        </div>
        <CopyButton value={curl} label="Sao chép lệnh" />
      </CardHeader>
      <CardContent>
        <pre className="scrollbar-thin overflow-x-auto rounded-lg border bg-subtle p-3 font-mono text-[12px] leading-relaxed">
          {curl}
        </pre>
      </CardContent>
    </Card>
  );
}

export function SupplierDetailView({ id }: { id: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supplierQuery = useSupplier(id);
  const adapters = useAdapterTypes();
  const updateSupplier = useUpdateSupplier(id);
  const testConnection = useTestConnection(id);
  const [lastTest, setLastTest] = useState<LastTest | null>(null);
  const [pendingStatus, setPendingStatus] = useState<SupplierStatus | null>(null);
  const [warnActivate, setWarnActivate] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const requestedTab = searchParams.get("tab");
  const [tab, setTabState] = useState<TabValue>(
    TABS.includes(requestedTab as TabValue) ? (requestedTab as TabValue) : "overview",
  );
  const setTab = (value: string) => {
    setTabState(value as TabValue);
    const params = new URLSearchParams(window.location.search);
    if (value === "overview") params.delete("tab");
    else params.set("tab", value);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  const supplier = supplierQuery.data;
  const adapter = adapters.data?.find((item) => item.type === supplier?.adapterType);

  const runTest = () => {
    if (!supplier) return;
    const version = supplier.version;
    testConnection.mutate(undefined, {
      onSuccess: (result) => {
        setLastTest({ version, result, at: new Date().toISOString() });
        if (result.ok) toast.success("Kết nối thành công", { description: result.message });
        else toast.error("Kết nối thất bại", { description: result.message });
      },
      onError: (error) => toast.error("Không thử kết nối được", { description: getErrorMessage(error) }),
    });
  };

  const changeStatus = (status: SupplierStatus) => {
    setPendingStatus(status);
    updateSupplier.mutate(
      { status },
      {
        onSuccess: (updated) =>
          toast.success(`${SUPPLIER_STATUS_META[status].label}: ${updated.name}`, {
            description: SUPPLIER_STATUS_META[status].description,
          }),
        onError: (error) => toast.error("Không đổi được trạng thái", { description: getErrorMessage(error) }),
        onSettled: () => {
          setPendingStatus(null);
          setWarnActivate(false);
          setConfirmDisable(false);
        },
      },
    );
  };

  const requestActivate = () => {
    if (!supplier) return;
    const testedOk = lastTest?.result.ok && lastTest.version === supplier.version;
    if (testedOk) changeStatus("ACTIVE");
    else setWarnActivate(true);
  };

  if (supplierQuery.isPending) return <DetailSkeleton />;

  if (supplierQuery.isError || !supplier) {
    const notFound = isApiError(supplierQuery.error) && supplierQuery.error.status === 404;
    return (
      <Card>
        {notFound ? (
          <EmptyState
            icon={PlugZap}
            title="Không tìm thấy nhà cung cấp"
            description="Đường dẫn có thể không chính xác."
            action={
              <Button asChild variant="outline">
                <Link href="/suppliers">
                  <ArrowLeft aria-hidden />
                  Về danh sách
                </Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={supplierQuery.error} onRetry={() => void supplierQuery.refetch()} />
        )}
      </Card>
    );
  }

  const isChanging = updateSupplier.isPending && pendingStatus !== null;

  return (
    <div className="space-y-6">
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả nhà cung cấp
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
            <SupplierStatusBadge status={supplier.status} />
            <AdapterBadge label={adapter?.label ?? supplier.adapterType} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{supplier.code}</span>
            <span aria-hidden>·</span>
            <span>Phiên bản cấu hình {supplier.version}</span>
            <span aria-hidden>·</span>
            <span title={formatDateTime(supplier.updatedAt)}>Cập nhật {formatRelative(supplier.updatedAt)}</span>
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {SUPPLIER_STATUS_META[supplier.status].description}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={runTest} isLoading={testConnection.isPending}>
            {testConnection.isPending ? null : <PlugZap aria-hidden />}
            Thử kết nối
          </Button>
          {supplier.status === "ACTIVE" ? (
            <Button
              variant="outline"
              onClick={() => changeStatus("PAUSED")}
              isLoading={isChanging && pendingStatus === "PAUSED"}
            >
              {isChanging ? null : <CirclePause aria-hidden />}
              Tạm dừng
            </Button>
          ) : (
            <Button onClick={requestActivate} isLoading={isChanging && pendingStatus === "ACTIVE"}>
              {isChanging ? null : <Play aria-hidden />}
              Bật nhận đơn
            </Button>
          )}
          {supplier.status !== "DISABLED" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Thao tác khác">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem tone="danger" onSelect={() => setConfirmDisable(true)}>
                  <CircleSlash aria-hidden />
                  Ngừng hẳn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity aria-hidden />
            Tổng quan
          </TabsTrigger>
          {adapter?.editor === "HTTP_CONFIG" ? (
            <TabsTrigger value="integration">
              <Workflow aria-hidden />
              Tích hợp
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="orders">
            <Inbox aria-hidden />
            Đơn hàng
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 aria-hidden />
            Cấu hình
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <ConnectionCard
              supplier={supplier}
              lastTest={lastTest}
              onTest={runTest}
              isTesting={testConnection.isPending}
            />
            <CallbackCard supplier={supplier} adapter={adapter} />
          </div>
          <StoreExampleCard supplier={supplier} adapter={adapter} />
        </TabsContent>

        {adapter?.editor === "HTTP_CONFIG" ? (
          <TabsContent value="integration" forceMount className="data-[state=inactive]:hidden">
            <IntegrationEditor key={supplier.updatedAt} supplier={supplier} />
          </TabsContent>
        ) : null}

        <TabsContent value="orders" className="grid grid-cols-1 gap-6">
          <Card className="overflow-hidden">
            <SupplierOrders supplierCode={supplier.code} />
          </Card>
          <SupplierNccOrders supplier={supplier} />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="overflow-hidden">
            {adapters.isPending ? (
              <div className="space-y-3 p-6" aria-hidden>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : adapters.isError ? (
              <ErrorState error={adapters.error} onRetry={() => void adapters.refetch()} />
            ) : !adapter ? (
              <EmptyState
                icon={Webhook}
                title="Loại kết nối không còn được hỗ trợ"
                description={`Hệ thống không có adapter ${supplier.adapterType}.`}
              />
            ) : (
              <SupplierForm
                key={supplier.updatedAt}
                id="supplier-settings"
                mode="edit"
                adapters={adapters.data}
                supplier={supplier}
                bodyClassName="p-5 sm:p-6"
                onSubmit={(values, selected) =>
                  updateSupplier.mutateAsync(toUpdateInput(values, selected)).then(
                    (updated) =>
                      toast.success("Đã lưu cấu hình", {
                        description: `Phiên bản ${updated.version}, có hiệu lực ngay, không cần deploy`,
                      }),
                    (error: unknown) => {
                      toast.error("Không lưu được cấu hình", { description: getErrorMessage(error) });
                      throw error;
                    },
                  )
                }
                footer={({ isSubmitting, isDirty, reset }) => (
                  <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-card/95 px-5 py-3 backdrop-blur">
                    <p className="text-[13px] text-muted-foreground" aria-live="polite">
                      {isDirty ? (
                        <span className="font-medium text-warning">Có thay đổi chưa lưu</span>
                      ) : (
                        `Cập nhật ${formatRelative(supplier.updatedAt)}`
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                        disabled={!isDirty || isSubmitting}
                      >
                        Hoàn tác
                      </Button>
                      <Button type="submit" size="sm" disabled={!isDirty} isLoading={isSubmitting}>
                        Lưu cấu hình
                      </Button>
                    </div>
                  </div>
                )}
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={warnActivate}
        onOpenChange={setWarnActivate}
        title="Chưa thử kết nối thành công"
        description={
          lastTest && lastTest.version === supplier.version && !lastTest.result.ok
            ? `Lần thử gần nhất thất bại: ${lastTest.result.message}. Bật lúc này, đơn của Store có thể thất bại hoặc chờ lâu. Vẫn bật?`
            : "Cấu hình hiện tại chưa được thử kết nối. Nên bấm Thử kết nối trước. Vẫn bật nhận đơn?"
        }
        confirmLabel="Vẫn bật"
        isPending={isChanging}
        onConfirm={() => changeStatus("ACTIVE")}
      />
      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={`Ngừng hẳn “${supplier.name}”?`}
        description="Hub không nhận đơn mới và ngừng xử lý cả các đơn đang dở của nhà cung cấp này. Chỉ dùng khi không còn đơn đang xử lý. Muốn tạm nghỉ thì dùng Tạm dừng."
        confirmLabel="Ngừng hẳn"
        tone="danger"
        isPending={isChanging}
        onConfirm={() => changeStatus("DISABLED")}
      />
    </div>
  );
}
