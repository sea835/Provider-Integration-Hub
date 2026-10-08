"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldRow, SmallSelect, TemplateInput, type VariableList } from "./fields";
import { Section, type EditorKit } from "./section";
import { emptySignatureRule } from "./state";
import {
  CALL_KINDS,
  HTTP_METHODS,
  MAX_SIGNATURE_RULES,
  SIGN_ALGORITHMS,
  SIGN_ENCODINGS,
  SIGN_INPUTS,
  SIGN_TARGETS,
  type CallKind,
  type HttpMethod,
  type SignatureRule,
} from "./types";

const ALGORITHM_LABELS: Record<SignatureRule["algorithm"], string> = {
  HMAC_SHA256: "HMAC-SHA256",
  HMAC_SHA512: "HMAC-SHA512",
  HMAC_SHA1: "HMAC-SHA1",
  HMAC_MD5: "HMAC-MD5",
  SHA256: "SHA-256 (không khoá)",
  MD5: "MD5 (không khoá)",
};

const SIGN_INPUT_LABELS: Record<SignatureRule["input"], string> = {
  BODY: "Body gửi đi (chưa có chữ ký)",
  TEMPLATE: "Chuỗi tự ghép",
};

const SIGN_ENCODING_LABELS: Record<SignatureRule["encoding"], string> = {
  HEX: "Hex chữ thường",
  HEX_UPPER: "Hex chữ hoa",
  BASE64: "Base64",
};

const SIGN_TARGET_LABELS: Record<SignatureRule["target"], string> = {
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
  ["request.path", "Đường dẫn kèm tham số URL, vd /v1/products?page=0"],
  ["request.query", "Chỉ tham số URL sau dấu ?, đúng như gửi đi, vd page=0&limit=10"],
  ["request.body", "Body gửi đi, chưa có chữ ký"],
];

function ruleSummary(rule: SignatureRule): string {
  const methods = rule.methods.length > 0 ? rule.methods.join("/") : "mọi phương thức";
  return `${rule.label || "Chưa đặt tên"}: ${ALGORITHM_LABELS[rule.algorithm]} · ${methods} → ${SIGN_TARGET_LABELS[rule.target]} ${rule.name}`;
}

function RuleCard({
  kit,
  rule,
  index,
  count,
  kinds,
  onMove,
  onRemove,
}: {
  kit: EditorKit;
  rule: SignatureRule;
  index: number;
  count: number;
  kinds: CallKind[];
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const at = (...path: Array<string | number>) => ["signature", "rules", index, ...path];
  const id = `sign-rule-${index}`;
  const toggleMethod = (method: HttpMethod, checked: boolean) =>
    kit.set(
      at("methods"),
      HTTP_METHODS.filter((item) => (item === method ? checked : rule.methods.includes(item))),
    );

  return (
    <fieldset className="grid gap-4 rounded-lg border p-4" aria-labelledby={`${id}-legend`}>
      <legend id={`${id}-legend`} className="sr-only">
        Quy tắc chữ ký {index + 1}: {rule.label}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral" className="font-mono">
          {index + 1}
        </Badge>
        <Input
          value={rule.label}
          onChange={(event) => kit.set(at("label"), event.target.value)}
          maxLength={60}
          placeholder="Tên quy tắc, vd Ký GET"
          aria-label={`Tên quy tắc chữ ký ${index + 1}`}
          className="h-8 min-w-0 flex-1 basis-48 text-[13px] font-medium"
        />
        {count > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
              aria-label={`Đưa quy tắc ${rule.label} lên trên`}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === count - 1}
              onClick={() => onMove(index + 1)}
              aria-label={`Đưa quy tắc ${rule.label} xuống dưới`}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button
              type="button"
              variant="destructive-ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label={`Xoá quy tắc ${rule.label}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      <FieldRow label="Áp cho lời gọi" hint="Chỉ các API đang bật mới hiện ở đây.">
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5">
          {kinds.map((kind) => (
            <div key={kind} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${kind}`}
                checked={rule.apply[kind]}
                onCheckedChange={(checked) => kit.set(at("apply", kind), checked === true)}
              />
              <Label htmlFor={`${id}-${kind}`} className="text-[13px] font-normal">
                {CALL_KIND_LABELS[kind]}
              </Label>
            </div>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Chỉ phương thức" hint="Không chọn gì là áp cho mọi phương thức.">
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5">
          {HTTP_METHODS.map((method) => (
            <div key={method} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-method-${method}`}
                checked={rule.methods.includes(method)}
                onCheckedChange={(checked) => toggleMethod(method, checked === true)}
              />
              <Label htmlFor={`${id}-method-${method}`} className="font-mono text-[12.5px] font-normal">
                {method}
              </Label>
            </div>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Thuật toán">
        <SmallSelect
          value={rule.algorithm}
          onChange={(algorithm) => kit.set(at("algorithm"), algorithm)}
          options={SIGN_ALGORITHMS}
          labels={ALGORITHM_LABELS}
          ariaLabel="Thuật toán ký"
          className="sm:w-72"
        />
      </FieldRow>
      {rule.algorithm.startsWith("HMAC") ? (
        <FieldRow label="Khoá ký" hint="Thường là một bí mật do nhà cung cấp cấp.">
          <TemplateInput
            value={rule.key}
            onChange={(value) => kit.set(at("key"), value)}
            variables={kit.loginVariables}
            ariaLabel="Khoá ký"
            placeholder="{{secrets.secretKey}}"
          />
        </FieldRow>
      ) : null}
      <FieldRow label="Ký trên">
        <SmallSelect
          value={rule.input}
          onChange={(input) => kit.set(at("input"), input)}
          options={SIGN_INPUTS}
          labels={SIGN_INPUT_LABELS}
          ariaLabel="Nội dung cần ký"
          className="sm:w-72"
        />
      </FieldRow>
      {rule.input === "TEMPLATE" ? (
        <FieldRow
          label="Chuỗi cần ký"
          hint="Ghép từ biến, vd {{vars.partnerCode}}|{{order.transCode}}. Ký tham số URL: {{request.query}}."
        >
          <TemplateInput
            value={rule.template}
            onChange={(value) => kit.set(at("template"), value)}
            variables={kit.variables}
            extra={{ label: "Request", items: REQUEST_VARIABLES }}
            ariaLabel="Chuỗi cần ký"
            placeholder="{{request.method}}|{{request.path}}|{{request.body}}"
          />
        </FieldRow>
      ) : null}
      <FieldRow label="Dạng chữ ký">
        <SmallSelect
          value={rule.encoding}
          onChange={(encoding) => kit.set(at("encoding"), encoding)}
          options={SIGN_ENCODINGS}
          labels={SIGN_ENCODING_LABELS}
          ariaLabel="Dạng chữ ký"
          className="sm:w-72"
        />
      </FieldRow>
      <FieldRow
        label="Gắn chữ ký vào"
        hint={
          rule.target === "HEADER"
            ? "Lời gọi không có body thì chữ ký gắn lên URL."
            : "Hub ký trước rồi mới thêm trường này vào body, nên chuỗi ký không chứa chữ ký. Trường lồng nhau viết vd data.signature. Lời gọi không có body thì chữ ký gắn lên URL."
        }
      >
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-[180px_minmax(0,1fr)]">
          <SmallSelect
            value={rule.target}
            onChange={(target) => kit.set(at("target"), target)}
            options={SIGN_TARGETS}
            labels={SIGN_TARGET_LABELS}
            ariaLabel="Nơi gắn chữ ký"
          />
          <Input
            value={rule.name}
            onChange={(event) => kit.set(at("name"), event.target.value)}
            placeholder={rule.target === "HEADER" ? "X-Signature" : "signature"}
            aria-label="Tên trường hoặc header chứa chữ ký"
            spellCheck={false}
            className="h-8 font-mono text-[13px]"
          />
        </div>
      </FieldRow>
    </fieldset>
  );
}

export function SignatureSection({ kit }: { kit: EditorKit }) {
  const { spec } = kit;
  const sign = spec.signature;
  const kinds = CALL_KINDS.filter(
    (kind) =>
      (kind !== "login" || spec.token.enabled) &&
      (kind !== "packages" || spec.packages.enabled) &&
      (kind !== "check" || spec.check.enabled) &&
      (kind !== "orders" || spec.orders.enabled),
  );

  const setRules = (rules: SignatureRule[]) => kit.set(["signature", "rules"], rules);
  const move = (from: number, to: number) => {
    const rules = [...sign.rules];
    const [rule] = rules.splice(from, 1);
    rules.splice(to, 0, rule);
    setRules(rules);
  };
  const add = () => {
    const rule = emptySignatureRule(`Quy tắc ${sign.rules.length + 1}`);
    const previous = sign.rules.at(-1);
    setRules([
      ...sign.rules,
      {
        ...rule,
        algorithm: previous?.algorithm ?? rule.algorithm,
        key: previous?.key ?? rule.key,
        apply: Object.fromEntries(CALL_KINDS.map((kind) => [kind, false])) as SignatureRule["apply"],
      },
    ]);
  };

  return (
    <Section
      {...kit.section("signature")}
      state={sign.enabled}
      summary={
        !sign.enabled
          ? "Không dùng"
          : sign.rules.length === 1
            ? ruleSummary(sign.rules[0])
            : `${sign.rules.length} quy tắc: ${sign.rules.map((rule) => rule.label || "Chưa đặt tên").join(" · ")}`
      }
      title="Chữ ký"
      description="Dùng khi nhà cung cấp bắt ký request. Mỗi API, mỗi phương thức có thể ký một kiểu: request dùng quy tắc ĐẦU TIÊN (từ trên xuống) khớp cả lời gọi lẫn phương thức; không quy tắc nào khớp thì không ký."
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
          {sign.rules.map((rule, index) => (
            <RuleCard
              key={index}
              kit={kit}
              rule={rule}
              index={index}
              count={sign.rules.length}
              kinds={kinds}
              onMove={(to) => move(index, to)}
              onRemove={() => setRules(sign.rules.filter((_, i) => i !== index))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={add}
            disabled={sign.rules.length >= MAX_SIGNATURE_RULES}
          >
            <Plus aria-hidden />
            Thêm quy tắc chữ ký
          </Button>
        </>
      ) : null}
    </Section>
  );
}
