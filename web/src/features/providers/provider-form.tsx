"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound } from "lucide-react";
import { RadioGroup } from "radix-ui";
import type { ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Field, fieldControlProps, PasswordInput } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AUTH_TYPE_META, CATEGORY_META, SYNC_INTERVAL_OPTIONS } from "./constants";
import {
  PROVIDER_AUTH_TYPES,
  PROVIDER_CATEGORIES,
  type Provider,
  type ProviderCredentialsInput,
  type ProviderInput,
} from "./types";

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,49}$/, "2–50 ký tự in hoa, số hoặc gạch dưới, bắt đầu bằng chữ cái"),
  name: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(100, "Tên tối đa 100 ký tự"),
  category: z.enum(PROVIDER_CATEGORIES),
  description: z.string().trim().max(255, "Mô tả tối đa 255 ký tự"),
  baseUrl: z
    .string()
    .trim()
    .pipe(z.url({ protocol: /^https?$/, error: "URL không hợp lệ, cần bắt đầu bằng http:// hoặc https://" })),
  timeoutSeconds: z
    .number({ error: "Nhập số giây" })
    .int("Nhập số nguyên")
    .min(1, "Tối thiểu 1 giây")
    .max(120, "Tối đa 120 giây"),
  authType: z.enum(PROVIDER_AUTH_TYPES),
  apiKey: z.string().trim(),
  clientId: z.string().trim(),
  clientSecret: z.string(),
  username: z.string().trim(),
  password: z.string(),
  syncIntervalMinutes: z.number(),
  active: z.boolean(),
});

export type ProviderFormValues = z.infer<typeof schema>;

function defaultsFrom(provider?: Provider): ProviderFormValues {
  return {
    code: provider?.code ?? "",
    name: provider?.name ?? "",
    category: provider?.category ?? "OTHER",
    description: provider?.description ?? "",
    baseUrl: provider?.baseUrl ?? "https://",
    timeoutSeconds: provider ? Math.round(provider.timeoutMs / 1000) : 10,
    authType: provider?.authType ?? "API_KEY",
    apiKey: "",
    clientId: provider?.credentials.clientId ?? "",
    clientSecret: "",
    username: provider?.credentials.username ?? "",
    password: "",
    syncIntervalMinutes: provider?.syncIntervalMinutes ?? 60,
    active: provider ? provider.status !== "INACTIVE" : true,
  };
}

export function toProviderInput(values: ProviderFormValues): ProviderInput {
  const credentials: ProviderCredentialsInput = {};
  if (values.authType === "API_KEY" && values.apiKey) credentials.apiKey = values.apiKey;
  if (values.authType === "OAUTH2") {
    if (values.clientId) credentials.clientId = values.clientId;
    if (values.clientSecret) credentials.clientSecret = values.clientSecret;
  }
  if (values.authType === "BASIC") {
    if (values.username) credentials.username = values.username;
    if (values.password) credentials.password = values.password;
  }
  return {
    code: values.code,
    name: values.name,
    category: values.category,
    description: values.description || undefined,
    baseUrl: values.baseUrl,
    authType: values.authType,
    timeoutMs: values.timeoutSeconds * 1000,
    syncIntervalMinutes: values.syncIntervalMinutes,
    status: values.active ? "ACTIVE" : "INACTIVE",
    credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-b py-6 first:pt-0 last:border-0 last:pb-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid min-w-0 gap-5">{children}</div>
    </section>
  );
}

function StoredSecret({ label, since }: { label: string; since: string | null }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] text-success">
      <CheckCircle2 className="size-3.5" aria-hidden />
      {label}
      {since ? <span className="text-muted-foreground">· cập nhật {formatDate(since)}</span> : null}
    </p>
  );
}

interface ProviderFormProps {
  id: string;
  className?: string;
  bodyClassName?: string;
  provider?: Provider;
  readOnly?: boolean;
  onSubmit: (values: ProviderFormValues) => Promise<unknown>;
  footer: (state: { isSubmitting: boolean; isDirty: boolean; reset: () => void }) => ReactNode;
}

export function ProviderForm({
  id,
  className,
  bodyClassName,
  provider,
  readOnly = false,
  onSubmit,
  footer,
}: ProviderFormProps) {
  const isEdit = Boolean(provider);
  const form = useForm<ProviderFormValues>({ resolver: zodResolver(schema), defaultValues: defaultsFrom(provider) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const authType = useWatch({ control: form.control, name: "authType" });
  const secretPlaceholder = isEdit ? "Để trống nếu giữ nguyên" : "";

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      form.reset({ ...values, apiKey: "", clientSecret: "", password: "" });
    } catch {
      return;
    }
  });

  return (
    <form id={id} onSubmit={submit} noValidate className={className}>
      <fieldset disabled={readOnly} className={cn("min-w-0", bodyClassName)}>
        <Section
          title="Thông tin chung"
          description="Tên hiển thị và phân loại giúp nhận diện nhà cung cấp trên toàn hệ thống."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${id}-name`} label="Tên nhà cung cấp" required error={errors.name?.message}>
              <Input
                {...fieldControlProps(`${id}-name`, errors.name?.message)}
                {...form.register("name")}
                autoComplete="off"
                placeholder="CRM Nova"
              />
            </Field>
            <Field
              id={`${id}-code`}
              label="Mã định danh"
              required={!isEdit}
              error={errors.code?.message}
              hint={isEdit ? "Mã không thể thay đổi sau khi tạo." : "Ví dụ: CRM_NOVA"}
            >
              <Input
                {...fieldControlProps(`${id}-code`, errors.code?.message, true)}
                {...form.register("code", {
                  onChange: (event: { target: { value: string } }) =>
                    form.setValue("code", event.target.value.toUpperCase().replace(/[\s-]+/g, "_")),
                })}
                readOnly={isEdit}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase"
                placeholder="CRM_NOVA"
              />
            </Field>
          </div>
          <Field id={`${id}-category`} label="Nhóm" error={errors.category?.message}>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger id={`${id}-category`} className="sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_META[category].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id={`${id}-description`} label="Mô tả" error={errors.description?.message}>
            <Textarea
              {...fieldControlProps(`${id}-description`, errors.description?.message)}
              {...form.register("description")}
              rows={2}
              placeholder="Dữ liệu nào được đồng bộ từ nhà cung cấp này?"
            />
          </Field>
        </Section>

        <Section title="Kết nối" description="Địa chỉ API gốc và thời gian chờ tối đa cho mỗi request.">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
            <Field id={`${id}-url`} label="Base URL" required error={errors.baseUrl?.message}>
              <Input
                {...fieldControlProps(`${id}-url`, errors.baseUrl?.message)}
                {...form.register("baseUrl")}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-[13px]"
                placeholder="https://api.nhacungcap.vn/v1"
              />
            </Field>
            <Field id={`${id}-timeout`} label="Timeout (giây)" error={errors.timeoutSeconds?.message}>
              <Input
                {...fieldControlProps(`${id}-timeout`, errors.timeoutSeconds?.message)}
                {...form.register("timeoutSeconds", { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                className="tabular-nums"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Xác thực"
          description="Thông tin bí mật chỉ được gửi lên máy chủ, không bao giờ hiển thị lại đầy đủ."
        >
          <Controller
            control={form.control}
            name="authType"
            render={({ field }) => (
              <RadioGroup.Root
                value={field.value}
                onValueChange={field.onChange}
                disabled={readOnly}
                aria-label="Phương thức xác thực"
                className="grid gap-2 sm:grid-cols-3"
              >
                {PROVIDER_AUTH_TYPES.map((type) => (
                  <RadioGroup.Item
                    key={type}
                    value={type}
                    className="group rounded-lg border bg-card p-3 text-left transition-[border-color,box-shadow,background-color] hover:border-primary/40 disabled:opacity-60 data-[state=checked]:border-primary data-[state=checked]:bg-primary-soft/60 data-[state=checked]:shadow-[0_0_0_3px_var(--primary-soft)]"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound
                        className="size-3.5 text-muted-foreground group-data-[state=checked]:text-primary"
                        aria-hidden
                      />
                      {AUTH_TYPE_META[type].label}
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
                      {AUTH_TYPE_META[type].description}
                    </span>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            )}
          />

          {authType === "API_KEY" ? (
            <Field id={`${id}-api-key`} label="API key" error={errors.apiKey?.message}>
              <PasswordInput
                {...fieldControlProps(`${id}-api-key`, errors.apiKey?.message)}
                {...form.register("apiKey")}
                autoComplete="new-password"
                className="font-mono"
                placeholder={provider?.credentials.apiKeyLast4 ? secretPlaceholder : "sk_live_…"}
              />
              {provider?.credentials.apiKeyLast4 ? (
                <StoredSecret
                  label={`Đang dùng khóa ••••${provider.credentials.apiKeyLast4}`}
                  since={provider.credentials.updatedAt}
                />
              ) : null}
            </Field>
          ) : null}

          {authType === "OAUTH2" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={`${id}-client-id`} label="Client ID" error={errors.clientId?.message}>
                <Input
                  {...fieldControlProps(`${id}-client-id`, errors.clientId?.message)}
                  {...form.register("clientId")}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
              <Field id={`${id}-client-secret`} label="Client secret" error={errors.clientSecret?.message}>
                <PasswordInput
                  {...fieldControlProps(`${id}-client-secret`, errors.clientSecret?.message)}
                  {...form.register("clientSecret")}
                  autoComplete="new-password"
                  className="font-mono"
                  placeholder={provider?.credentials.hasSecret ? secretPlaceholder : ""}
                />
                {provider?.authType === "OAUTH2" && provider.credentials.hasSecret ? (
                  <StoredSecret label="Đã lưu client secret" since={provider.credentials.updatedAt} />
                ) : null}
              </Field>
            </div>
          ) : null}

          {authType === "BASIC" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={`${id}-username`} label="Tên đăng nhập" error={errors.username?.message}>
                <Input
                  {...fieldControlProps(`${id}-username`, errors.username?.message)}
                  {...form.register("username")}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field id={`${id}-password`} label="Mật khẩu" error={errors.password?.message}>
                <PasswordInput
                  {...fieldControlProps(`${id}-password`, errors.password?.message)}
                  {...form.register("password")}
                  autoComplete="new-password"
                  placeholder={provider?.credentials.hasSecret ? secretPlaceholder : ""}
                />
                {provider?.authType === "BASIC" && provider.credentials.hasSecret ? (
                  <StoredSecret label="Đã lưu mật khẩu" since={provider.credentials.updatedAt} />
                ) : null}
              </Field>
            </div>
          ) : null}
        </Section>

        <Section title="Đồng bộ" description="Chu kỳ đồng bộ tự động và trạng thái kích hoạt của tích hợp.">
          <Field id={`${id}-interval`} label="Chu kỳ đồng bộ">
            <Controller
              control={form.control}
              name="syncIntervalMinutes"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                  disabled={readOnly}
                >
                  <SelectTrigger id={`${id}-interval`} className="sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_INTERVAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <label
                htmlFor={`${id}-active`}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-lg border p-3",
                  readOnly && "opacity-70",
                )}
              >
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Kích hoạt tích hợp</span>
                  <span className="block text-[13px] text-muted-foreground">
                    Khi tạm dừng, hệ thống không đồng bộ và không nhận thao tác đồng bộ thủ công.
                  </span>
                </span>
                <Switch
                  id={`${id}-active`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={readOnly}
                />
              </label>
            )}
          />
        </Section>
      </fieldset>
      {footer({ isSubmitting, isDirty, reset: () => form.reset() })}
    </form>
  );
}
