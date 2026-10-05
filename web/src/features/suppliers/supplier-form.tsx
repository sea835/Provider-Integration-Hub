"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Plug, ShieldCheck, Sparkles } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldControlProps, PasswordInput } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { actionLabel, DEFAULT_TUNING } from "./constants";
import { CopyButton } from "./copy-button";
import type { AdapterField, AdapterType, CreateSupplierInput, Supplier, UpdateSupplierInput } from "./types";

type Mode = "create" | "edit";

const number = (message = "Nhập một số") => z.number({ error: message }).int("Nhập số nguyên");

function parseNumberList(value: string): number[] | null {
  const parts = value.split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const numbers = parts.map(Number);
  return numbers.every((item) => Number.isInteger(item) && item >= 1) ? numbers : null;
}

function parseList(value: string): string[] {
  return value.split(/[\s,;]+/).filter(Boolean);
}

function buildSchema(adapters: AdapterType[], mode: Mode) {
  return z
    .object({
      adapterType: z.string().min(1, "Chọn loại kết nối"),
      code: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_]{2,50}$/, "2–50 ký tự gồm chữ, số, gạch dưới"),
      name: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(255, "Tên tối đa 255 ký tự"),
      baseUrl: z
        .string()
        .trim()
        .pipe(z.url({ protocol: /^https?$/, error: "URL cần bắt đầu bằng http:// hoặc https://" })),
      params: z.record(z.string(), z.string()),
      secrets: z.record(z.string(), z.string()),
      replaceSecrets: z.boolean(),
      submitTimeoutSec: number().min(1, "Tối thiểu 1 giây").max(120, "Tối đa 120 giây"),
      queryTimeoutSec: number().min(1, "Tối thiểu 1 giây").max(120, "Tối đa 120 giây"),
      concurrency: number().min(1, "Tối thiểu 1").max(50, "Tối đa 50"),
      rateLimitPerMin: number().min(1, "Tối thiểu 1"),
      pollSchedule: z
        .string()
        .trim()
        .refine((value) => parseNumberList(value) !== null, "Nhập các số giây, cách nhau bằng dấu phẩy"),
      maxWaitMin: number().min(1, "Tối thiểu 1 phút"),
      maxResubmit: number().min(0, "Tối thiểu 0").max(10, "Tối đa 10"),
      callbackIps: z.string(),
    })
    .superRefine((values, ctx) => {
      const adapter = adapters.find((item) => item.type === values.adapterType);
      if (!adapter) return;
      for (const field of adapter.params) {
        if (field.required && !values.params[field.key]?.trim()) {
          ctx.addIssue({ code: "custom", path: ["params", field.key], message: `Nhập ${field.label}` });
        }
      }
      if (mode === "edit" && !values.replaceSecrets) return;
      for (const field of adapter.secrets) {
        if (field.required && !values.secrets[field.key]?.trim()) {
          ctx.addIssue({ code: "custom", path: ["secrets", field.key], message: `Nhập ${field.label}` });
        }
      }
    });
}

export type SupplierFormValues = z.infer<ReturnType<typeof buildSchema>>;

function defaultsFrom(supplier?: Supplier): SupplierFormValues {
  const tuning = supplier ?? DEFAULT_TUNING;
  return {
    adapterType: supplier?.adapterType ?? "",
    code: supplier?.code ?? "",
    name: supplier?.name ?? "",
    baseUrl: supplier?.baseUrl ?? "https://",
    params: Object.fromEntries(
      Object.entries(supplier?.params ?? {}).map(([key, value]) => [key, String(value ?? "")]),
    ),
    secrets: {},
    replaceSecrets: false,
    submitTimeoutSec: Math.round(tuning.submitTimeoutMs / 1000),
    queryTimeoutSec: Math.round(tuning.queryTimeoutMs / 1000),
    concurrency: tuning.concurrency,
    rateLimitPerMin: tuning.rateLimitPerMin,
    pollSchedule: tuning.pollScheduleSec.join(", "),
    maxWaitMin: Math.round(tuning.maxWaitSec / 60),
    maxResubmit: tuning.maxResubmit,
    callbackIps: tuning.callbackIpWhitelist.join("\n"),
  };
}

function pick(values: Record<string, string>, fields: AdapterField[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.key]?.trim();
    if (value) result[field.key] = value;
  }
  return result;
}

function tuningOf(values: SupplierFormValues) {
  return {
    submitTimeoutMs: values.submitTimeoutSec * 1000,
    queryTimeoutMs: values.queryTimeoutSec * 1000,
    concurrency: values.concurrency,
    rateLimitPerMin: values.rateLimitPerMin,
    pollScheduleSec: parseNumberList(values.pollSchedule) ?? DEFAULT_TUNING.pollScheduleSec,
    maxWaitSec: values.maxWaitMin * 60,
    maxResubmit: values.maxResubmit,
    callbackIpWhitelist: parseList(values.callbackIps),
  };
}

export function toCreateInput(values: SupplierFormValues, adapter: AdapterType): CreateSupplierInput {
  const configurable = adapter.editor === "HTTP_CONFIG";
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    adapterType: adapter.type,
    baseUrl: values.baseUrl.trim(),
    params: configurable ? (adapter.defaultParams ?? {}) : pick(values.params, adapter.params),
    ...(configurable ? {} : { secrets: pick(values.secrets, adapter.secrets) }),
    ...tuningOf(values),
  };
}

export function toUpdateInput(values: SupplierFormValues, adapter: AdapterType): UpdateSupplierInput {
  const configurable = adapter.editor === "HTTP_CONFIG";
  return {
    name: values.name.trim(),
    baseUrl: values.baseUrl.trim(),
    ...(configurable ? {} : { params: pick(values.params, adapter.params) }),
    ...(!configurable && values.replaceSecrets ? { secrets: pick(values.secrets, adapter.secrets) } : {}),
    ...tuningOf(values),
  };
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `cb_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-b py-6 first:pt-0 last:border-0 last:pb-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <div className="text-[13px] leading-relaxed text-muted-foreground">{description}</div> : null}
      </div>
      <div className="grid min-w-0 gap-5">{children}</div>
    </section>
  );
}

interface SupplierFormProps {
  id: string;
  mode: Mode;
  adapters: AdapterType[];
  supplier?: Supplier;
  readOnly?: boolean;
  className?: string;
  bodyClassName?: string;
  onSubmit: (values: SupplierFormValues, adapter: AdapterType) => Promise<unknown>;
  footer: (state: { isSubmitting: boolean; isDirty: boolean; reset: () => void }) => ReactNode;
}

export function SupplierForm({
  id,
  mode,
  adapters,
  supplier,
  readOnly = false,
  className,
  bodyClassName,
  onSubmit,
  footer,
}: SupplierFormProps) {
  const schema = useMemo(() => buildSchema(adapters, mode), [adapters, mode]);
  const form = useForm<SupplierFormValues>({ resolver: zodResolver(schema), defaultValues: defaultsFrom(supplier) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const adapterType = useWatch({ control: form.control, name: "adapterType" });
  const replaceSecrets = useWatch({ control: form.control, name: "replaceSecrets" });
  const adapter = adapters.find((item) => item.type === adapterType);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const showSecrets = mode === "create" || replaceSecrets;

  const submit = form.handleSubmit(async (values) => {
    if (!adapter) return;
    try {
      await onSubmit(values, adapter);
      form.reset({ ...values, secrets: {}, replaceSecrets: false });
      setGenerated({});
    } catch {
      return;
    }
  });

  const generate = (key: string) => {
    const value = randomSecret();
    form.setValue(`secrets.${key}`, value, { shouldDirty: true, shouldValidate: true });
    setGenerated((current) => ({ ...current, [key]: value }));
  };

  return (
    <form id={id} onSubmit={submit} noValidate className={className}>
      <div className={cn("min-h-0", bodyClassName)}>
        <fieldset disabled={readOnly} className="min-w-0">
          <Section
            title="Loại kết nối"
            description={
              mode === "create"
                ? "Chọn cách Hub nói chuyện với nhà cung cấp. Không thay đổi được sau khi tạo."
                : "Không thay đổi được sau khi tạo."
            }
          >
            <Controller
              control={form.control}
              name="adapterType"
              render={({ field }) => (
                <RadioGroup.Root
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("params", {});
                    form.setValue("secrets", {});
                    setGenerated({});
                  }}
                  disabled={readOnly || mode === "edit"}
                  aria-label="Loại kết nối"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {adapters
                    .filter((item) => mode === "create" || item.type === field.value)
                    .map((item) => (
                      <RadioGroup.Item
                        key={item.type}
                        value={item.type}
                        className="group rounded-lg border bg-card p-3.5 text-left transition-[border-color,box-shadow,background-color] hover:border-primary/40 disabled:cursor-default data-[state=checked]:border-primary data-[state=checked]:bg-primary-soft/60 data-[state=checked]:shadow-[0_0_0_3px_var(--primary-soft)]"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Plug
                            className="size-3.5 text-muted-foreground group-data-[state=checked]:text-primary"
                            aria-hidden
                          />
                          {item.label}
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">
                          {item.description}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          {item.actions.map((action) => (
                            <Badge key={action} tone="outline">
                              {actionLabel(action)}
                            </Badge>
                          ))}
                          {item.callback ? <Badge tone="info">Có callback</Badge> : null}
                        </span>
                      </RadioGroup.Item>
                    ))}
                </RadioGroup.Root>
              )}
            />
            {errors.adapterType?.message ? (
              <p role="alert" className="text-[13px] text-danger">
                {errors.adapterType.message}
              </p>
            ) : null}
          </Section>

          {adapter ? (
            <>
              <Section title="Thông tin chung" description="Mã dùng để Store chỉ định nhà cung cấp khi gửi đơn.">
                <div className="grid items-start gap-5 sm:grid-cols-2">
                  <Field id={`${id}-name`} label="Tên hiển thị" required error={errors.name?.message}>
                    <Input
                      {...fieldControlProps(`${id}-name`, errors.name?.message)}
                      {...form.register("name")}
                      autoComplete="off"
                      placeholder="NCC data Vinaphone"
                    />
                  </Field>
                  <Field
                    id={`${id}-code`}
                    label="Mã nhà cung cấp"
                    required={mode === "create"}
                    error={errors.code?.message}
                    hint={mode === "edit" ? "Không thay đổi được sau khi tạo." : "Store gửi mã này trong supplierCode."}
                  >
                    <Input
                      {...fieldControlProps(`${id}-code`, errors.code?.message, true)}
                      {...form.register("code", {
                        onChange: (event: { target: { value: string } }) =>
                          form.setValue("code", event.target.value.toUpperCase().replace(/[\s-]+/g, "_")),
                      })}
                      readOnly={mode === "edit"}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono uppercase"
                      placeholder="NCC_DEMO"
                    />
                  </Field>
                </div>
                <Field
                  id={`${id}-url`}
                  label="Địa chỉ API (Base URL)"
                  required
                  error={errors.baseUrl?.message}
                  hint="Địa chỉ gốc nhà cung cấp đưa, kể cả phần tiền tố. Ví dụ https://api.ncc.vn/hub/v1"
                >
                  <Input
                    {...fieldControlProps(`${id}-url`, errors.baseUrl?.message, true)}
                    {...form.register("baseUrl")}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono text-[13px]"
                  />
                </Field>
              </Section>

              {adapter.params.length > 0 ? (
                <Section title="Thông số" description="Thông tin không bí mật nhà cung cấp cấp cho Hub.">
                  {adapter.params.map((field) => {
                    const fieldId = `${id}-param-${field.key}`;
                    const error = errors.params?.[field.key]?.message;
                    return (
                      <Field
                        key={field.key}
                        id={fieldId}
                        label={field.label}
                        required={field.required}
                        error={error}
                        hint={field.help}
                      >
                        {field.type === "boolean" ? (
                          <Controller
                            control={form.control}
                            name={`params.${field.key}`}
                            render={({ field: control }) => (
                              <Switch
                                id={fieldId}
                                checked={control.value === "true"}
                                onCheckedChange={(checked) => control.onChange(checked ? "true" : "false")}
                                aria-describedby={field.help ? `${fieldId}-hint` : undefined}
                              />
                            )}
                          />
                        ) : (
                          <Input
                            {...fieldControlProps(fieldId, error, field.help)}
                            {...form.register(`params.${field.key}`)}
                            autoComplete="off"
                            spellCheck={false}
                            className="font-mono"
                            placeholder={field.placeholder}
                          />
                        )}
                      </Field>
                    );
                  })}
                </Section>
              ) : null}

              {adapter.secrets.length > 0 ? (
                <Section
                  title="Thông tin bí mật"
                  description="Được mã hoá khi lưu và không bao giờ hiển thị lại. Chỉ quản trị viên nhìn thấy lúc nhập."
                >
                  {mode === "edit" ? (
                    <div className="flex items-start justify-between gap-4 rounded-lg border bg-subtle p-3.5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                        <div className="text-sm">
                          <p className="font-medium">
                            {supplier?.hasSecrets ? "Đã lưu thông tin bí mật" : "Chưa có thông tin bí mật"}
                          </p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">
                            Muốn đổi thì bật công tắc và nhập lại toàn bộ các ô bên dưới.
                          </p>
                        </div>
                      </div>
                      <Controller
                        control={form.control}
                        name="replaceSecrets"
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="Thay thông tin bí mật"
                          />
                        )}
                      />
                    </div>
                  ) : null}

                  {showSecrets
                    ? adapter.secrets.map((field) => {
                        const fieldId = `${id}-secret-${field.key}`;
                        const error = errors.secrets?.[field.key]?.message;
                        const canGenerate = /callback/i.test(field.key);
                        return (
                          <Field
                            key={field.key}
                            id={fieldId}
                            label={field.label}
                            required={field.required}
                            error={error}
                            hint={field.help}
                          >
                            <div className="flex gap-2">
                              <div className="min-w-0 flex-1">
                                <PasswordInput
                                  {...fieldControlProps(fieldId, error, field.help)}
                                  {...form.register(`secrets.${field.key}`)}
                                  autoComplete="new-password"
                                  spellCheck={false}
                                  className="font-mono"
                                />
                              </div>
                              {canGenerate ? (
                                <Button type="button" variant="outline" onClick={() => generate(field.key)}>
                                  <Sparkles aria-hidden />
                                  Tạo ngẫu nhiên
                                </Button>
                              ) : null}
                            </div>
                            {generated[field.key] ? (
                              <div className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px]">
                                <KeyRound className="size-3.5 text-warning" aria-hidden />
                                <span className="text-warning">Sao chép gửi cho nhà cung cấp trước khi lưu:</span>
                                <code className="font-mono text-[12px] break-all">{generated[field.key]}</code>
                                <CopyButton value={generated[field.key]} />
                              </div>
                            ) : null}
                          </Field>
                        );
                      })
                    : null}
                </Section>
              ) : null}

              <Section
                title="Nâng cao"
                description="Giá trị mặc định phù hợp đa số nhà cung cấp. Chỉ chỉnh khi nhà cung cấp yêu cầu."
              >
                <div className="grid items-start gap-5 sm:grid-cols-2">
                  <Field
                    id={`${id}-submit-timeout`}
                    label="Chờ gửi đơn tối đa (giây)"
                    error={errors.submitTimeoutSec?.message}
                  >
                    <Input
                      {...fieldControlProps(`${id}-submit-timeout`, errors.submitTimeoutSec?.message)}
                      {...form.register("submitTimeoutSec", { valueAsNumber: true })}
                      type="number"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    id={`${id}-query-timeout`}
                    label="Chờ tra cứu tối đa (giây)"
                    error={errors.queryTimeoutSec?.message}
                  >
                    <Input
                      {...fieldControlProps(`${id}-query-timeout`, errors.queryTimeoutSec?.message)}
                      {...form.register("queryTimeoutSec", { valueAsNumber: true })}
                      type="number"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    id={`${id}-concurrency`}
                    label="Số đơn gửi song song"
                    error={errors.concurrency?.message}
                    hint="Tính trên mỗi tiến trình worker"
                  >
                    <Input
                      {...fieldControlProps(`${id}-concurrency`, errors.concurrency?.message, true)}
                      {...form.register("concurrency", { valueAsNumber: true })}
                      type="number"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    id={`${id}-rate`}
                    label="Số lời gọi tối đa mỗi phút"
                    error={errors.rateLimitPerMin?.message}
                    hint="Tính chung cho toàn hệ thống"
                  >
                    <Input
                      {...fieldControlProps(`${id}-rate`, errors.rateLimitPerMin?.message, true)}
                      {...form.register("rateLimitPerMin", { valueAsNumber: true })}
                      type="number"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    id={`${id}-max-wait`}
                    label="Chờ kết quả tối đa (phút)"
                    error={errors.maxWaitMin?.message}
                    hint="Quá thời gian này đơn chuyển sang Cần đối soát"
                  >
                    <Input
                      {...fieldControlProps(`${id}-max-wait`, errors.maxWaitMin?.message, true)}
                      {...form.register("maxWaitMin", { valueAsNumber: true })}
                      type="number"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    id={`${id}-resubmit`}
                    label="Số lần gửi lại tối đa"
                    error={errors.maxResubmit?.message}
                    hint="Khi nhà cung cấp báo không thấy đơn"
                  >
                    <Input
                      {...fieldControlProps(`${id}-resubmit`, errors.maxResubmit?.message, true)}
                      {...form.register("maxResubmit", { valueAsNumber: true })}
                      type="number"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                </div>
                <Field
                  id={`${id}-poll`}
                  label="Lịch tra cứu (giây)"
                  error={errors.pollSchedule?.message}
                  hint="Khoảng cách giữa các lần hỏi kết quả, lần lượt từ trái sang phải; hết danh sách thì lặp số cuối"
                >
                  <Input
                    {...fieldControlProps(`${id}-poll`, errors.pollSchedule?.message, true)}
                    {...form.register("pollSchedule")}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono text-[13px]"
                  />
                </Field>
                {adapter.callback ? (
                  <Field
                    id={`${id}-callback-ips`}
                    label="IP được phép gửi callback"
                    error={errors.callbackIps?.message}
                    hint="Mỗi dòng một IP. Chỉ dùng khi nhà cung cấp không ký callback; loại Chuẩn Hub v1 kiểm chữ ký nên không cần."
                  >
                    <Textarea
                      {...fieldControlProps(`${id}-callback-ips`, errors.callbackIps?.message, true)}
                      {...form.register("callbackIps")}
                      rows={2}
                      spellCheck={false}
                      className="font-mono text-[13px]"
                      placeholder="203.0.113.10"
                    />
                  </Field>
                ) : null}
              </Section>
            </>
          ) : null}
        </fieldset>
      </div>
      {footer({ isSubmitting, isDirty, reset: () => form.reset() })}
    </form>
  );
}
