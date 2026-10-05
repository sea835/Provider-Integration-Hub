"use client";

import { CheckCircle2, KeyRound, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { actionLabel } from "../constants";
import {
  ConditionsEditor,
  FieldRow,
  KeyValueEditor,
  PathInput,
  RequestEditor,
  SmallSelect,
  TemplateInput,
  type VariableList,
} from "./fields";
import { requestSummary, Section, type EditorKit } from "./section";
import {
  AUTH_TYPES,
  CALL_KINDS,
  FIELD_RULES,
  INTEGRATION_ACTIONS,
  SIGN_ALGORITHMS,
  SIGN_ENCODINGS,
  SIGN_INPUTS,
  SIGN_TARGETS,
  type CallKind,
  type IntegrationSpec,
  type SignatureSpec,
} from "./types";

const AUTH_LABELS: Record<IntegrationSpec["auth"]["type"], string> = {
  NONE: "Không cần xác thực",
  HEADER: "Khoá trong header",
  BEARER: "Bearer token",
  BASIC: "Tên đăng nhập + mật khẩu (Basic)",
  QUERY: "Khoá trên URL",
};

const ALGORITHM_LABELS: Record<SignatureSpec["algorithm"], string> = {
  HMAC_SHA256: "HMAC-SHA256",
  HMAC_SHA512: "HMAC-SHA512",
  HMAC_SHA1: "HMAC-SHA1",
  HMAC_MD5: "HMAC-MD5",
  SHA256: "SHA-256 (không khoá)",
  MD5: "MD5 (không khoá)",
};

const SIGN_INPUT_LABELS: Record<SignatureSpec["input"], string> = {
  BODY: "Body gửi đi (chưa có chữ ký)",
  TEMPLATE: "Chuỗi tự ghép",
};

const SIGN_ENCODING_LABELS: Record<SignatureSpec["encoding"], string> = {
  HEX: "Hex chữ thường",
  HEX_UPPER: "Hex chữ hoa",
  BASE64: "Base64",
};

const SIGN_TARGET_LABELS: Record<SignatureSpec["target"], string> = {
  BODY_FIELD: "Trường trong body",
  HEADER: "Header",
};

const CALL_KIND_LABELS: Record<CallKind, string> = {
  login: "Đăng nhập",
  packages: "Danh sách gói",
  check: "Kiểm tra gói",
  submit: "Đăng ký gói",
  query: "Kiểm tra trạng thái",
  orders: "Danh sách đơn",
  test: "Kiểm tra kết nối",
};

const REQUEST_VARIABLES: VariableList = [
  ["request.method", "Phương thức (GET, POST...)"],
  ["request.path", "Đường dẫn kèm tham số URL"],
  ["request.body", "Body gửi đi, chưa có chữ ký"],
];

const TOKEN_REFERENCE = /\{\{\s*token\s*\}\}/;

function durationText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds % 86400 === 0) return `${seconds / 86400} ngày`;
  if (seconds % 3600 === 0) return `${seconds / 3600} giờ`;
  if (seconds % 60 === 0) return `${seconds / 60} phút`;
  return `${seconds} giây`;
}

export interface Row {
  name: string;
  value: string;
}

function RowsEditor({
  rows,
  onChange,
  secret,
  addLabel,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  secret?: boolean;
  addLabel: string;
}) {
  const update = (index: number, patch: Partial<Row>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="grid grid-cols-1 gap-2">
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 @md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]"
        >
          <Input
            value={row.name}
            onChange={(event) => update(index, { name: event.target.value.replace(/[^A-Za-z0-9_]/g, "") })}
            placeholder="ten_bien"
            aria-label="Tên"
            spellCheck={false}
            className="h-8 font-mono text-[13px]"
          />
          {secret ? (
            <PasswordInput
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
              aria-label={`Giá trị bí mật ${row.name}`}
              autoComplete="new-password"
              className="h-8 font-mono text-[13px]"
            />
          ) : (
            <Input
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
              aria-label={`Giá trị biến ${row.name}`}
              spellCheck={false}
              className="h-8 font-mono text-[13px]"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            aria-label="Xoá dòng"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...rows, { name: "", value: "" }])}
      >
        <Plus aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

export function ConnectionTab({
  kit,
  vars,
  setVars,
  replaceSecrets,
  onReplaceSecrets,
  secretRows,
  setSecretRows,
  savedSecretKeys,
  secretCount,
}: {
  kit: EditorKit;
  vars: Row[];
  setVars: (rows: Row[]) => void;
  replaceSecrets: boolean;
  onReplaceSecrets: () => void;
  secretRows: Row[];
  setSecretRows: (rows: Row[]) => void;
  savedSecretKeys: string[];
  secretCount: number;
}) {
  const { spec } = kit;
  const auth = spec.auth;
  const token = spec.token;
  const sign = spec.signature;
  const usesToken = TOKEN_REFERENCE.test(
    JSON.stringify([auth, spec.headers, spec.submit.request, spec.query.request, spec.test.request]),
  );

  return (
    <>
      <Section
        {...kit.section("secrets")}
        summary={`${vars.filter((row) => row.name).length} biến · ${secretCount} bí mật`}
        title="Biến và bí mật"
        description="Biến là thông số không bí mật (mã đối tác...). Bí mật (API key, token, mật khẩu) được mã hoá và không bao giờ hiện lại. Dùng trong các ô qua nút chèn biến."
      >
        <FieldRow label="Biến" hint="Dùng dạng {{vars.ten_bien}}">
          <RowsEditor rows={vars} onChange={setVars} addLabel="Thêm biến" />
        </FieldRow>
        <FieldRow label="Bí mật" hint="Dùng dạng {{secrets.ten}}">
          {!replaceSecrets ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-subtle p-3">
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="size-4 text-success" aria-hidden />
                {savedSecretKeys.length > 0 ? (
                  savedSecretKeys.map((name) => (
                    <Badge key={name} tone="success" className="font-mono">
                      {name} ••••
                    </Badge>
                  ))
                ) : (
                  <span className="text-[13px] text-muted-foreground">Chưa có bí mật nào</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={onReplaceSecrets}>
                Thay bí mật
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {kit.supplier.hasSecrets ? (
                <p className="text-[12.5px] text-warning">Nhập lại đầy đủ mọi bí mật: lưu sẽ thay toàn bộ bí mật cũ.</p>
              ) : null}
              <RowsEditor rows={secretRows} onChange={setSecretRows} secret addLabel="Thêm bí mật" />
            </div>
          )}
        </FieldRow>
      </Section>

      <Section
        {...kit.section("auth")}
        summary={`${AUTH_LABELS[auth.type]} · ${spec.headers.length} header`}
        title="Xác thực và header chung"
        description="Áp dụng cho mọi lời gọi tới nhà cung cấp."
      >
        <FieldRow label="Cách xác thực">
          <Select value={auth.type} onValueChange={(type) => kit.set(["auth", "type"], type)}>
            <SelectTrigger className="h-8 text-[13px] sm:w-72" aria-label="Cách xác thực">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTH_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {AUTH_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        {auth.type === "HEADER" || auth.type === "QUERY" ? (
          <FieldRow label={auth.type === "HEADER" ? "Tên header và giá trị" : "Tên tham số và giá trị"}>
            <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <Input
                value={auth.name}
                onChange={(event) => kit.set(["auth", "name"], event.target.value)}
                placeholder={auth.type === "HEADER" ? "X-API-Key" : "api_key"}
                aria-label="Tên"
                spellCheck={false}
                className="h-8 font-mono text-[13px]"
              />
              <TemplateInput
                value={auth.value}
                onChange={(value) => kit.set(["auth", "value"], value)}
                variables={kit.variables}
                ariaLabel="Giá trị khoá"
                placeholder="{{secrets.apiKey}}"
              />
            </div>
          </FieldRow>
        ) : null}
        {auth.type === "BEARER" ? (
          <FieldRow label="Token">
            <TemplateInput
              value={auth.value}
              onChange={(value) => kit.set(["auth", "value"], value)}
              variables={kit.variables}
              ariaLabel="Token"
              placeholder="{{token}} hoặc {{secrets.token}}"
            />
          </FieldRow>
        ) : null}
        {auth.type === "BASIC" ? (
          <FieldRow label="Tên đăng nhập và mật khẩu">
            <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
              <TemplateInput
                value={auth.username}
                onChange={(value) => kit.set(["auth", "username"], value)}
                variables={kit.variables}
                ariaLabel="Tên đăng nhập"
                placeholder="{{vars.username}}"
              />
              <TemplateInput
                value={auth.password}
                onChange={(value) => kit.set(["auth", "password"], value)}
                variables={kit.variables}
                ariaLabel="Mật khẩu"
                placeholder="{{secrets.password}}"
              />
            </div>
          </FieldRow>
        ) : null}
        <FieldRow label="Header thêm" hint="Gửi kèm mọi lời gọi.">
          <KeyValueEditor
            items={spec.headers}
            onChange={(headers) => kit.set(["headers"], headers)}
            variables={kit.variables}
            nameLabel="Tên header"
            addLabel="Thêm header"
          />
        </FieldRow>
      </Section>

      <Section
        {...kit.section("token")}
        state={token.enabled}
        summary={token.enabled ? requestSummary(token.request) : "Không dùng"}
        title="Đăng nhập lấy token"
        description="Dùng khi nhà cung cấp bắt gọi API đăng nhập trước để lấy token. Hub tự đăng nhập, dùng chung token cho mọi đơn, tự lấy token mới khi hết hạn hoặc khi nhà cung cấp báo token sai."
      >
        <FieldRow label="Bật đăng nhập">
          <Switch
            checked={token.enabled}
            onCheckedChange={(enabled) => kit.set(["token", "enabled"], enabled)}
            aria-label="Bật đăng nhập lấy token"
          />
        </FieldRow>
        {token.enabled ? (
          <>
            <RequestEditor
              value={token.request}
              onChange={(request) => kit.set(["token", "request"], request)}
              variables={kit.loginVariables}
              pathPlaceholder="/auth/login"
            />
            <FieldRow label="Đăng nhập thành công khi" hint="Tất cả điều kiện đều đúng. Để trống = HTTP 2xx.">
              <ConditionsEditor
                items={token.success}
                onChange={(success) => kit.set(["token", "success"], success)}
                mode="response"
                addLabel="Thêm điều kiện"
              />
            </FieldRow>
            <FieldRow label="Vị trí token trong phản hồi">
              <PathInput
                value={token.tokenPath}
                onChange={(value) => kit.set(["token", "tokenPath"], value)}
                mode="body"
                label="Vị trí token"
                placeholder="accessToken hoặc data.token"
              />
            </FieldRow>
            <FieldRow
              label="Thời hạn token"
              hint="Phản hồi có số giây hết hạn thì chọn vị trí; không có thì Hub dùng số giây bên phải. Hub lấy token mới sớm hơn 1 phút."
            >
              <div className="grid grid-cols-1 gap-2 @lg:grid-cols-[minmax(0,1fr)_200px]">
                <PathInput
                  value={token.expiresInPath}
                  onChange={(value) => kit.set(["token", "expiresInPath"], value)}
                  mode="body"
                  label="Vị trí thời hạn token"
                  placeholder="expiresIn (không bắt buộc)"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={60}
                    value={Number.isFinite(token.ttlSec) ? token.ttlSec : ""}
                    onChange={(event) => kit.set(["token", "ttlSec"], Number(event.target.value))}
                    aria-label="Thời hạn mặc định (giây)"
                    className="h-8 font-mono text-[13px]"
                  />
                  <span className="text-[12px] whitespace-nowrap text-muted-foreground">
                    giây{durationText(token.ttlSec) ? ` · ${durationText(token.ttlSec)}` : ""}
                  </span>
                </div>
              </div>
            </FieldRow>
            <FieldRow
              label="Lấy token mới khi"
              hint="Chỉ cần một điều kiện đúng. Hub đăng nhập lại rồi gửi lại lời gọi đúng một lần."
            >
              <ConditionsEditor
                items={token.refreshOn}
                onChange={(refreshOn) => kit.set(["token", "refreshOn"], refreshOn)}
                mode="response"
                addLabel="Thêm điều kiện"
              />
            </FieldRow>
            <FieldRow label="Gắn token vào lời gọi">
              {usesToken ? (
                <p className="flex items-center gap-2 pt-1.5 text-[13px] text-success">
                  <CheckCircle2 className="size-4" aria-hidden />
                  {"Đã dùng {{token}} trong xác thực hoặc header."}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3">
                  <p className="text-[13px] text-warning">{"Chưa ô nào dùng {{token}} nên token chưa được gửi đi."}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => kit.set(["auth"], { ...auth, type: "BEARER", value: "{{token}}" })}
                  >
                    Gắn vào Authorization: Bearer
                  </Button>
                </div>
              )}
            </FieldRow>
          </>
        ) : null}
      </Section>

      <Section
        {...kit.section("signature")}
        state={sign.enabled}
        summary={
          sign.enabled
            ? `${ALGORITHM_LABELS[sign.algorithm]} · ${SIGN_TARGET_LABELS[sign.target]} ${sign.name}`
            : "Không dùng"
        }
        title="Chữ ký"
        description="Dùng khi nhà cung cấp bắt ký request (vd HMAC-SHA256 trên body). Hub tự tính và gắn chữ ký cho các lời gọi được chọn."
      >
        <FieldRow label="Bật chữ ký">
          <Switch
            checked={sign.enabled}
            onCheckedChange={(enabled) => kit.set(["signature", "enabled"], enabled)}
            aria-label="Bật chữ ký"
          />
        </FieldRow>
        {sign.enabled ? (
          <>
            <FieldRow label="Thuật toán">
              <SmallSelect
                value={sign.algorithm}
                onChange={(algorithm) => kit.set(["signature", "algorithm"], algorithm)}
                options={SIGN_ALGORITHMS}
                labels={ALGORITHM_LABELS}
                ariaLabel="Thuật toán ký"
                className="sm:w-72"
              />
            </FieldRow>
            {sign.algorithm.startsWith("HMAC") ? (
              <FieldRow label="Khoá ký" hint="Thường là một bí mật do nhà cung cấp cấp.">
                <TemplateInput
                  value={sign.key}
                  onChange={(value) => kit.set(["signature", "key"], value)}
                  variables={kit.loginVariables}
                  ariaLabel="Khoá ký"
                  placeholder="{{secrets.secretKey}}"
                />
              </FieldRow>
            ) : null}
            <FieldRow label="Ký trên">
              <SmallSelect
                value={sign.input}
                onChange={(input) => kit.set(["signature", "input"], input)}
                options={SIGN_INPUTS}
                labels={SIGN_INPUT_LABELS}
                ariaLabel="Nội dung cần ký"
                className="sm:w-72"
              />
            </FieldRow>
            {sign.input === "TEMPLATE" ? (
              <FieldRow label="Chuỗi cần ký" hint="Ghép từ biến, vd {{vars.partnerCode}}|{{order.transCode}}.">
                <TemplateInput
                  value={sign.template}
                  onChange={(value) => kit.set(["signature", "template"], value)}
                  variables={kit.variables}
                  extra={{ label: "Request", items: REQUEST_VARIABLES }}
                  ariaLabel="Chuỗi cần ký"
                  placeholder="{{request.method}}|{{request.path}}|{{request.body}}"
                />
              </FieldRow>
            ) : null}
            <FieldRow label="Dạng chữ ký">
              <SmallSelect
                value={sign.encoding}
                onChange={(encoding) => kit.set(["signature", "encoding"], encoding)}
                options={SIGN_ENCODINGS}
                labels={SIGN_ENCODING_LABELS}
                ariaLabel="Dạng chữ ký"
                className="sm:w-72"
              />
            </FieldRow>
            <FieldRow label="Gắn chữ ký vào" hint="Lời gọi không có body thì chữ ký gắn lên URL.">
              <div className="grid grid-cols-1 gap-2 @md:grid-cols-[180px_minmax(0,1fr)]">
                <SmallSelect
                  value={sign.target}
                  onChange={(target) => kit.set(["signature", "target"], target)}
                  options={SIGN_TARGETS}
                  labels={SIGN_TARGET_LABELS}
                  ariaLabel="Nơi gắn chữ ký"
                />
                <Input
                  value={sign.name}
                  onChange={(event) => kit.set(["signature", "name"], event.target.value)}
                  placeholder={sign.target === "HEADER" ? "X-Signature" : "signature"}
                  aria-label="Tên trường hoặc header chứa chữ ký"
                  spellCheck={false}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
            </FieldRow>
            <FieldRow label="Ký các lời gọi">
              <div className="flex flex-wrap gap-4 pt-1.5">
                {CALL_KINDS.filter(
                  (kind) =>
                    (kind !== "login" || token.enabled) &&
                    (kind !== "packages" || spec.packages.enabled) &&
                    (kind !== "check" || spec.check.enabled) &&
                    (kind !== "orders" || spec.orders.enabled),
                ).map((kind) => (
                  <div key={kind} className="flex items-center gap-2">
                    <Checkbox
                      id={`sign-${kind}`}
                      checked={sign.apply[kind]}
                      onCheckedChange={(checked) => kit.set(["signature", "apply", kind], checked === true)}
                    />
                    <Label htmlFor={`sign-${kind}`} className="text-[13px] font-normal">
                      {CALL_KIND_LABELS[kind]}
                    </Label>
                  </div>
                ))}
              </div>
            </FieldRow>
          </>
        ) : null}
      </Section>

      <Section
        {...kit.section("actions")}
        summary={
          spec.actions.length > 0
            ? spec.actions
                .map((action) => {
                  const rules = spec.fields[action];
                  const needs = [
                    rules?.phone === "REQUIRED" ? "SĐT" : null,
                    rules?.serial === "REQUIRED" ? "serial" : null,
                  ].filter(Boolean);
                  return needs.length > 0 ? `${actionLabel(action)} (cần ${needs.join(", ")})` : actionLabel(action);
                })
                .join(" · ")
            : "Chưa chọn"
        }
        title="Thao tác và trường Store phải gửi"
        description="Store gửi thao tác không được chọn sẽ bị từ chối ngay. Trường bắt buộc mà thiếu thì đơn bị từ chối (400), không gửi sang nhà cung cấp."
      >
        <div className="grid grid-cols-1 gap-2">
          <div className="hidden gap-3 px-3 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase @lg:grid @lg:grid-cols-[minmax(0,1fr)_190px_190px]">
            <span>Thao tác</span>
            <span>Số thuê bao (phone)</span>
            <span>Serial SIM</span>
          </div>
          {INTEGRATION_ACTIONS.map((action) => {
            const enabled = spec.actions.includes(action);
            const rules = spec.fields[action] ?? { phone: "OPTIONAL", serial: "OPTIONAL" };
            return (
              <div
                key={action}
                className="grid grid-cols-1 items-center gap-2 rounded-lg border p-3 @lg:grid-cols-[minmax(0,1fr)_190px_190px] @lg:gap-3"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`action-${action}`}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      kit.set(
                        ["actions"],
                        checked === true ? [...spec.actions, action] : spec.actions.filter((item) => item !== action),
                      )
                    }
                  />
                  <Label htmlFor={`action-${action}`} className="text-[13px] font-normal">
                    {actionLabel(action)}
                    <span className="ml-2 font-mono text-[11.5px] text-muted-foreground">{action}</span>
                  </Label>
                </div>
                {enabled ? (
                  <>
                    <div className="grid gap-1">
                      <span className="text-[11.5px] text-muted-foreground @lg:hidden">Số thuê bao</span>
                      <SmallSelect
                        value={rules.phone}
                        onChange={(phone) => kit.set(["fields", action], { ...rules, phone })}
                        options={FIELD_RULES}
                        labels={{ REQUIRED: "Bắt buộc", OPTIONAL: "Không bắt buộc" }}
                        ariaLabel={`Số thuê bao cho ${actionLabel(action)}`}
                      />
                    </div>
                    <div className="grid gap-1">
                      <span className="text-[11.5px] text-muted-foreground @lg:hidden">Serial SIM</span>
                      <SmallSelect
                        value={rules.serial}
                        onChange={(serial) => kit.set(["fields", action], { ...rules, serial })}
                        options={FIELD_RULES}
                        labels={{ REQUIRED: "Bắt buộc", OPTIONAL: "Không bắt buộc" }}
                        ariaLabel={`Serial cho ${actionLabel(action)}`}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground @lg:col-span-2">Không nhận thao tác này</p>
                )}
              </div>
            );
          })}
          <p className="text-[12px] text-muted-foreground">
            Số thuê bao gửi kèm luôn được kiểm tra định dạng (10 số, bắt đầu 0 hoặc 84), kể cả khi không bắt buộc.
          </p>
        </div>
      </Section>
    </>
  );
}
