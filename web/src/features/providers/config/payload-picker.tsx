"use client";

import { CaretDown, CaretRight, CursorClick } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Hint } from "@/components/ui/tooltip";
import { formatRelative } from "@/lib/format";
import type { ResponseSample } from "../types";

const MAX_ARRAY_ITEMS = 20;
const MAX_PREVIEW = 48;

export type PickHandler = (path: string, value: unknown) => void;

function childPath(parent: string, key: string | number): string {
  return typeof key === "number" ? `${parent}[${key}]` : `${parent}.${key}`;
}

function preview(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    return `"${value.length > MAX_PREVIEW ? `${value.slice(0, MAX_PREVIEW)}…` : value}"`;
  }
  return String(value);
}

function entriesOf(value: object): Array<[string | number, unknown]> {
  return Array.isArray(value)
    ? value.slice(0, MAX_ARRAY_ITEMS).map((item, index) => [index, item as unknown])
    : Object.entries(value);
}

function TreeNode({
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
  onPick: PickHandler;
}) {
  const [open, setOpen] = useState(depth < 3);
  const nested = typeof value === "object" && value !== null;

  return (
    <li>
      <div className="flex items-center gap-1 whitespace-nowrap" style={{ paddingLeft: depth * 14 }}>
        {nested ? (
          <button
            type="button"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? `Thu gọn ${name}` : `Mở rộng ${name}`}
            aria-expanded={open}
          >
            {open ? <CaretDown className="size-3" aria-hidden /> : <CaretRight className="size-3" aria-hidden />}
          </button>
        ) : (
          <span className="inline-block size-5 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onPick(path, value)}
          className="rounded-sm px-1 py-0.5 text-left font-mono text-xs font-medium text-primary hover:bg-primary-soft hover:underline"
          title={`Dùng đường dẫn ${path}`}
        >
          {name}
        </button>
        <span className="font-mono text-xs text-muted-foreground">
          {nested ? (Array.isArray(value) ? `[${value.length}]` : "{…}") : preview(value)}
        </span>
      </div>
      {nested && open ? (
        <ul>
          {entriesOf(value).map(([key, child]) => (
            <TreeNode
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

export function PayloadTree({ sample, onPick }: { sample: ResponseSample; onPick: PickHandler }) {
  return (
    <ul className="max-h-72 scrollbar-thin overflow-auto rounded-md bg-subtle py-1.5 pr-2 pl-1">
      <TreeNode name="http.status" value={sample.httpStatus} path="http.status" depth={0} onPick={onPick} />
      <TreeNode name="body" value={sample.body ?? null} path="body" depth={0} onPick={onPick} />
    </ul>
  );
}

export function SampleNote({ sample, apiName }: { sample: ResponseSample | undefined; apiName: string }) {
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      {sample ? (
        <>
          Payload mẫu của {apiName}: HTTP {sample.httpStatus}, lưu{" "}
          <time dateTime={sample.capturedAt}>{formatRelative(sample.capturedAt)}</time>. Bấm biểu tượng con trỏ cạnh ô
          đường dẫn để chọn trường từ payload này.
        </>
      ) : (
        <>Chưa có payload mẫu của {apiName}. Bấm Gọi thử để lấy phản hồi rồi chọn trường thay vì gõ tay.</>
      )}
    </p>
  );
}

export function PayloadPickerButton({
  sample,
  apiName,
  fieldLabel,
  onPick,
  disabled,
}: {
  sample: ResponseSample | undefined;
  apiName: string;
  fieldLabel: string;
  onPick: PickHandler;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Chọn từ payload mẫu" side="top">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={`Chọn ${fieldLabel} từ payload mẫu`}
            className="shrink-0"
          >
            <CursorClick aria-hidden />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent>
        <p className="text-[13px] leading-snug font-semibold">Chọn trường cho “{fieldLabel}”</p>
        {sample ? (
          <>
            <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
              Payload mẫu của {apiName}, lưu {formatRelative(sample.capturedAt)}. Bấm vào tên trường để điền.
            </p>
            <PayloadTree
              sample={sample}
              onPick={(path, value) => {
                onPick(path, value);
                setOpen(false);
              }}
            />
          </>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Chưa có payload mẫu của {apiName}. Đóng hộp này, bấm Gọi thử ở mục tương ứng để lấy phản hồi, rồi quay lại
            chọn trường.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
