"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { actionLabel } from "../constants";
import { SmallSelect } from "./fields";
import { emptyExtraField } from "./state";
import type { EditorKit } from "./section";
import { EXTRA_FIELD_TYPES, MAX_EXTRA_FIELDS, type ExtraField, type ExtraFieldType } from "./types";

const TYPE_LABELS: Record<ExtraFieldType, string> = {
  TEXT: "Chữ",
  NUMBER: "Số",
  DATE: "Ngày (YYYY-MM-DD)",
  TEXT_LIST: "Danh sách chữ",
};

const TYPE_SAMPLES: Record<ExtraFieldType, unknown> = {
  TEXT: "abc",
  NUMBER: 1,
  DATE: "2026-10-15",
  TEXT_LIST: ["8988..."],
};

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

function keyProblem(field: ExtraField, fields: ExtraField[]): string | null {
  if (!field.key) return "Chưa đặt tên trường";
  if (!KEY_PATTERN.test(field.key)) return "Bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới";
  if (fields.filter((item) => item.key === field.key).length > 1) return "Trùng tên với trường khác";
  return null;
}

export function ExtraFieldsEditor({ kit }: { kit: EditorKit }) {
  const { spec } = kit;
  const fields = spec.extraFields;
  const setFields = (next: ExtraField[]) => kit.set(["extraFields"], next);
  const update = (index: number, patch: Partial<ExtraField>) =>
    setFields(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  const sample = Object.fromEntries(
    fields.filter((field) => field.key).map((field) => [field.key, TYPE_SAMPLES[field.type]]),
  );

  return (
    <div className="grid gap-3 border-t pt-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Trường thêm Store gửi</p>
        <p className="text-[13px] text-muted-foreground">
          Thông tin nhà cung cấp cần mà Hub chưa có sẵn (vd ngày kích hoạt eSIM, email, danh sách ICCID). Store gửi
          trong <code className="font-mono">extra</code>, Hub kiểm tra kiểu và bắt buộc ngay khi nhận đơn. Dùng trong
          các API qua biến <code className="font-mono">{"{{order.extra.<tên>}}"}</code>.
        </p>
      </div>

      {fields.map((field, index) => {
        const problem = keyProblem(field, fields);
        const id = `extra-field-${index}`;
        return (
          <div key={index} className="grid gap-3 rounded-lg border p-3">
            <div className="grid grid-cols-1 gap-2 @lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_170px_auto]">
              <div className="grid gap-1">
                <Label htmlFor={`${id}-key`} className="text-[11.5px] font-normal text-muted-foreground">
                  Tên trường (Store gửi)
                </Label>
                <Input
                  id={`${id}-key`}
                  value={field.key}
                  onChange={(event) => update(index, { key: event.target.value.trim() })}
                  placeholder="activationDate"
                  spellCheck={false}
                  maxLength={40}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? `${id}-problem` : undefined}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${id}-label`} className="text-[11.5px] font-normal text-muted-foreground">
                  Tên hiển thị
                </Label>
                <Input
                  id={`${id}-label`}
                  value={field.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder="Ngày kích hoạt"
                  maxLength={100}
                  className="h-8 text-[13px]"
                />
              </div>
              <div className="grid gap-1">
                <span className="text-[11.5px] text-muted-foreground">Kiểu</span>
                <SmallSelect
                  value={field.type}
                  onChange={(type) => update(index, { type })}
                  options={EXTRA_FIELD_TYPES}
                  labels={TYPE_LABELS}
                  ariaLabel={`Kiểu của ${field.key || "trường thêm"}`}
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex h-8 items-center gap-2">
                  <Switch
                    id={`${id}-required`}
                    checked={field.required}
                    onCheckedChange={(required) => update(index, { required })}
                  />
                  <Label htmlFor={`${id}-required`} className="text-[13px] font-normal whitespace-nowrap">
                    Bắt buộc
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="icon-sm"
                  className="ml-auto"
                  onClick={() => setFields(fields.filter((_, i) => i !== index))}
                  aria-label={`Xoá trường ${field.key || index + 1}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>
            {problem ? (
              <p id={`${id}-problem`} className="text-[12.5px] text-danger">
                {problem}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[12px] text-muted-foreground">Áp cho thao tác (không chọn là mọi thao tác):</span>
              {spec.actions.map((action) => (
                <div key={action} className="flex items-center gap-2">
                  <Checkbox
                    id={`${id}-action-${action}`}
                    checked={field.actions.includes(action)}
                    onCheckedChange={(checked) =>
                      update(index, {
                        actions:
                          checked === true
                            ? [...field.actions, action]
                            : field.actions.filter((item) => item !== action),
                      })
                    }
                  />
                  <Label htmlFor={`${id}-action-${action}`} className="text-[13px] font-normal">
                    {actionLabel(action)}
                  </Label>
                </div>
              ))}
            </div>
            {field.key && !problem ? (
              <p className="text-[12px] text-muted-foreground">
                Dùng trong API: <code className="font-mono text-foreground">{`{{order.extra.${field.key}}}`}</code>
                {field.type === "TEXT_LIST" ? " · trường body chọn kiểu Danh sách" : ""}
                {field.type === "NUMBER" ? " · trường body chọn kiểu Số" : ""}
                {!field.required && field.type === "DATE" ? (
                  <>
                    {" · thiếu thì lấy hôm nay: "}
                    <code className="font-mono text-foreground">{`{{order.extra.${field.key}||now.date}}`}</code>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= MAX_EXTRA_FIELDS}
          onClick={() => setFields([...fields, emptyExtraField()])}
        >
          <Plus aria-hidden />
          Thêm trường
        </Button>
        {fields.length > 0 ? (
          <p className="min-w-0 text-[12px] text-muted-foreground">
            Store gửi:{" "}
            <code className="font-mono break-all text-foreground">{`"extra": ${JSON.stringify(sample)}`}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
