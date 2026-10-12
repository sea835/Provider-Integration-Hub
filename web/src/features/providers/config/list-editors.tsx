"use client";

import { Plus, Trash } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/tooltip";
import {
  OPERATORS,
  VALUE_TYPES,
  type BodyField,
  type Condition,
  type KeyValue,
  type Operator,
  type ResponseSample,
  type ValueType,
} from "../types";
import { PayloadPickerButton } from "./payload-picker";
import { TemplateInput } from "./template-input";

const OPERATOR_LABELS: Record<Operator, string> = {
  IN: "là một trong",
  NOT_IN: "không thuộc",
  EXISTS: "có giá trị",
  NOT_EXISTS: "rỗng",
};

const TYPE_LABELS: Record<ValueType, string> = { string: "Chuỗi", number: "Số", boolean: "Đúng/sai" };

function replaceAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, position) => (position === index ? { ...item, ...patch } : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}

function ListShell({
  label,
  hint,
  empty,
  addLabel,
  onAdd,
  disabled,
  children,
}: {
  label: string;
  hint?: ReactNode;
  empty: boolean;
  addLabel: string;
  onAdd: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] leading-none font-medium">{label}</p>
          {hint ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} disabled={disabled}>
          <Plus aria-hidden />
          {addLabel}
        </Button>
      </div>
      {empty ? (
        <p className="rounded-md bg-subtle px-3 py-2.5 text-xs text-muted-foreground">Chưa có dòng nào.</p>
      ) : (
        <ul className="grid gap-2">{children}</ul>
      )}
    </div>
  );
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Hint label="Xóa dòng" side="left">
      <Button variant="destructive-ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
        <Trash aria-hidden />
      </Button>
    </Hint>
  );
}

function OmitToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Hint label="Bỏ dòng này khi giá trị rỗng" side="top">
      <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          disabled={disabled}
          aria-label={label}
        />
        Bỏ nếu rỗng
      </label>
    </Hint>
  );
}

export function KeyValueList({
  label,
  hint,
  items,
  onChange,
  disabled,
  namePlaceholder = "Tên",
  valuePlaceholder = "Giá trị hoặc {{biến}}",
  plainValues = false,
}: {
  label: string;
  hint?: ReactNode;
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  disabled?: boolean;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  plainValues?: boolean;
}) {
  return (
    <ListShell
      label={label}
      hint={hint}
      empty={items.length === 0}
      addLabel="Thêm"
      disabled={disabled}
      onAdd={() => onChange([...items, { name: "", value: "", omitIfEmpty: false }])}
    >
      {items.map((item, index) => (
        <li key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Input
            value={item.name}
            onChange={(event) => onChange(replaceAt(items, index, { name: event.target.value }))}
            placeholder={namePlaceholder}
            aria-label={`${label}: tên dòng ${index + 1}`}
            disabled={disabled}
            className="font-mono text-[13px] sm:w-2/5"
            spellCheck={false}
          />
          {plainValues ? (
            <Input
              value={item.value}
              onChange={(event) => onChange(replaceAt(items, index, { value: event.target.value }))}
              placeholder={valuePlaceholder}
              aria-label={`${label}: giá trị dòng ${index + 1}`}
              disabled={disabled}
              className="min-w-40 flex-1 font-mono text-[13px]"
              spellCheck={false}
            />
          ) : (
            <TemplateInput
              value={item.value}
              onChange={(value) => onChange(replaceAt(items, index, { value }))}
              placeholder={valuePlaceholder}
              label={`${label}: giá trị dòng ${index + 1}`}
              disabled={disabled}
              className="min-w-40 flex-1"
            />
          )}
          <OmitToggle
            checked={item.omitIfEmpty}
            onChange={(omitIfEmpty) => onChange(replaceAt(items, index, { omitIfEmpty }))}
            disabled={disabled}
            label={`${label}: bỏ dòng ${index + 1} nếu rỗng`}
          />
          <RemoveButton
            label={`${label}: xóa dòng ${index + 1}`}
            onClick={() => onChange(removeAt(items, index))}
            disabled={disabled}
          />
        </li>
      ))}
    </ListShell>
  );
}

export function BodyFieldList({
  items,
  onChange,
  disabled,
  typed,
}: {
  items: BodyField[];
  onChange: (items: BodyField[]) => void;
  disabled?: boolean;
  typed: boolean;
}) {
  const label = "Trường trong body";
  return (
    <ListShell
      label={label}
      hint={typed ? "Tên trường dạng a.b sẽ tạo đối tượng lồng nhau." : undefined}
      empty={items.length === 0}
      addLabel="Thêm"
      disabled={disabled}
      onAdd={() => onChange([...items, { key: "", value: "", type: "string", omitIfEmpty: false }])}
    >
      {items.map((item, index) => (
        <li key={index} className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <Input
            value={item.key}
            onChange={(event) => onChange(replaceAt(items, index, { key: event.target.value }))}
            placeholder="Tên trường"
            aria-label={`${label}: tên dòng ${index + 1}`}
            disabled={disabled}
            className="font-mono text-[13px] lg:w-1/3"
            spellCheck={false}
          />
          <TemplateInput
            value={item.value}
            onChange={(value) => onChange(replaceAt(items, index, { value }))}
            placeholder="Giá trị hoặc {{biến}}"
            label={`${label}: giá trị dòng ${index + 1}`}
            disabled={disabled}
            className="min-w-40 flex-1"
          />
          {typed ? (
            <Select
              value={item.type}
              onValueChange={(type) => onChange(replaceAt(items, index, { type: type as ValueType }))}
              disabled={disabled}
            >
              <SelectTrigger className="w-28 shrink-0" aria-label={`${label}: kiểu dòng ${index + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALUE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <OmitToggle
            checked={item.omitIfEmpty}
            onChange={(omitIfEmpty) => onChange(replaceAt(items, index, { omitIfEmpty }))}
            disabled={disabled}
            label={`${label}: bỏ dòng ${index + 1} nếu rỗng`}
          />
          <RemoveButton
            label={`${label}: xóa dòng ${index + 1}`}
            onClick={() => onChange(removeAt(items, index))}
            disabled={disabled}
          />
        </li>
      ))}
    </ListShell>
  );
}

export function ConditionList({
  label,
  hint,
  items,
  onChange,
  disabled,
  sample,
  apiName,
}: {
  label: string;
  hint?: ReactNode;
  items: Condition[];
  onChange: (items: Condition[]) => void;
  disabled?: boolean;
  sample: ResponseSample | undefined;
  apiName: string;
}) {
  return (
    <ListShell
      label={label}
      hint={hint}
      empty={items.length === 0}
      addLabel="Thêm điều kiện"
      disabled={disabled}
      onAdd={() => onChange([...items, { path: "", operator: "IN", values: [] }])}
    >
      {items.map((item, index) => {
        const needsValues = item.operator === "IN" || item.operator === "NOT_IN";
        return (
          <li key={index} className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <Input
              value={item.path}
              onChange={(event) => onChange(replaceAt(items, index, { path: event.target.value }))}
              placeholder="http.status hoặc body.code"
              aria-label={`${label}: đường dẫn dòng ${index + 1}`}
              disabled={disabled}
              className="font-mono text-[13px] lg:w-1/3"
              spellCheck={false}
            />
            <PayloadPickerButton
              sample={sample}
              apiName={apiName}
              fieldLabel={`${label}, dòng ${index + 1}`}
              disabled={disabled}
              onPick={(path, value) =>
                onChange(
                  replaceAt(items, index, {
                    path,
                    values:
                      item.values.some((existing) => existing !== "") || typeof value === "object"
                        ? item.values
                        : [path === "http.status" ? "2xx" : String(value)],
                  }),
                )
              }
            />
            <Select
              value={item.operator}
              onValueChange={(operator) => onChange(replaceAt(items, index, { operator: operator as Operator }))}
              disabled={disabled}
            >
              <SelectTrigger className="w-40 shrink-0" aria-label={`${label}: phép so dòng ${index + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {OPERATOR_LABELS[operator]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsValues ? (
              <Input
                value={item.values.join(", ")}
                onChange={(event) =>
                  onChange(
                    replaceAt(items, index, {
                      values: event.target.value.split(",").map((value) => value.trimStart()),
                    }),
                  )
                }
                placeholder="2xx hoặc 0, 00"
                aria-label={`${label}: giá trị dòng ${index + 1}`}
                disabled={disabled}
                className="min-w-32 flex-1 font-mono text-[13px]"
                spellCheck={false}
              />
            ) : (
              <span className="hidden flex-1 lg:block" />
            )}
            <RemoveButton
              label={`${label}: xóa dòng ${index + 1}`}
              onClick={() => onChange(removeAt(items, index))}
              disabled={disabled}
            />
          </li>
        );
      })}
    </ListShell>
  );
}
