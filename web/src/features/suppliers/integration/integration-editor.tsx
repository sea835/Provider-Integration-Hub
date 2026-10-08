"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronsDownUp, ChevronsUpDown, ClipboardCopy, FileJson } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/api/errors";
import { formatRelative } from "@/lib/format";
import { previewIntegration } from "../api";
import { useUpdateSupplier } from "../hooks";
import type { Supplier } from "../types";
import { ApiTab } from "./api-tab";
import { ConnectionTab, type Row } from "./connection-tab";
import type { OrderContainer, VariableOptions } from "./fields";
import { PathPickerProvider } from "./path-picker";
import { emptySamples, PreviewPanel, type PreviewKind, type PreviewSample } from "./preview-panel";
import {
  INTEGRATION_TABS,
  SECTION_IDS,
  sectionDomId,
  sectionOfProblem,
  tabOfSection,
  useStoredString,
  type EditorKit,
  type IntegrationTabId,
  type SectionId,
} from "./section";
import { setIn, toIntegrationParams, type Path } from "./state";
import { StatusTab } from "./status-tab";
import type { IntegrationParams } from "./types";

const COLLAPSED_KEY = "hub.integration-editor.collapsed";
const TAB_KEY = "hub.integration-editor.tab";

function parseCollapsed(raw: string): SectionId[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is SectionId => SECTION_IDS.includes(item as SectionId))
      : [];
  } catch {
    return [];
  }
}

function cleanConditions(params: IntegrationParams): IntegrationParams {
  const json = JSON.stringify(params, (key, value: unknown) =>
    key === "values" && Array.isArray(value) ? value.filter((item) => item !== "") : value,
  );
  return JSON.parse(json) as IntegrationParams;
}

function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (params: IntegrationParams) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    try {
      const raw = JSON.parse(text) as unknown;
      onImport(toIntegrationParams(raw));
      setText("");
      setError(null);
      onOpenChange(false);
    } catch {
      setError("Nội dung không phải JSON hợp lệ");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập bản tích hợp từ JSON</DialogTitle>
          <DialogDescription>
            Dán JSON gồm vars, secretKeys, spec (vd bản xuất từ một nhà cung cấp khác). Bí mật không nằm trong JSON, bạn
            nhập lại sau.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            spellCheck={false}
            className="font-mono text-[12px]"
            aria-label="JSON bản tích hợp"
          />
          {error ? <p className="mt-2 text-[12.5px] text-danger">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={!text.trim()}>
            Nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationEditor({ supplier }: { supplier: Supplier }) {
  const updateSupplier = useUpdateSupplier(supplier.id);
  const initial = useMemo(() => toIntegrationParams(supplier.params), [supplier.params]);
  const [draft, setDraft] = useState<IntegrationParams>(initial);
  const [vars, setVars] = useState<Row[]>(() => Object.entries(initial.vars).map(([name, value]) => ({ name, value })));
  const [replaceSecrets, setReplaceSecrets] = useState(!supplier.hasSecrets);
  const [secretRows, setSecretRows] = useState<Row[]>(() =>
    initial.secretKeys.length > 0 ? initial.secretKeys.map((name) => ({ name, value: "" })) : [],
  );
  const [importOpen, setImportOpen] = useState(false);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("SUBMIT");
  const [samples, setSamples] = useState<Record<PreviewKind, PreviewSample>>(emptySamples);

  const buildParams = (): IntegrationParams =>
    cleanConditions({
      vars: Object.fromEntries(vars.filter((row) => row.name).map((row) => [row.name, row.value])),
      secretKeys: replaceSecrets ? secretRows.filter((row) => row.name).map((row) => row.name) : draft.secretKeys,
      spec: draft.spec,
    });

  const current = buildParams();
  const currentJson = JSON.stringify(current);
  const dirty =
    currentJson !== JSON.stringify(cleanConditions(initial)) || (replaceSecrets && secretRows.some((row) => row.value));

  const [debounced, setDebounced] = useState(currentJson);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(currentJson), 600);
    return () => clearTimeout(timer);
  }, [currentJson]);
  const check = useQuery({
    queryKey: ["integration-check", supplier.id, supplier.baseUrl, debounced],
    queryFn: () =>
      previewIntegration({
        baseUrl: supplier.baseUrl,
        params: JSON.parse(debounced) as Record<string, unknown>,
        kind: "TEST",
      }),
  });
  const problems = [...(check.data?.issues ?? []), ...(check.data?.warnings ?? [])];
  const problemSection = (problem: string) => sectionOfProblem(problem);
  const sectionProblems = (id: SectionId) => problems.filter((problem) => problemSection(problem) === id).length;
  const tabProblems = (tab: IntegrationTabId) =>
    problems.filter((problem) => {
      const id = problemSection(problem);
      return id !== null && tabOfSection(id) === tab;
    }).length;

  const [storedTab, storeTab] = useStoredString(TAB_KEY);
  const tab: IntegrationTabId = INTEGRATION_TABS.some((item) => item.id === storedTab)
    ? (storedTab as IntegrationTabId)
    : "connection";
  const activeTab = INTEGRATION_TABS.find((item) => item.id === tab) ?? INTEGRATION_TABS[0];
  const [collapsedRaw, storeCollapsed] = useStoredString(COLLAPSED_KEY);
  const collapsed = useMemo(() => parseCollapsed(collapsedRaw), [collapsedRaw]);
  const updateCollapsed = (next: SectionId[]) => storeCollapsed(JSON.stringify(next));
  const tabSections: readonly SectionId[] = activeTab.sections;
  const allCollapsed = tabSections.every((id) => collapsed.includes(id));

  const reveal = (id: SectionId) => {
    storeTab(tabOfSection(id));
    updateCollapsed(collapsed.filter((item) => item !== id));
    window.setTimeout(
      () => document.getElementById(sectionDomId(id))?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };

  const spec = draft.spec;
  const variables: VariableOptions = {
    vars: current.vars ? Object.keys(current.vars) : [],
    secrets: current.secretKeys,
    token: spec.token.enabled,
    extra: spec.extraFields.map((field) => ({ key: field.key, label: field.label })),
  };
  const setSpec = (path: Path, value: unknown) => setDraft((state) => setIn(state, ["spec", ...path], value));
  const ordersList: OrderContainer = {
    path: spec.orders.listPath,
    label: "Vị trí danh sách đơn",
    adopt: (path) => setSpec(["orders", "listPath"], path),
  };
  const kit: EditorKit = {
    supplier,
    spec,
    set: setSpec,
    variables,
    loginVariables: { ...variables, token: false },
    orderBases: [spec.query.orderPath, spec.submit.orderPath, spec.callback.orderPath, spec.orders.listPath],
    orderContainer: (source) => {
      if (source === "ORDERS" || (source === "QUERY" && spec.query.source === "ORDERS")) return ordersList;
      if (source === "QUERY") return { path: spec.query.orderPath, label: "Vị trí đơn khi tra cứu" };
      if (source === "SUBMIT") return { path: spec.submit.orderPath, label: "Vị trí đơn khi gửi đơn" };
      if (source === "CALLBACK") return { path: spec.callback.orderPath, label: "Vị trí đơn trong callback" };
      if (source === null && (spec.query.source === "ORDERS" || spec.orders.enabled)) return ordersList;
      return null;
    },
    packagesContainer: () => ({
      path: spec.packages.listPath,
      label: "Vị trí danh sách gói",
      adopt: (path) => setSpec(["packages", "listPath"], path),
    }),
    ordersContainer: () => ordersList,
    section: (id) => ({
      id,
      open: !collapsed.includes(id),
      onOpenChange: (open) => updateCollapsed(open ? collapsed.filter((item) => item !== id) : [...collapsed, id]),
      problems: sectionProblems(id),
    }),
    reveal,
  };

  const reset = () => {
    setDraft(initial);
    setVars(Object.entries(initial.vars).map(([name, value]) => ({ name, value })));
    setReplaceSecrets(!supplier.hasSecrets);
    setSecretRows(initial.secretKeys.map((name) => ({ name, value: "" })));
  };

  const save = () => {
    if (replaceSecrets && secretRows.some((row) => !row.name || !row.value)) {
      toast.error("Bí mật chưa đủ", { description: "Mỗi bí mật cần có tên và giá trị, hoặc xoá dòng thừa." });
      return;
    }
    updateSupplier.mutate(
      {
        params: current as unknown as Record<string, unknown>,
        ...(replaceSecrets ? { secrets: Object.fromEntries(secretRows.map((row) => [row.name, row.value])) } : {}),
      },
      {
        onSuccess: (updated) =>
          toast.success("Đã lưu bản tích hợp", {
            description: `Phiên bản ${updated.version}, có hiệu lực ngay, không cần deploy`,
          }),
        onError: (error) => toast.error("Không lưu được bản tích hợp", { description: getErrorMessage(error) }),
      },
    );
  };

  const onImport = (params: IntegrationParams) => {
    setDraft(params);
    setVars(Object.entries(params.vars).map(([name, value]) => ({ name, value })));
    const sameSecrets = [...params.secretKeys].sort().join(",") === [...draft.secretKeys].sort().join(",");
    if (!sameSecrets || !supplier.hasSecrets) {
      setReplaceSecrets(true);
      setSecretRows(params.secretKeys.map((name) => ({ name, value: "" })));
    }
    toast.success("Đã nhập bản tích hợp", { description: "Kiểm tra lại, nhập giá trị bí mật nếu cần, rồi bấm Lưu." });
  };

  const draftSecrets = () =>
    replaceSecrets
      ? Object.fromEntries(secretRows.filter((row) => row.name && row.value).map((row) => [row.name, row.value]))
      : undefined;

  const loadSample = (kind: "PACKAGES" | "CHECK" | "QUERY" | "ORDERS" | "TEST", httpStatus: number, body: unknown) => {
    setSamples((state) => ({
      ...state,
      [kind]: {
        httpStatus: String(httpStatus),
        body: typeof body === "string" ? body : JSON.stringify(body, null, 2),
      },
    }));
    setPreviewKind(kind);
    toast.success("Đã đưa phản hồi vào Phân loại thử", {
      description: "Mở tab Trạng thái & kết quả, bấm vào ô đường dẫn rồi bấm vào trường trong cây bên phải.",
    });
  };

  return (
    <PathPickerProvider>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Khai báo cách Hub gọi API của nhà cung cấp và cách đọc kết quả. Lưu là có hiệu lực ngay.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <FileJson aria-hidden />
                Nhập JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(JSON.stringify(current, null, 2))
                    .then(() => toast.success("Đã sao chép bản tích hợp (không gồm bí mật)"))
                    .catch(() => undefined)
                }
              >
                <ClipboardCopy aria-hidden />
                Sao chép JSON
              </Button>
            </div>
          </div>

          {problems.length > 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning-soft p-4" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="size-4" aria-hidden />
                Còn {problems.length} điểm cần hoàn thiện trước khi nhận đơn
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-6 text-[13px]">
                {problems.map((problem) => {
                  const target = problemSection(problem);
                  return (
                    <li key={problem}>
                      {target ? (
                        <button
                          type="button"
                          onClick={() => reveal(target)}
                          className="inline text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {problem}
                        </button>
                      ) : (
                        problem
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : check.isSuccess ? (
            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-[13px] text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Bản tích hợp đã đủ để chạy. Hãy gọi thử các API và Phân loại thử vài phản hồi mẫu trước khi bật.
            </p>
          ) : null}

          <Tabs value={tab} onValueChange={(value) => storeTab(value)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList aria-label="Phần của bản tích hợp">
                {INTEGRATION_TABS.map((item, index) => {
                  const count = tabProblems(item.id);
                  return (
                    <TabsTrigger key={item.id} value={item.id}>
                      <span className="font-mono text-[11.5px] text-muted-foreground">{index + 1}</span>
                      {item.label}
                      {count > 0 ? (
                        <Badge tone="warning" className="px-1.5">
                          {count}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateCollapsed(
                    allCollapsed
                      ? collapsed.filter((id) => !tabSections.includes(id))
                      : [...new Set([...collapsed, ...tabSections])],
                  )
                }
              >
                {allCollapsed ? <ChevronsUpDown aria-hidden /> : <ChevronsDownUp aria-hidden />}
                {allCollapsed ? "Mở tất cả" : "Thu gọn tất cả"}
              </Button>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">{activeTab.description}</p>
            <TabsContent value="connection" className="mt-4 grid grid-cols-1 gap-4">
              <ConnectionTab
                kit={kit}
                vars={vars}
                setVars={setVars}
                replaceSecrets={replaceSecrets}
                onReplaceSecrets={() => {
                  setReplaceSecrets(true);
                  setSecretRows(draft.secretKeys.map((name) => ({ name, value: "" })));
                }}
                secretRows={secretRows}
                setSecretRows={setSecretRows}
                savedSecretKeys={draft.secretKeys}
                secretCount={current.secretKeys.length}
              />
            </TabsContent>
            <TabsContent value="api" className="mt-4 grid grid-cols-1 gap-4">
              <ApiTab kit={kit} buildParams={buildParams} draftSecrets={draftSecrets} onUseAsSample={loadSample} />
            </TabsContent>
            <TabsContent value="status" className="mt-4 grid grid-cols-1 gap-4">
              <StatusTab kit={kit} />
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 px-5 py-3 shadow-soft backdrop-blur">
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {dirty ? (
                <span className="font-medium text-warning">Có thay đổi chưa lưu</span>
              ) : (
                `Cập nhật ${formatRelative(supplier.updatedAt)} · phiên bản ${supplier.version}`
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty || updateSupplier.isPending}>
                Hoàn tác
              </Button>
              <Button size="sm" onClick={save} disabled={!dirty} isLoading={updateSupplier.isPending}>
                Lưu bản tích hợp
              </Button>
            </div>
          </div>
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <PreviewPanel
            baseUrl={supplier.baseUrl}
            buildParams={buildParams}
            onImportIntegration={onImport}
            kind={previewKind}
            onKindChange={setPreviewKind}
            samples={samples}
            onSamplesChange={setSamples}
          />
        </div>
      </div>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={onImport} />
    </PathPickerProvider>
  );
}
