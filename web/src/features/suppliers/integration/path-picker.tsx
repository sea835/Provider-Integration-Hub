"use client";

import { ChevronDown, ChevronRight, MousePointerClick } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PickSource = "LOGIN" | "PACKAGES" | "CHECK" | "SUBMIT" | "QUERY" | "ORDERS" | "TEST" | "CALLBACK";

export interface PickOutcome {
  value: string;
  note?: string;
}

interface PathTarget {
  label: string;
  apply: (absolutePath: string, source: PickSource | null) => PickOutcome;
}

interface PathPickerValue {
  target: PathTarget | null;
  setTarget: (target: PathTarget | null) => void;
}

const PathPickerContext = createContext<PathPickerValue>({ target: null, setTarget: () => undefined });

export function PathPickerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PathTarget | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <PathPickerContext.Provider value={value}>{children}</PathPickerContext.Provider>;
}

export function usePathPicker(): PathPickerValue {
  return useContext(PathPickerContext);
}

function childPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  return parent ? `${parent}.${key}` : key;
}

function preview(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
  return String(value);
}

function Node({
  name,
  value,
  path,
  depth,
  onPick,
}: {
  name: string;
  value: unknown;
  path: string;
  depth: number;
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 3);
  const isObject = typeof value === "object" && value !== null;
  const entries: Array<[string | number, unknown]> = Array.isArray(value)
    ? value.slice(0, 20).map((item, index) => [index, item])
    : isObject
      ? Object.entries(value as Record<string, unknown>)
      : [];

  return (
    <li>
      <div className="flex items-center gap-1 whitespace-nowrap" style={{ paddingLeft: depth * 14 }}>
        {isObject ? (
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Thu gọn" : "Mở rộng"}
          >
            {open ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="inline-block size-5" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onPick(path)}
          className="rounded px-1 py-0.5 text-left font-mono text-[12px] text-primary hover:bg-primary-soft hover:underline"
          title={`Dùng đường dẫn ${path}`}
        >
          {name}
        </button>
        {!isObject ? (
          <span className="font-mono text-[12px] text-muted-foreground">{preview(value)}</span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">
            {Array.isArray(value) ? `[${value.length}]` : "{…}"}
          </span>
        )}
      </div>
      {isObject && open ? (
        <ul>
          {entries.map(([key, child]) => (
            <Node
              key={String(key)}
              name={typeof key === "number" ? `[${key}]` : key}
              value={child}
              path={childPath(path, key)}
              depth={depth + 1}
              onPick={onPick}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function JsonTree({ value, source }: { value: unknown; source?: PickSource }) {
  const { target } = usePathPicker();
  const [picked, setPicked] = useState<{ text: string; note?: string } | null>(null);
  const pick = (path: string) => {
    if (!target) {
      setPicked(null);
      return;
    }
    const outcome = target.apply(path, source ?? null);
    setPicked({ text: `${outcome.value || "(cả phản hồi)"} → ${target.label}`, note: outcome.note });
  };
  const isObject = typeof value === "object" && value !== null;

  return (
    <div className="min-w-0 space-y-2">
      <p
        className={cn(
          "flex items-start gap-2 rounded-md px-2.5 py-2 text-[12.5px]",
          target ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-live="polite"
      >
        <MousePointerClick className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {target
          ? `Bấm vào một trường bên dưới để điền vào ô "${target.label}"`
          : "Bấm vào một ô đường dẫn (có biểu tượng con trỏ) trong bản tích hợp, rồi bấm vào trường tương ứng bên dưới"}
      </p>
      {picked ? (
        <div className="grid gap-0.5">
          <p className="font-mono text-[11.5px] break-all text-success">Đã điền: {picked.text}</p>
          {picked.note ? <p className="text-[12px] text-muted-foreground">{picked.note}</p> : null}
        </div>
      ) : null}
      {isObject ? (
        <ul className="max-h-80 min-w-0 scrollbar-thin overflow-auto rounded-md border bg-card py-1 pr-2">
          {(Array.isArray(value)
            ? value.slice(0, 20).map((item, index) => [index, item] as [number, unknown])
            : Object.entries(value as Record<string, unknown>)
          ).map(([key, child]) => (
            <Node
              key={String(key)}
              name={typeof key === "number" ? `[${key}]` : key}
              value={child}
              path={childPath("", key)}
              depth={0}
              onPick={pick}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">
          Dán một phản hồi JSON mẫu của nhà cung cấp để hiện cây trường.
        </p>
      )}
    </div>
  );
}
