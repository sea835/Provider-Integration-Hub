"use client";

import { Braces, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePathPicker, type PickOutcome, type PickSource } from "./path-picker";
import { hasFixedIndex, isBlankBase, listLocation, looksLikeValue, relativeToOrder, sameBase } from "./state";
import {
  BODY_TYPES,
  HTTP_METHODS,
  OPERATORS,
  ORDER_OUTCOMES,
  RULE_OUTCOMES,
  VALUE_TYPES,
  type BodyField,
  type Condition,
  type KeyValue,
  type PathMode,
  type RequestSpec,
  type Rule,
  type StatusMapping,
} from "./types";

export const OPERATOR_LABELS: Record<Condition["operator"], string> = {
  IN: "là một trong",
  NOT_IN: "không phải",
  EXISTS: "có giá trị",
  NOT_EXISTS: "không có giá trị",
};

export const RULE_OUTCOME_LABELS: Record<Rule["outcome"], string> = {
  REJECTED: "Nhà cung cấp từ chối → đơn thất bại",
  CONFIG_ERROR: "Sai khoá / cấu hình → đơn thất bại",
  UNKNOWN: "Chưa rõ → Hub tra cứu lại",
};

export const ORDER_OUTCOME_LABELS: Record<StatusMapping["outcome"], string> = {
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  PENDING: "Đang xử lý",
};

const BODY_TYPE_LABELS: Record<RequestSpec["bodyType"], string> = {
  NONE: "Không có body",
  JSON: "JSON",
  FORM: "Form",
};

const VALUE_TYPE_LABELS: Record<BodyField["type"], string> = {
  string: "Chữ",
  number: "Số",
  boolean: "Đúng/sai",
};

export interface VariableOptions {
  vars: string[];
  secrets: string[];
  token?: boolean;
}

export type VariableList = Array<[string, string]>;

export interface ExtraVariables {
  label: string;
  items: VariableList;
}

export const RANGE_VARIABLES: ExtraVariables = {
  label: "Khoảng thời gian (danh sách đơn)",
  items: [
    ["range.from.date", "Từ ngày (YYYY-MM-DD, giờ VN)"],
    ["range.to.date", "Đến ngày (YYYY-MM-DD, giờ VN)"],
    ["range.from.datetime", "Từ lúc (YYYY-MM-DD HH:mm:ss)"],
    ["range.to.datetime", "Đến lúc (YYYY-MM-DD HH:mm:ss)"],
    ["range.from.iso", "Từ lúc (ISO)"],
    ["range.to.iso", "Đến lúc (ISO)"],
    ["range.from.unix", "Từ lúc (giây)"],
    ["range.to.unix", "Đến lúc (giây)"],
    ["range.from.unixMs", "Từ lúc (mili giây)"],
    ["range.to.unixMs", "Đến lúc (mili giây)"],
  ],
};

const ORDER_VARIABLES: Array<[string, string]> = [
  ["order.transCode", "Mã đơn của Hub (gửi làm mã đơn)"],
  ["order.packageCode", "Mã gói Store gửi"],
  ["order.action", "Thao tác"],
  ["order.phone", "SĐT dạng 0xxxxxxxxx"],
  ["order.phone84", "SĐT dạng 84xxxxxxxxx"],
  ["order.phone9", "SĐT 9 số, bỏ số 0"],
  ["order.serial", "Serial SIM"],
  ["order.supplierTransId", "Mã đơn phía nhà cung cấp (khi tra cứu)"],
];

const TIME_VARIABLES: VariableList = [
  ["now.unix", "Thời điểm hiện tại (giây)"],
  ["now.unixMs", "Thời điểm hiện tại (mili giây)"],
  ["now.iso", "Thời điểm hiện tại (ISO)"],
  ["uuid", "Mã ngẫu nhiên UUID, mới cho mỗi lời gọi"],
];

const compact = "h-8 text-[13px] pointer-coarse:h-10";

export function TemplateInput({
  value,
  onChange,
  variables,
  placeholder,
  ariaLabel,
  className,
  extra,
}: {
  value: string;
  onChange: (value: string) => void;
  variables: VariableOptions;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  extra?: ExtraVariables;
}) {
  const insert = (name: string) => onChange(`${value}{{${name}}}`);
  return (
    <div className={cn("flex min-w-0 gap-1", className)}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
        autoComplete="off"
        className={cn(compact, "font-mono")}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Chèn biến">
            <Braces aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          {extra ? (
            <>
              <DropdownMenuLabel>{extra.label}</DropdownMenuLabel>
              {extra.items.map(([name, label]) => (
                <DropdownMenuItem key={name} onSelect={() => insert(name)}>
                  <span className="font-mono text-[12px]">{name}</span>
                  <span className="ml-auto pl-3 text-[11.5px] text-muted-foreground">{label}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {variables.token ? (
            <>
              <DropdownMenuLabel>Đăng nhập</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => insert("token")}>
                <span className="font-mono text-[12px]">token</span>
                <span className="ml-auto pl-3 text-[11.5px] text-muted-foreground">Token Hub tự lấy và gia hạn</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel>Đơn hàng</DropdownMenuLabel>
          {ORDER_VARIABLES.map(([name, label]) => (
            <DropdownMenuItem key={name} onSelect={() => insert(name)}>
              <span className="font-mono text-[12px]">{name}</span>
              <span className="ml-auto pl-3 text-[11.5px] text-muted-foreground">{label}</span>
            </DropdownMenuItem>
          ))}
          {variables.vars.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Biến</DropdownMenuLabel>
              {variables.vars.map((name) => (
                <DropdownMenuItem key={name} onSelect={() => insert(`vars.${name}`)}>
                  <span className="font-mono text-[12px]">vars.{name}</span>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {variables.secrets.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Bí mật</DropdownMenuLabel>
              {variables.secrets.map((name) => (
                <DropdownMenuItem key={name} onSelect={() => insert(`secrets.${name}`)}>
                  <span className="font-mono text-[12px]">secrets.{name}</span>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Thời gian và mã ngẫu nhiên</DropdownMenuLabel>
          {TIME_VARIABLES.map(([name, label]) => (
            <DropdownMenuItem key={name} onSelect={() => insert(name)}>
              <span className="font-mono text-[12px]">{name}</span>
              <span className="ml-auto pl-3 text-[11.5px] text-muted-foreground">{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export interface OrderContainer {
  path: string;
  label: string;
  adopt?: (path: string) => void;
}

export type ContainerOf = (source: PickSource | null) => OrderContainer | null;

function pickIntoOrder(
  absolute: string,
  bases: string[],
  container: OrderContainer | null,
): { value: string; note?: string } {
  const result = relativeToOrder(absolute, container ? [container.path] : bases);
  if (result.container === null) return { value: result.value };
  if (!result.viaIndex) {
    return { value: result.value, note: `Đường dẫn tính từ một đơn, bỏ phần ${result.container} phía trước.` };
  }
  const list = result.container || "(cả phản hồi)";
  const each = `Đổi số thứ tự thành [*] để Hub đọc mọi đơn trong ${list}.`;
  if (container?.adopt && isBlankBase(container.path) && result.container) {
    container.adopt(result.container);
    return { value: result.value, note: `${each} Đã điền ${container.label} = ${list}.` };
  }
  if (container && !isBlankBase(container.path) && !sameBase(container.path, result.container)) {
    return {
      value: result.value,
      note: `${each} Lưu ý: ${container.label} đang là ${container.path}, khác ${list}.`,
    };
  }
  return { value: result.value, note: each };
}

export function PathInput({
  value,
  onChange,
  mode,
  bases = [],
  container,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: PathMode;
  bases?: string[];
  container?: ContainerOf;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const { target, setTarget } = usePathPicker();
  const active = target?.label === label;
  const apply = (absolute: string, source: PickSource | null): PickOutcome => {
    if (mode === "response" || mode === "callback") {
      const next = `body.${absolute}`;
      onChange(next);
      return { value: next };
    }
    if (mode === "list") {
      const next = listLocation(absolute);
      onChange(next);
      return next === absolute
        ? { value: next }
        : { value: next, note: `Lấy cả danh sách ${next}, không lấy riêng một phần tử.` };
    }
    if (mode === "body") {
      onChange(absolute);
      return { value: absolute };
    }
    const picked = pickIntoOrder(absolute, bases, container?.(source) ?? null);
    onChange(picked.value);
    return picked;
  };
  const activate = () => setTarget({ label, apply });

  const literal = value.trim() !== "" && looksLikeValue(value);
  const fixedContainer = mode === "order" && hasFixedIndex(value) ? (container?.(null) ?? null) : null;
  const suggestion =
    mode === "order" && hasFixedIndex(value)
      ? relativeToOrder(value, fixedContainer ? [fixedContainer.path] : bases)
      : null;
  const showSuggestion =
    suggestion !== null &&
    suggestion.value !== value &&
    (!suggestion.viaIndex || (suggestion.container ?? "").includes("."));

  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <div className="relative min-w-0">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={activate}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={literal ? true : undefined}
          spellCheck={false}
          autoComplete="off"
          className={cn(compact, "pr-8 font-mono", active && "border-primary ring-3 ring-primary/20")}
        />
        <button
          type="button"
          onClick={activate}
          className={cn(
            "absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-md",
            active ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={`Chọn đường dẫn cho ${label} từ phản hồi mẫu`}
        >
          <MousePointerClick className="size-3.5" aria-hidden />
        </button>
      </div>
      {literal ? (
        <p className="text-[12px] leading-snug text-warning">
          Ô này cần đường dẫn tới trường (vd errorMessage), không phải giá trị. Bấm biểu tượng con trỏ rồi chọn trường
          trong phản hồi mẫu.
        </p>
      ) : null}
      {showSuggestion && suggestion ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-snug text-warning">
          <span>
            Đang trỏ cố định vào một phần tử nên Hub chỉ đọc được phần tử đó. Đọc mọi phần tử thì là{" "}
            <code className="font-mono">{suggestion.value}</code>.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[12px]"
            onClick={() => {
              onChange(suggestion.value);
              if (
                suggestion.viaIndex &&
                suggestion.container &&
                fixedContainer?.adopt &&
                isBlankBase(fixedContainer.path)
              ) {
                fixedContainer.adopt(suggestion.container);
              }
            }}
          >
            Sửa thành {suggestion.value}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function FieldRow({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="grid grid-cols-1 gap-1.5 @xl:grid-cols-[180px_minmax(0,1fr)] @xl:items-start @xl:gap-4">
      <div className="pt-1.5">
        <Label htmlFor={id} className="text-[13px]">
          {label}
        </Label>
        {hint ? <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      <div id={id} className="@container min-w-0">
        {children}
      </div>
    </div>
  );
}

export function SmallSelect<T extends string>({
  value,
  onChange,
  options,
  labels,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  labels: Record<T, string>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger className={cn(compact, className)} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} className={className}>
      <Trash2 aria-hidden />
    </Button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="justify-self-start">
      <Plus aria-hidden />
      {children}
    </Button>
  );
}

function OmitCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex h-8 items-center gap-1.5 whitespace-nowrap">
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <Label htmlFor={id} className="text-[12px] font-normal text-muted-foreground">
        Bỏ khi rỗng
      </Label>
    </div>
  );
}

export function KeyValueEditor({
  items,
  onChange,
  variables,
  nameLabel,
  addLabel,
  extra,
}: {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  variables: VariableOptions;
  nameLabel: string;
  addLabel: string;
  extra?: ExtraVariables;
}) {
  const update = (index: number, patch: Partial<KeyValue>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="grid grid-cols-1 gap-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 rounded-md border p-2 @md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @md:items-center @xl:grid-cols-[180px_minmax(0,1fr)_auto_auto] @xl:border-0 @xl:p-0"
        >
          <Input
            value={item.name}
            onChange={(event) => update(index, { name: event.target.value })}
            placeholder={nameLabel}
            aria-label={nameLabel}
            spellCheck={false}
            className={cn(compact, "font-mono")}
          />
          <TemplateInput
            value={item.value}
            onChange={(value) => update(index, { value })}
            variables={variables}
            extra={extra}
            ariaLabel={`Giá trị của ${item.name || nameLabel}`}
            placeholder="Giá trị hoặc {{biến}}"
          />
          <div className="flex items-center gap-2 @md:col-span-2 @xl:contents">
            <OmitCheckbox checked={item.omitIfEmpty} onChange={(omitIfEmpty) => update(index, { omitIfEmpty })} />
            <RemoveButton
              label="Xoá dòng"
              className="ml-auto @xl:ml-0"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { name: "", value: "", omitIfEmpty: false }])}>
        {addLabel}
      </AddButton>
    </div>
  );
}

function BodyFieldsEditor({
  items,
  onChange,
  variables,
  extra,
}: {
  items: BodyField[];
  onChange: (items: BodyField[]) => void;
  variables: VariableOptions;
  extra?: ExtraVariables;
}) {
  const update = (index: number, patch: Partial<BodyField>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="grid grid-cols-1 gap-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 rounded-md border p-2 @md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @md:items-center @2xl:grid-cols-[170px_minmax(0,1fr)_110px_auto_auto] @2xl:border-0 @2xl:p-0"
        >
          <Input
            value={item.key}
            onChange={(event) => update(index, { key: event.target.value })}
            placeholder="Tên trường"
            aria-label="Tên trường body"
            spellCheck={false}
            className={cn(compact, "font-mono")}
          />
          <TemplateInput
            value={item.value}
            onChange={(value) => update(index, { value })}
            variables={variables}
            extra={extra}
            ariaLabel={`Giá trị của ${item.key || "trường"}`}
            placeholder="Giá trị hoặc {{biến}}"
          />
          <div className="flex items-center gap-2 @md:col-span-2 @2xl:contents">
            <SmallSelect
              value={item.type}
              onChange={(type) => update(index, { type })}
              options={VALUE_TYPES}
              labels={VALUE_TYPE_LABELS}
              ariaLabel="Kiểu giá trị"
              className="w-28 @2xl:w-full"
            />
            <OmitCheckbox checked={item.omitIfEmpty} onChange={(omitIfEmpty) => update(index, { omitIfEmpty })} />
            <RemoveButton
              label="Xoá trường"
              className="ml-auto @2xl:ml-0"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { key: "", value: "", type: "string", omitIfEmpty: false }])}>
        Thêm trường body
      </AddButton>
    </div>
  );
}

export function RequestEditor({
  value,
  onChange,
  variables,
  pathPlaceholder,
  extra,
}: {
  value: RequestSpec;
  onChange: (value: RequestSpec) => void;
  variables: VariableOptions;
  pathPlaceholder: string;
  extra?: ExtraVariables;
}) {
  const set = (patch: Partial<RequestSpec>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-4">
      <FieldRow
        label="Phương thức và đường dẫn"
        hint="Đường dẫn nối sau Địa chỉ API. Ghi đầy đủ https://... nếu khác máy chủ."
      >
        <div className="flex gap-2">
          <SmallSelect
            value={value.method}
            onChange={(method) => set({ method, bodyType: method === "GET" ? "NONE" : value.bodyType })}
            options={HTTP_METHODS}
            labels={{ GET: "GET", POST: "POST", PUT: "PUT" }}
            ariaLabel="Phương thức HTTP"
            className="w-24"
          />
          <TemplateInput
            value={value.path}
            onChange={(path) => set({ path })}
            variables={variables}
            extra={extra}
            ariaLabel="Đường dẫn"
            placeholder={pathPlaceholder}
            className="flex-1"
          />
        </div>
      </FieldRow>
      <FieldRow label="Tham số trên URL" hint="Phần ?a=1&b=2 sau đường dẫn.">
        <KeyValueEditor
          items={value.query}
          onChange={(query) => set({ query })}
          variables={variables}
          extra={extra}
          nameLabel="Tên tham số"
          addLabel="Thêm tham số"
        />
      </FieldRow>
      {value.method !== "GET" ? (
        <FieldRow label="Body" hint="Dùng dấu chấm để lồng nhau, ví dụ customer.phone.">
          <div className="grid grid-cols-1 gap-3">
            <SmallSelect
              value={value.bodyType}
              onChange={(bodyType) => set({ bodyType })}
              options={BODY_TYPES}
              labels={BODY_TYPE_LABELS}
              ariaLabel="Kiểu body"
              className="w-56"
            />
            {value.bodyType !== "NONE" ? (
              <BodyFieldsEditor
                items={value.body}
                onChange={(body) => set({ body })}
                variables={variables}
                extra={extra}
              />
            ) : null}
          </div>
        </FieldRow>
      ) : null}
    </div>
  );
}

export function ConditionsEditor({
  items,
  onChange,
  mode,
  addLabel,
  emptyText,
}: {
  items: Condition[];
  onChange: (items: Condition[]) => void;
  mode: PathMode;
  addLabel: string;
  emptyText?: string;
}) {
  const update = (index: number, patch: Partial<Condition>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="grid grid-cols-1 gap-2">
      {items.length === 0 && emptyText ? <p className="text-[12.5px] text-muted-foreground">{emptyText}</p> : null}
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 rounded-md border p-2 @md:grid-cols-[minmax(0,1fr)_150px_auto] @md:items-center @2xl:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_auto] @2xl:border-0 @2xl:p-0"
        >
          <PathInput
            value={item.path}
            onChange={(path) => update(index, { path })}
            mode={mode}
            label={`Điều kiện ${index + 1}`}
            placeholder="http.status hoặc body.code"
          />
          <SmallSelect
            value={item.operator}
            onChange={(operator) => update(index, { operator })}
            options={OPERATORS}
            labels={OPERATOR_LABELS}
            ariaLabel="Phép so sánh"
          />
          {item.operator === "IN" || item.operator === "NOT_IN" ? (
            <Input
              value={item.values.join(", ")}
              onChange={(event) => update(index, { values: event.target.value.split(",").map((v) => v.trim()) })}
              placeholder="2xx, 0, ORDER_RESULT"
              aria-label="Các giá trị, cách nhau bằng dấu phẩy"
              spellCheck={false}
              className={cn(compact, "font-mono @md:order-1 @md:col-span-3 @2xl:order-none @2xl:col-span-1")}
            />
          ) : (
            <span className="hidden @2xl:block" />
          )}
          <RemoveButton
            label="Xoá điều kiện"
            className="justify-self-end"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { path: "", operator: "IN", values: [] }])}>{addLabel}</AddButton>
    </div>
  );
}

export function RulesEditor({ items, onChange }: { items: Rule[]; onChange: (items: Rule[]) => void }) {
  const update = (index: number, patch: Partial<Rule>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      {items.map((rule, index) => (
        <div key={index} className="@container grid grid-cols-1 gap-3 rounded-lg border bg-subtle p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-card font-mono text-[11.5px]">
              {index + 1}
            </span>
            <Input
              value={rule.name}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="Tên luật, ví dụ: Sai API key"
              aria-label="Tên luật"
              className={cn(compact, "min-w-0 flex-1")}
            />
            <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
              Lên
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
            >
              Xuống
            </Button>
            <RemoveButton label="Xoá luật" onClick={() => onChange(items.filter((_, i) => i !== index))} />
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <p className="text-[12px] text-muted-foreground">Khi tất cả điều kiện sau đúng</p>
            <ConditionsEditor
              items={rule.conditions}
              onChange={(conditions) => update(index, { conditions })}
              mode="response"
              addLabel="Thêm điều kiện"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SmallSelect
              value={rule.outcome}
              onChange={(outcome) => update(index, { outcome })}
              options={RULE_OUTCOMES}
              labels={RULE_OUTCOME_LABELS}
              ariaLabel="Kết luận"
            />
            {rule.outcome !== "CONFIG_ERROR" ? (
              <Input
                value={rule.errorCode}
                onChange={(event) => update(index, { errorCode: event.target.value })}
                placeholder="Mã lỗi, ví dụ ANI_{{body.code}}"
                aria-label="Mã lỗi ghi vào đơn"
                spellCheck={false}
                className={cn(compact, "font-mono")}
              />
            ) : (
              <p className="self-center text-[12px] text-muted-foreground">Mã lỗi: SUPPLIER_CONFIG</p>
            )}
          </div>
        </div>
      ))}
      <AddButton
        onClick={() =>
          onChange([
            ...items,
            {
              name: "",
              conditions: [{ path: "http.status", operator: "IN", values: [] }],
              outcome: "REJECTED",
              errorCode: "",
            },
          ])
        }
      >
        Thêm luật
      </AddButton>
    </div>
  );
}

export function StatusMapEditor({
  items,
  onChange,
}: {
  items: StatusMapping[];
  onChange: (items: StatusMapping[]) => void;
}) {
  const update = (index: number, patch: Partial<StatusMapping>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="grid grid-cols-1 gap-2">
      {items.length > 0 ? (
        <div className="hidden gap-2 text-[11.5px] font-medium text-muted-foreground uppercase @lg:grid @lg:grid-cols-[140px_170px_minmax(0,1fr)_auto]">
          <span>Giá trị nhà cung cấp trả</span>
          <span>Hub hiểu là</span>
          <span>Mã lỗi riêng (tuỳ chọn)</span>
          <span className="w-8" />
        </div>
      ) : null}
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-2 @lg:grid-cols-[140px_170px_minmax(0,1fr)_auto] @lg:border-0 @lg:p-0"
        >
          <Input
            value={item.value}
            onChange={(event) => update(index, { value: event.target.value })}
            placeholder="vd 4 hoặc SUCCESS"
            aria-label="Giá trị trạng thái"
            spellCheck={false}
            className={cn(compact, "font-mono")}
          />
          <SmallSelect
            value={item.outcome}
            onChange={(outcome) => update(index, { outcome })}
            options={ORDER_OUTCOMES}
            labels={ORDER_OUTCOME_LABELS}
            ariaLabel="Hub hiểu là"
          />
          {item.outcome === "FAILED" ? (
            <Input
              value={item.errorCode}
              onChange={(event) => update(index, { errorCode: event.target.value })}
              placeholder="Mã lỗi riêng, vd ANI_SIM_UNAVAILABLE"
              aria-label="Mã lỗi riêng"
              aria-invalid={/\s/.test(item.errorCode.trim()) ? true : undefined}
              spellCheck={false}
              className={cn(compact, "order-1 col-span-3 font-mono @lg:order-none @lg:col-span-1")}
            />
          ) : (
            <span className="hidden @lg:block" />
          )}
          <RemoveButton label="Xoá dòng" onClick={() => onChange(items.filter((_, i) => i !== index))} />
          {item.outcome === "FAILED" && /\s/.test(item.errorCode.trim()) ? (
            <p className="order-2 col-span-3 text-[12px] leading-snug text-warning @lg:col-span-4">
              Mã lỗi viết liền, không có khoảng trắng (vd ANI_SIM_UNAVAILABLE). Câu thông báo lấy từ ô Thông báo lỗi của
              đơn.
            </p>
          ) : null}
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { value: "", outcome: "PENDING", errorCode: "" }])}>
        Thêm giá trị trạng thái
      </AddButton>
      <p className="text-[12px] text-muted-foreground">
        Giá trị không có trong bảng được hiểu là Chưa rõ, Hub sẽ tra cứu lại. Chỉ khai báo Thất bại khi chắc chắn đơn
        không được thực hiện.
      </p>
    </div>
  );
}
