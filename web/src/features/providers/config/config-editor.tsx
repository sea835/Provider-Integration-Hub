"use client";

import { FloppyDisk, Play } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSaveSamples, useTestConnection, useUpdateProviderConfig } from "../hooks";
import {
  AUTH_TYPES,
  SIGN_ALGORITHMS,
  SIGN_ENCODINGS,
  SIGN_INPUTS,
  SIGN_TARGETS,
  type AuthType,
  type CallKind,
  type IntegrationSpec,
  type KeyValue,
  type ProbeStep,
  type Provider,
  type ProviderConfig,
  type ProviderSamples,
  type ResponseSample,
  type SignAlgorithm,
  type SignEncoding,
  type SignInput,
  type SignTarget,
} from "../types";
import { HostsEditor } from "./hosts-editor";
import { ConditionList, KeyValueList } from "./list-editors";
import { PayloadPickerButton, SampleNote } from "./payload-picker";
import { RequestEditor } from "./request-editor";
import { emptySecretsDraft, SecretsEditor, secretsPatchOf, type SecretsDraft } from "./secrets-editor";
import {
  REQUEST_VARIABLES,
  TemplateInput,
  variableGroupsOf,
  VariablesProvider,
  type VariableGroup,
} from "./template-input";
import { TestPanel } from "./test-panel";

const AUTH_LABELS: Record<AuthType, string> = {
  NONE: "Không dùng",
  BEARER: "Bearer token",
  BASIC: "Basic (tài khoản + mật khẩu)",
  HEADER: "Khóa trong header",
  QUERY: "Khóa trong query",
};

const INPUT_LABELS: Record<SignInput, string> = { BODY: "Body thô của request", TEMPLATE: "Chuỗi tự ghép" };
const ENCODING_LABELS: Record<SignEncoding, string> = { HEX: "Hex thường", HEX_UPPER: "Hex in hoa", BASE64: "Base64" };
const TARGET_LABELS: Record<SignTarget, string> = { HEADER: "Header", BODY_FIELD: "Trường trong body / query" };

interface Draft {
  config: ProviderConfig;
  vars: KeyValue[];
  unitMultiplier: string;
  secrets: SecretsDraft;
}

function draftOf(provider: Provider): Draft {
  return {
    config: structuredClone(provider.config),
    vars: Object.entries(provider.config.vars).map(([name, value]) => ({ name, value, omitIfEmpty: false })),
    unitMultiplier: String(provider.unitMultiplier),
    secrets: emptySecretsDraft(),
  };
}

function configOf(draft: Draft): ProviderConfig {
  return {
    ...draft.config,
    vars: Object.fromEntries(
      draft.vars.filter((item) => item.name.trim() !== "").map((item) => [item.name.trim(), item.value]),
    ),
  };
}

const API_NAMES: Record<CallKind, string> = { login: "API đăng nhập", balance: "API số dư" };

function sampleOf(step: ProbeStep): ResponseSample | null {
  return step.response.status === undefined
    ? null
    : { httpStatus: step.response.status, body: step.response.body ?? null, capturedAt: new Date().toISOString() };
}

function Section({
  title,
  description,
  toggle,
  action,
  children,
}: {
  title: string;
  description: ReactNode;
  toggle?: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean };
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {toggle ? (
            <Switch
              checked={toggle.checked}
              onCheckedChange={toggle.onChange}
              disabled={toggle.disabled}
              aria-label={toggle.label}
            />
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-4 grid gap-5">{children}</div> : null}
    </Card>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
  mono = true,
  className,
  picker,
  template,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  className?: string;
  picker?: { sample: ResponseSample | undefined; apiName: string };
  template?: true | VariableGroup[];
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        {template ? (
          <TemplateInput
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            label={label}
            className="flex-1"
            extraGroups={template === true ? undefined : template}
          />
        ) : (
          <Input
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={mono ? "font-mono text-[13px]" : undefined}
            spellCheck={false}
            autoComplete="off"
          />
        )}
        {picker ? (
          <PayloadPickerButton
            sample={picker.sample}
            apiName={picker.apiName}
            fieldLabel={label}
            disabled={disabled}
            onPick={(path) => onChange(path)}
          />
        ) : null}
      </div>
      {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ChoiceField<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  onChange,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels?: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels ? labels[option] : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ConfigEditor({ provider, readOnly }: { provider: Provider; readOnly: boolean }) {
  const [draft, setDraft] = useState(() => draftOf(provider));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftOf(provider)));
  const save = useUpdateProviderConfig();
  const test = useTestConnection();
  const saveSamples = useSaveSamples();
  const [testScope, setTestScope] = useState<CallKind>("balance");
  const panelRef = useRef<HTMLDivElement>(null);
  const { samples } = provider;
  const loginPicker = { sample: samples.login, apiName: API_NAMES.login };
  const balancePicker = { sample: samples.balance, apiName: API_NAMES.balance };

  const dirty = JSON.stringify(draft) !== baseline;
  const { spec } = draft.config;
  const multiplier = Number(draft.unitMultiplier);
  const multiplierValid = Number.isFinite(multiplier) && multiplier > 0;
  const busy = save.isPending;
  const locked = readOnly || busy;

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setSpec = (patch: Partial<IntegrationSpec>) =>
    setDraft((current) => ({ ...current, config: { ...current.config, spec: { ...current.config.spec, ...patch } } }));

  const payload = () => ({
    config: configOf(draft),
    secrets: secretsPatchOf(draft.secrets),
    unitMultiplier: multiplierValid ? multiplier : 1,
  });

  const storeSamples = (patch: ProviderSamples, announce: boolean) =>
    saveSamples.mutate(
      { id: provider.id, samples: patch },
      {
        onSuccess: () => {
          if (!announce) return;
          const names = (Object.keys(patch) as CallKind[]).map((kind) => API_NAMES[kind]).join(", ");
          toast.success("Đã lưu payload mẫu", { description: names });
        },
      },
    );

  const runTest = (scope: CallKind) => {
    setTestScope(scope);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    test.mutate(
      { ...payload(), providerId: provider.id, scope },
      {
        onSuccess: (result) => {
          const first: ProviderSamples = {};
          for (const step of result.steps) {
            const sample = sampleOf(step);
            if (sample && !samples[step.kind]) first[step.kind] = sample;
          }
          if (Object.keys(first).length > 0) storeSamples(first, true);
        },
      },
    );
  };

  const tryButton = (scope: CallKind, enabled: boolean) => (
    <Button
      variant="outline"
      size="sm"
      disabled={!enabled}
      isLoading={test.isPending && testScope === scope}
      onClick={() => runTest(scope)}
    >
      {test.isPending && testScope === scope ? null : <Play weight="fill" aria-hidden />}
      Gọi thử
    </Button>
  );

  const onSave = () =>
    save.mutate(
      { id: provider.id, input: payload() },
      {
        onSuccess: (updated) => {
          const next = draftOf(updated);
          setDraft(next);
          setBaseline(JSON.stringify(next));
          toast.success("Đã lưu cấu hình API", { description: updated.name });
        },
      },
    );

  const secretNames = [
    ...provider.secretKeys.filter((name) => !draft.secrets.removed.includes(name)),
    ...draft.secrets.added.map((item) => item.name.trim()).filter((name) => name !== ""),
  ];
  const variableGroups = variableGroupsOf(draft.vars, [...new Set(secretNames)]);

  return (
    <VariablesProvider groups={variableGroups}>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid gap-4">
          <Section title="Kết nối" description="Địa chỉ gốc của API đối tác, các biến dùng chung và thông tin bí mật.">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <TextField
                id="config-base-url"
                label="Base URL mặc định"
                value={draft.config.baseUrl}
                onChange={(baseUrl) => setDraft((current) => ({ ...current, config: { ...current.config, baseUrl } }))}
                placeholder="https://api.doitac.vn"
                disabled={locked}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="config-multiplier">Hệ số đơn vị</Label>
                <Input
                  id="config-multiplier"
                  value={draft.unitMultiplier}
                  onChange={(event) => setDraft((current) => ({ ...current, unitMultiplier: event.target.value }))}
                  inputMode="decimal"
                  disabled={locked}
                  aria-invalid={multiplierValid ? undefined : true}
                  className="font-mono text-[13px]"
                />
                <p className="text-xs leading-snug text-muted-foreground">
                  {multiplierValid ? "Nhân với số đọc được để ra VNĐ." : "Phải là số lớn hơn 0."}
                </p>
              </div>
            </div>
            <HostsEditor
              hosts={draft.config.hosts}
              spec={spec}
              onChange={(hosts) => setDraft((current) => ({ ...current, config: { ...current.config, hosts } }))}
              disabled={locked}
            />
            <KeyValueList
              label="Biến"
              hint={<>Giá trị không bí mật dùng lại nhiều nơi, gọi bằng {"{{vars.tên}}"}.</>}
              items={draft.vars}
              onChange={(vars) => setDraft((current) => ({ ...current, vars }))}
              disabled={locked}
              namePlaceholder="Tên, ví dụ partnerCode"
              valuePlaceholder="Giá trị"
              plainValues
            />
            <SecretsEditor
              keys={provider.secretKeys}
              draft={draft.secrets}
              onChange={(secrets) => setDraft((current) => ({ ...current, secrets }))}
              disabled={locked}
            />
          </Section>

          <Section
            title="Xác thực và header"
            description={
              <>
                Áp cho mọi lời gọi. Biến dùng được: {"{{vars.*}}"}, {"{{secrets.*}}"}, {"{{token}}"}, {"{{now.unixMs}}"}
                , {"{{now.unixSec}}"}, {"{{now.iso}}"}, {"{{uuid}}"}.
              </>
            }
          >
            <ChoiceField
              id="config-auth-type"
              label="Kiểu xác thực"
              value={spec.auth.type}
              options={AUTH_TYPES}
              labels={AUTH_LABELS}
              onChange={(type) => setSpec({ auth: { ...spec.auth, type } })}
              disabled={locked}
              className="sm:w-80"
            />
            {spec.auth.type === "BEARER" ? (
              <TextField
                id="config-auth-value"
                label="Giá trị token"
                hint={
                  <>
                    Dùng {"{{token}}"} khi bật Đăng nhập lấy token, hoặc {"{{secrets.apiKey}}"} cho khóa cố định.
                  </>
                }
                value={spec.auth.value}
                onChange={(value) => setSpec({ auth: { ...spec.auth, value } })}
                placeholder="{{token}}"
                disabled={locked}
                template
              />
            ) : null}
            {spec.auth.type === "BASIC" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="config-auth-username"
                  label="Tài khoản"
                  value={spec.auth.username}
                  onChange={(username) => setSpec({ auth: { ...spec.auth, username } })}
                  placeholder="{{vars.username}}"
                  disabled={locked}
                  template
                />
                <TextField
                  id="config-auth-password"
                  label="Mật khẩu"
                  value={spec.auth.password}
                  onChange={(password) => setSpec({ auth: { ...spec.auth, password } })}
                  placeholder="{{secrets.password}}"
                  disabled={locked}
                  template
                />
              </div>
            ) : null}
            {spec.auth.type === "HEADER" || spec.auth.type === "QUERY" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="config-auth-name"
                  label={spec.auth.type === "HEADER" ? "Tên header" : "Tên tham số"}
                  value={spec.auth.name}
                  onChange={(name) => setSpec({ auth: { ...spec.auth, name } })}
                  placeholder={spec.auth.type === "HEADER" ? "X-Api-Key" : "api_key"}
                  disabled={locked}
                />
                <TextField
                  id="config-auth-key"
                  label="Giá trị"
                  value={spec.auth.value}
                  onChange={(value) => setSpec({ auth: { ...spec.auth, value } })}
                  placeholder="{{secrets.apiKey}}"
                  disabled={locked}
                  template
                />
              </div>
            ) : null}
            <KeyValueList
              label="Header thêm"
              items={spec.headers}
              onChange={(headers) => setSpec({ headers })}
              disabled={locked}
              namePlaceholder="Tên header"
            />
          </Section>

          <Section
            title="Đăng nhập lấy token"
            description="Hub tự đăng nhập, lưu token dùng chung, và tự đăng nhập lại khi token hết hạn."
            toggle={{
              checked: spec.token.enabled,
              onChange: (enabled) => setSpec({ token: { ...spec.token, enabled } }),
              label: "Bật đăng nhập lấy token",
              disabled: locked,
            }}
            action={readOnly || !spec.token.enabled ? null : tryButton("login", !test.isPending)}
          >
            {spec.token.enabled ? (
              <>
                <SampleNote sample={samples.login} apiName={API_NAMES.login} />
                <RequestEditor
                  id="config-token-request"
                  value={spec.token.request}
                  onChange={(request) => setSpec({ token: { ...spec.token, request } })}
                  disabled={locked}
                  pathPlaceholder="/auth/login"
                  baseUrl={draft.config.baseUrl}
                  hosts={draft.config.hosts}
                />
                <div className="grid items-end gap-4 sm:grid-cols-3">
                  <TextField
                    id="config-token-path"
                    label="Đường dẫn token"
                    value={spec.token.tokenPath}
                    onChange={(tokenPath) => setSpec({ token: { ...spec.token, tokenPath } })}
                    placeholder="body.data.accessToken"
                    disabled={locked}
                    picker={loginPicker}
                  />
                  <TextField
                    id="config-token-expires"
                    label="Đường dẫn hạn dùng (giây)"
                    value={spec.token.expiresInPath}
                    onChange={(expiresInPath) => setSpec({ token: { ...spec.token, expiresInPath } })}
                    placeholder="body.data.expiresIn"
                    disabled={locked}
                    picker={loginPicker}
                  />
                  <TextField
                    id="config-token-ttl"
                    label="Hạn mặc định (giây)"
                    value={String(spec.token.ttlSec)}
                    onChange={(value) =>
                      setSpec({ token: { ...spec.token, ttlSec: Number(value.replace(/\D/g, "")) || 0 } })
                    }
                    placeholder="3600"
                    disabled={locked}
                  />
                </div>
                <ConditionList
                  label="Đăng nhập thành công khi"
                  hint="Phải đúng mọi điều kiện."
                  items={spec.token.success}
                  onChange={(success) => setSpec({ token: { ...spec.token, success } })}
                  disabled={locked}
                  sample={samples.login}
                  apiName={API_NAMES.login}
                />
                <ConditionList
                  label="Đăng nhập lại khi API số dư trả về"
                  hint="Chỉ cần đúng một điều kiện. Hub xóa token, đăng nhập lại và gọi lại một lần."
                  items={spec.token.refreshOn}
                  onChange={(refreshOn) => setSpec({ token: { ...spec.token, refreshOn } })}
                  disabled={locked}
                  sample={samples.balance}
                  apiName={API_NAMES.balance}
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Chữ ký"
            description="Tự tính chữ ký trước khi gửi request, theo đúng cách đối tác yêu cầu."
            toggle={{
              checked: spec.signature.enabled,
              onChange: (enabled) => setSpec({ signature: { ...spec.signature, enabled } }),
              label: "Bật chữ ký",
              disabled: locked,
            }}
          >
            {spec.signature.enabled ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChoiceField
                    id="config-sign-algorithm"
                    label="Thuật toán"
                    value={spec.signature.algorithm}
                    options={SIGN_ALGORITHMS}
                    onChange={(algorithm: SignAlgorithm) => setSpec({ signature: { ...spec.signature, algorithm } })}
                    disabled={locked}
                  />
                  {spec.signature.algorithm.startsWith("HMAC") ? (
                    <TextField
                      id="config-sign-key"
                      label="Khóa ký"
                      value={spec.signature.key}
                      onChange={(key) => setSpec({ signature: { ...spec.signature, key } })}
                      placeholder="{{secrets.signKey}}"
                      disabled={locked}
                      template
                    />
                  ) : null}
                </div>
                <ChoiceField
                  id="config-sign-input"
                  label="Chuỗi đem ký"
                  value={spec.signature.input}
                  options={SIGN_INPUTS}
                  labels={INPUT_LABELS}
                  onChange={(input) => setSpec({ signature: { ...spec.signature, input } })}
                  disabled={locked}
                  className="sm:w-80"
                />
                {spec.signature.input === "TEMPLATE" ? (
                  <TextField
                    id="config-sign-template"
                    label="Mẫu chuỗi đem ký"
                    hint={
                      <>
                        Dùng thêm được {"{{request.method}}"}, {"{{request.path}}"}, {"{{request.query}}"},{" "}
                        {"{{request.body}}"}.
                      </>
                    }
                    value={spec.signature.template}
                    onChange={(template) => setSpec({ signature: { ...spec.signature, template } })}
                    placeholder="{{vars.partnerCode}}|{{now.unixMs}}|{{secrets.secretKey}}"
                    disabled={locked}
                    template={[REQUEST_VARIABLES]}
                  />
                ) : null}
                <div className="grid items-end gap-4 sm:grid-cols-3">
                  <ChoiceField
                    id="config-sign-encoding"
                    label="Định dạng đầu ra"
                    value={spec.signature.encoding}
                    options={SIGN_ENCODINGS}
                    labels={ENCODING_LABELS}
                    onChange={(encoding) => setSpec({ signature: { ...spec.signature, encoding } })}
                    disabled={locked}
                  />
                  <ChoiceField
                    id="config-sign-target"
                    label="Gắn chữ ký vào"
                    value={spec.signature.target}
                    options={SIGN_TARGETS}
                    labels={TARGET_LABELS}
                    onChange={(target) => setSpec({ signature: { ...spec.signature, target } })}
                    disabled={locked}
                  />
                  <TextField
                    id="config-sign-name"
                    label="Tên header / trường"
                    value={spec.signature.name}
                    onChange={(name) => setSpec({ signature: { ...spec.signature, name } })}
                    placeholder="X-Signature"
                    disabled={locked}
                  />
                </div>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-[13px] leading-none font-medium">Ký cho lời gọi</legend>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {(
                      [
                        ["balance", "API số dư"],
                        ["login", "API đăng nhập"],
                      ] as const
                    ).map(([kind, label]) => (
                      <label key={kind} className="flex items-center gap-2 text-[13px]">
                        <Checkbox
                          checked={spec.signature.apply[kind]}
                          onCheckedChange={(checked) =>
                            setSpec({
                              signature: {
                                ...spec.signature,
                                apply: { ...spec.signature.apply, [kind]: checked === true },
                              },
                            })
                          }
                          disabled={locked}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}
          </Section>

          <Section
            title="API số dư"
            description="Lời gọi lấy số dư và cách đọc số dư từ phản hồi."
            action={readOnly ? null : tryButton("balance", !test.isPending)}
          >
            <SampleNote sample={samples.balance} apiName={API_NAMES.balance} />
            <RequestEditor
              id="config-balance-request"
              value={spec.balance.request}
              onChange={(request) => setSpec({ balance: { ...spec.balance, request } })}
              disabled={locked}
              pathPlaceholder="/v1/partner/balance"
              baseUrl={draft.config.baseUrl}
              hosts={draft.config.hosts}
            />
            <ConditionList
              label="Lời gọi thành công khi"
              hint="Phải đúng mọi điều kiện, ví dụ http.status là một trong 2xx và body.error là một trong 0."
              items={spec.balance.success}
              onChange={(success) => setSpec({ balance: { ...spec.balance, success } })}
              disabled={locked}
              sample={samples.balance}
              apiName={API_NAMES.balance}
            />
            <TextField
              id="config-balance-path"
              label="Đường dẫn tới số dư"
              hint="Chỉ nhận số hoặc chuỗi số thuần, ví dụ 1250000 hoặc 1250000.50."
              value={spec.balance.balancePath}
              onChange={(balancePath) => setSpec({ balance: { ...spec.balance, balancePath } })}
              placeholder="body.data.balance"
              disabled={locked}
              picker={balancePicker}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="config-balance-error-code"
                label="Đường dẫn mã lỗi"
                hint="Lưu vào lịch sử khi lời gọi không thành công."
                value={spec.balance.errorCodePath}
                onChange={(errorCodePath) => setSpec({ balance: { ...spec.balance, errorCodePath } })}
                placeholder="body.error"
                disabled={locked}
                picker={balancePicker}
              />
              <TextField
                id="config-balance-error-message"
                label="Đường dẫn thông điệp lỗi"
                value={spec.balance.errorMessagePath}
                onChange={(errorMessagePath) => setSpec({ balance: { ...spec.balance, errorMessagePath } })}
                placeholder="body.message"
                disabled={locked}
                picker={balancePicker}
              />
            </div>
          </Section>

          {readOnly ? null : (
            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl bg-card px-4 py-3 shadow-lift sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-muted-foreground" aria-live="polite">
                {dirty ? (
                  <span className="font-medium text-warning">Có thay đổi chưa lưu</span>
                ) : (
                  "Cấu hình đang khớp với bản đã lưu"
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={!dirty || busy}
                  onClick={() => setDraft(JSON.parse(baseline) as Draft)}
                >
                  Hoàn tác
                </Button>
                <Button disabled={!dirty || !multiplierValid} isLoading={busy} onClick={onSave}>
                  {busy ? null : <FloppyDisk aria-hidden />}
                  Lưu cấu hình
                </Button>
              </div>
            </div>
          )}
        </div>

        {readOnly ? null : (
          <div ref={panelRef} className="scroll-mt-4 xl:sticky xl:top-6">
            <TestPanel
              result={test.data}
              error={test.error}
              isPending={test.isPending}
              onRun={() => runTest("balance")}
              onSaveSample={(step) => {
                const sample = sampleOf(step);
                if (sample) storeSamples({ [step.kind]: sample }, true);
              }}
              isSavingSample={saveSamples.isPending}
            />
          </div>
        )}
      </div>
    </VariablesProvider>
  );
}
