"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BODY_TYPES, HTTP_METHODS, type BodyType, type HostSpec, type HttpMethod, type RequestSpec } from "../types";
import { BodyFieldList, KeyValueList } from "./list-editors";
import { TemplateInput } from "./template-input";

const BODY_LABELS: Record<BodyType, string> = { NONE: "Không có body", JSON: "JSON", FORM: "Form (urlencoded)" };
const DEFAULT_HOST = "__default__";

export function RequestEditor({
  id,
  value,
  onChange,
  disabled,
  pathPlaceholder,
  baseUrl,
  hosts,
}: {
  id: string;
  value: RequestSpec;
  onChange: (value: RequestSpec) => void;
  disabled?: boolean;
  pathPlaceholder: string;
  baseUrl: string;
  hosts: HostSpec[];
}) {
  const named = hosts.filter((host) => host.key !== "");
  const missingHost = value.host !== "" && !named.some((host) => host.key === value.host);
  const hasBody = value.method !== "GET" && value.bodyType !== "NONE";
  const setMethod = (method: HttpMethod) =>
    onChange({
      ...value,
      method,
      bodyType: method === "GET" ? "NONE" : value.bodyType === "NONE" ? "JSON" : value.bodyType,
    });

  return (
    <div className="grid gap-4">
      {named.length > 0 || value.host !== "" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-host`}>Gọi tới</Label>
          <Select
            value={value.host === "" ? DEFAULT_HOST : value.host}
            onValueChange={(host) => onChange({ ...value, host: host === DEFAULT_HOST ? "" : host })}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-host`} aria-invalid={missingHost ? true : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_HOST}>Base URL mặc định{baseUrl ? ` · ${baseUrl}` : ""}</SelectItem>
              {named.map((host) => (
                <SelectItem key={host.key} value={host.key}>
                  {host.key}
                  {host.label ? ` (${host.label})` : ""}
                  {host.url ? ` · ${host.url}` : ""}
                </SelectItem>
              ))}
              {missingHost ? <SelectItem value={value.host}>{value.host} (đã xóa)</SelectItem> : null}
            </SelectContent>
          </Select>
          {missingHost ? (
            <p className="text-xs leading-snug text-danger">
              Base URL “{value.host}” không còn trong danh sách. Chọn địa chỉ khác.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-path`}>Phương thức và đường dẫn</Label>
        <div className="flex gap-2">
          <Select value={value.method} onValueChange={(method) => setMethod(method as HttpMethod)} disabled={disabled}>
            <SelectTrigger className="w-24 shrink-0 font-mono text-[13px]" aria-label="Phương thức HTTP">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TemplateInput
            id={`${id}-path`}
            value={value.path}
            onChange={(path) => onChange({ ...value, path })}
            placeholder={pathPlaceholder}
            label="đường dẫn"
            disabled={disabled}
            className="flex-1"
          />
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Nối sau Base URL đã chọn. Ghi đủ https://... để gọi thẳng một địa chỉ riêng.
        </p>
      </div>

      <KeyValueList
        label="Tham số query"
        items={value.query}
        onChange={(query) => onChange({ ...value, query })}
        disabled={disabled}
      />

      {value.method !== "GET" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-body-type`}>Kiểu body</Label>
          <Select
            value={value.bodyType}
            onValueChange={(bodyType) => onChange({ ...value, bodyType: bodyType as BodyType })}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-body-type`} className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BODY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {BODY_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {hasBody ? (
        <BodyFieldList
          items={value.body}
          onChange={(body) => onChange({ ...value, body })}
          disabled={disabled}
          typed={value.bodyType === "JSON"}
        />
      ) : null}
    </div>
  );
}
