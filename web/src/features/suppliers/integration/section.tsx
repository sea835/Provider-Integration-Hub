"use client";

import { AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import { Collapsible } from "radix-ui";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Supplier } from "../types";
import type { ContainerOf, VariableOptions } from "./fields";
import type { Path } from "./state";
import type { IntegrationSpec } from "./types";

export const INTEGRATION_TABS = [
  {
    id: "connection",
    label: "Kết nối chung",
    description: "Dùng chung cho mọi lời gọi: biến, bí mật, cách xác thực, đăng nhập lấy token, chữ ký.",
    sections: ["secrets", "auth", "token", "signature", "actions"],
  },
  {
    id: "api",
    label: "Các API",
    description:
      "Luồng đủ: 1 danh sách gói → 2 kiểm tra gói → 3 đăng ký gói → 4 kiểm tra trạng thái → 5 danh sách đơn. API 1, 2, 5 không bắt buộc; API chỉ đọc gọi thử được ngay tại đây.",
    sections: ["packagesApi", "checkApi", "submitApi", "queryApi", "ordersApi", "testApi", "callbackApi"],
  },
  {
    id: "status",
    label: "Trạng thái & kết quả",
    description:
      "Hub đọc phản hồi của từng API thế nào: gói nào, đăng ký được không, đơn thành công, thất bại hay chưa rõ.",
    sections: [
      "orderStatus",
      "packagesResult",
      "checkResult",
      "submitResult",
      "queryResult",
      "ordersResult",
      "testResult",
      "callbackResult",
    ],
  },
] as const;

export type IntegrationTabId = (typeof INTEGRATION_TABS)[number]["id"];
export type SectionId = (typeof INTEGRATION_TABS)[number]["sections"][number];

export const SECTION_IDS: SectionId[] = INTEGRATION_TABS.flatMap((tab) => [...tab.sections]);

export function tabOfSection(id: SectionId): IntegrationTabId {
  return INTEGRATION_TABS.find((tab) => (tab.sections as readonly SectionId[]).includes(id))?.id ?? "connection";
}

const PROBLEM_SECTIONS: Array<[RegExp, SectionId]> = [
  [/spec\.token|Đăng nhập lấy token|\{\{token\}\}/i, "token"],
  [/spec\.signature|Chữ ký/i, "signature"],
  [/spec\.packages\.request|Danh sách gói: chưa nhập đường dẫn/i, "packagesApi"],
  [/spec\.packages|Danh sách gói/i, "packagesResult"],
  [/spec\.check\.request|Kiểm tra gói: chưa nhập đường dẫn/i, "checkApi"],
  [/spec\.check|Kiểm tra gói/i, "checkResult"],
  [/spec\.orders\.request|Danh sách đơn: chưa nhập đường dẫn|chưa bật API danh sách đơn/i, "ordersApi"],
  [/spec\.orders|Danh sách đơn/i, "ordersResult"],
  [/spec\.submit\.request|đường dẫn gửi đơn/i, "submitApi"],
  [/spec\.query\.request|đường dẫn tra cứu/i, "queryApi"],
  [/spec\.test\.request|đường dẫn kiểm tra kết nối/i, "testApi"],
  [/spec\.submit/i, "submitResult"],
  [/spec\.query|so khớp/i, "queryResult"],
  [/spec\.test/i, "testResult"],
  [/spec\.callback|callback/i, "callbackResult"],
  [/spec\.order|trạng thái/i, "orderStatus"],
  [/spec\.actions|spec\.fields|thao tác/i, "actions"],
  [/spec\.(auth|headers)/i, "auth"],
  [/^vars|^secrets|secretKeys|biến|bí mật/i, "secrets"],
];

export function sectionOfProblem(problem: string): SectionId | null {
  return PROBLEM_SECTIONS.find(([pattern]) => pattern.test(problem))?.[1] ?? null;
}

export function sectionDomId(id: SectionId): string {
  return `integration-section-${id}`;
}

export function requestSummary(request: { method: string; path: string }): string {
  return `${request.method} ${request.path || "(chưa có đường dẫn)"}`;
}

const storeListeners = new Map<string, Set<() => void>>();
const storeCache = new Map<string, string>();

function readStored(key: string): string {
  const cached = storeCache.get(key);
  if (cached !== undefined) return cached;
  let value = "";
  try {
    value = window.localStorage.getItem(key) ?? "";
  } catch {
    value = "";
  }
  storeCache.set(key, value);
  return value;
}

export function useStoredString(key: string): [string, (value: string) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const listeners = storeListeners.get(key) ?? new Set<() => void>();
      storeListeners.set(key, listeners);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => "",
  );
  const update = useCallback(
    (next: string) => {
      storeCache.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        storeCache.set(key, next);
      }
      storeListeners.get(key)?.forEach((listener) => listener());
    },
    [key],
  );
  return [value, update];
}

export interface SectionControl {
  id: SectionId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problems: number;
}

export interface EditorKit {
  supplier: Supplier;
  spec: IntegrationSpec;
  set: (path: Path, value: unknown) => void;
  variables: VariableOptions;
  loginVariables: VariableOptions;
  orderBases: string[];
  orderContainer: ContainerOf;
  packagesContainer: ContainerOf;
  ordersContainer: ContainerOf;
  section: (id: SectionId) => SectionControl;
  reveal: (id: SectionId) => void;
}

export function Section({
  id,
  title,
  description,
  summary,
  state,
  problems = 0,
  open,
  onOpenChange,
  children,
}: SectionControl & {
  title: string;
  description?: ReactNode;
  summary?: ReactNode;
  state?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} asChild>
      <Card id={sectionDomId(id)} className="scroll-mt-20">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl px-5 py-4 text-left transition-colors outline-none hover:bg-subtle/60 focus-visible:ring-3 focus-visible:ring-primary/30"
          >
            <ChevronDown
              className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
              aria-hidden
            />
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <CardTitle>{title}</CardTitle>
                {state !== undefined ? (
                  <Badge tone={state ? "success" : "neutral"}>{state ? "Đang bật" : "Tắt"}</Badge>
                ) : null}
                {problems > 0 ? (
                  <Badge tone="warning">
                    <AlertTriangle className="size-3" aria-hidden />
                    {problems} cần hoàn thiện
                  </Badge>
                ) : null}
              </span>
              {open ? (
                description ? (
                  <CardDescription className="mt-0">{description}</CardDescription>
                ) : null
              ) : summary ? (
                <span className="truncate font-mono text-[12.5px] text-muted-foreground">{summary}</span>
              ) : null}
            </span>
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <CardContent className="@container grid grid-cols-1 gap-5 pt-1">{children}</CardContent>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}

export function JumpLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 justify-self-end text-[12.5px] font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </button>
  );
}
