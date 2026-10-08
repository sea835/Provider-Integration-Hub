"use client";

import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { callbackUrlOf } from "../constants";
import { CopyButton } from "../copy-button";
import { FieldRow, RANGE_VARIABLES, RequestEditor, SmallSelect } from "./fields";
import { LiveCall } from "./live-call";
import { JumpLink, requestSummary, Section, type EditorKit } from "./section";
import { RESULT_MODES, type IntegrationParams, type QuerySource, type ResultMode } from "./types";

const RESULT_MODE_META: Record<ResultMode, { label: string; short: string; hint: string }> = {
  POLL: {
    label: "Chờ tra cứu (polling)",
    short: "chờ tra cứu",
    hint: "Phản hồi tạo đơn chỉ xác nhận đã nhận đơn. Hub lưu mã đơn của nhà cung cấp, coi là đang xử lý rồi gọi API 4 hoặc 5 theo lịch (tab Cấu hình) tới khi có kết quả. Ví dụ ANI.",
  },
  SYNC: {
    label: "Trả kết quả ngay (đồng bộ)",
    short: "trả kết quả ngay",
    hint: "Nhà cung cấp xử lý xong mới trả lời, phản hồi tạo đơn đã có kết quả cuối. Hub đọc trạng thái ngay; trạng thái còn đang xử lý hoặc không rõ thì mới tra cứu.",
  },
};

const QUERY_SOURCE_LABELS: Record<QuerySource, string> = {
  SINGLE: "API tra cứu từng đơn",
  ORDERS: "Tìm trong danh sách đơn (API 5)",
};

export function ApiTab({
  kit,
  buildParams,
  draftSecrets,
  onUseAsSample,
}: {
  kit: EditorKit;
  buildParams: () => IntegrationParams;
  draftSecrets: () => Record<string, string> | undefined;
  onUseAsSample: (
    kind: "PACKAGES" | "CHECK" | "BALANCE" | "QUERY" | "ORDERS" | "TEST",
    httpStatus: number,
    body: unknown,
  ) => void;
}) {
  const { spec, supplier } = kit;
  const liveProps = {
    supplierId: supplier.id,
    supplierCode: supplier.code,
    baseUrl: supplier.baseUrl,
    actions: spec.actions,
    extraFields: spec.extraFields,
    buildParams,
    draftSecrets,
  };
  const byOrders = spec.query.source === "ORDERS";

  return (
    <>
      <Section
        {...kit.section("packagesApi")}
        state={spec.packages.enabled}
        summary={spec.packages.enabled ? requestSummary(spec.packages.request) : "Nhà cung cấp không có API này"}
        title="1. Lấy danh sách gói"
        description="Store lấy danh sách gói của nhà cung cấp qua Hub (GET /v1/suppliers/{mã NCC}/packages). Hub không lưu danh mục, nhớ kết quả 60 giây."
      >
        <FieldRow label="Nhà cung cấp có API này">
          <Switch
            checked={spec.packages.enabled}
            onCheckedChange={(enabled) => kit.set(["packages", "enabled"], enabled)}
            aria-label="Nhà cung cấp có API danh sách gói"
          />
        </FieldRow>
        {spec.packages.enabled ? (
          <>
            <RequestEditor
              value={spec.packages.request}
              onChange={(request) => kit.set(["packages", "request"], request)}
              variables={kit.variables}
              pathPlaceholder="/api/packages"
            />
            <FieldRow label="Gọi thử" hint="Store có thể lọc theo thao tác, số thuê bao, serial.">
              <LiveCall
                {...liveProps}
                kind="PACKAGES"
                request={spec.packages.request}
                onUseAsSample={(status, body) => onUseAsSample("PACKAGES", status, body)}
              />
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("packagesResult")}>Cách đọc danh sách gói</JumpLink>
          </>
        ) : null}
      </Section>

      <Section
        {...kit.section("checkApi")}
        state={spec.check.enabled}
        summary={
          spec.check.enabled
            ? `${requestSummary(spec.check.request)}${spec.check.beforeSubmit ? " · kiểm tra trước mỗi đơn" : ""}`
            : "Nhà cung cấp không có API này"
        }
        title="2. Kiểm tra gói có đăng ký được không"
        description="Store hỏi trước khi đặt (POST /v1/packages/check). Có thể để Hub tự hỏi trước lần gửi đầu của mỗi đơn."
      >
        <FieldRow label="Nhà cung cấp có API này">
          <Switch
            checked={spec.check.enabled}
            onCheckedChange={(enabled) => kit.set(["check", "enabled"], enabled)}
            aria-label="Nhà cung cấp có API kiểm tra gói"
          />
        </FieldRow>
        {spec.check.enabled ? (
          <>
            <FieldRow
              label="Kiểm tra trước mỗi đơn"
              hint="Trước lần gửi đầu, Hub hỏi API này. Không đăng ký được → đơn thất bại ngay, không gửi. Lỗi hoặc chưa rõ → vẫn gửi đơn."
            >
              <Switch
                checked={spec.check.beforeSubmit}
                onCheckedChange={(beforeSubmit) => kit.set(["check", "beforeSubmit"], beforeSubmit)}
                aria-label="Kiểm tra gói trước mỗi đơn"
              />
            </FieldRow>
            <RequestEditor
              value={spec.check.request}
              onChange={(request) => kit.set(["check", "request"], request)}
              variables={kit.variables}
              pathPlaceholder="/api/packages/check"
            />
            <FieldRow label="Gọi thử" hint="Hỏi thật nhà cung cấp; không tạo đơn.">
              <LiveCall
                {...liveProps}
                kind="CHECK"
                request={spec.check.request}
                submitRequest={spec.submit.request}
                onUseAsSample={(status, body) => onUseAsSample("CHECK", status, body)}
              />
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("checkResult")}>Cách đọc kết quả kiểm tra</JumpLink>
          </>
        ) : null}
      </Section>

      <Section
        {...kit.section("balanceApi")}
        state={spec.balance.enabled}
        summary={
          spec.balance.enabled
            ? `${requestSummary(spec.balance.request)}${spec.balance.beforeSubmit ? " · kiểm tra trước mỗi đơn" : ""}`
            : "Không dùng"
        }
        title="Số dư tại nhà cung cấp"
        description="Số dư tài khoản đại lý của mình tại nhà cung cấp (vd MoMo B2B). Admin xem ở tab Tổng quan; có thể để Hub kiểm tra trước lần gửi đầu của mỗi đơn."
      >
        <FieldRow label="Nhà cung cấp có API này">
          <Switch
            checked={spec.balance.enabled}
            onCheckedChange={(enabled) => kit.set(["balance", "enabled"], enabled)}
            aria-label="Nhà cung cấp có API số dư"
          />
        </FieldRow>
        {spec.balance.enabled ? (
          <>
            <FieldRow
              label="Kiểm tra trước mỗi đơn"
              hint="Trước lần gửi đầu, Hub hỏi số dư. Dưới mức tối thiểu → đơn thất bại ngay (INSUFFICIENT_BALANCE), không gửi. Lỗi hoặc không đọc được → vẫn gửi đơn."
            >
              <Switch
                checked={spec.balance.beforeSubmit}
                onCheckedChange={(beforeSubmit) => kit.set(["balance", "beforeSubmit"], beforeSubmit)}
                aria-label="Kiểm tra số dư trước mỗi đơn"
              />
            </FieldRow>
            <RequestEditor
              value={spec.balance.request}
              onChange={(request) => kit.set(["balance", "request"], request)}
              variables={kit.variables}
              pathPlaceholder="/telco/v1/partner/balance"
            />
            <FieldRow label="Gọi thử" hint="Hỏi thật số dư; không tạo đơn.">
              <LiveCall
                {...liveProps}
                kind="BALANCE"
                request={spec.balance.request}
                onUseAsSample={(status, body) => onUseAsSample("BALANCE", status, body)}
              />
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("balanceResult")}>Cách đọc số dư</JumpLink>
          </>
        ) : null}
      </Section>

      <Section
        {...kit.section("submitApi")}
        summary={`${requestSummary(spec.submit.request)} · ${RESULT_MODE_META[spec.submit.resultMode].short}`}
        title="3. Đăng ký gói"
        description="Hub gửi đơn với mã đơn {{order.transCode}}; gửi lại vẫn dùng đúng mã này nên nhà cung cấp phải coi là một đơn. Không gọi thử được vì sẽ tạo đơn thật."
      >
        <FieldRow label="Cách lấy kết quả" hint={RESULT_MODE_META[spec.submit.resultMode].hint}>
          <div className="grid grid-cols-1 gap-2">
            <SmallSelect
              value={spec.submit.resultMode}
              onChange={(mode) => kit.set(["submit", "resultMode"], mode)}
              options={RESULT_MODES}
              labels={{ POLL: RESULT_MODE_META.POLL.label, SYNC: RESULT_MODE_META.SYNC.label }}
              ariaLabel="Cách lấy kết quả đơn"
              className="sm:w-96"
            />
            {spec.submit.resultMode === "POLL" && !byOrders && !spec.query.request.path ? (
              <p className="text-[12.5px] text-warning">Chế độ chờ tra cứu cần cấu hình API 4 hoặc API 5.</p>
            ) : null}
          </div>
        </FieldRow>
        <RequestEditor
          value={spec.submit.request}
          onChange={(request) => kit.set(["submit", "request"], request)}
          variables={kit.variables}
          pathPlaceholder="/api/orders"
        />
        <JumpLink onClick={() => kit.reveal("submitResult")}>Cách đọc phản hồi đăng ký</JumpLink>
      </Section>

      <Section
        {...kit.section("queryApi")}
        summary={byOrders ? QUERY_SOURCE_LABELS.ORDERS : requestSummary(spec.query.request)}
        title="4. Kiểm tra trạng thái đăng ký"
        description="Hub kiểm tra theo lịch cho tới khi có kết quả cuối."
      >
        <FieldRow label="Cách kiểm tra">
          <SmallSelect
            value={spec.query.source}
            onChange={(source) => kit.set(["query", "source"], source)}
            options={["SINGLE", "ORDERS"] as const}
            labels={QUERY_SOURCE_LABELS}
            ariaLabel="Cách kiểm tra trạng thái"
            className="sm:w-80"
          />
        </FieldRow>
        {byOrders ? (
          <FieldRow label="Dùng API 5">
            <div className="grid grid-cols-1 gap-2 pt-1.5 text-[13px]">
              <p className="text-muted-foreground">
                {
                  "Hub gọi API danh sách đơn với {{order.transCode}} và khoảng 7 ngày gần nhất, rồi tìm đúng đơn theo trường so khớp. Không thấy đơn → Hub gửi lại đơn."
                }
              </p>
              {!spec.orders.enabled ? (
                <p className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-4" aria-hidden />
                  Chưa bật API 5 (danh sách đơn).
                </p>
              ) : null}
              <JumpLink onClick={() => kit.reveal("ordersApi")}>Xem API 5</JumpLink>
            </div>
          </FieldRow>
        ) : (
          <RequestEditor
            value={spec.query.request}
            onChange={(request) => kit.set(["query", "request"], request)}
            variables={kit.variables}
            pathPlaceholder="/api/orders/{{order.transCode}}"
          />
        )}
        <FieldRow label="Gọi thử" hint="Kiểm tra thật một đơn để xem nhà cung cấp trả gì.">
          <LiveCall
            {...liveProps}
            kind="QUERY"
            request={byOrders ? spec.orders.request : spec.query.request}
            onUseAsSample={(status, body) => onUseAsSample(byOrders ? "ORDERS" : "QUERY", status, body)}
          />
        </FieldRow>
        <JumpLink onClick={() => kit.reveal(byOrders ? "ordersResult" : "queryResult")}>
          Cách đọc phản hồi kiểm tra trạng thái
        </JumpLink>
      </Section>

      <Section
        {...kit.section("ordersApi")}
        state={spec.orders.enabled}
        summary={spec.orders.enabled ? requestSummary(spec.orders.request) : "Nhà cung cấp không có API này"}
        title="5. Lấy danh sách đơn đăng ký"
        description="Đơn phía nhà cung cấp trong một khoảng thời gian. Hub dùng để tra cứu dự phòng (API 4) và để xem ở tab Đơn hàng."
      >
        <FieldRow label="Nhà cung cấp có API này">
          <Switch
            checked={spec.orders.enabled}
            onCheckedChange={(enabled) => kit.set(["orders", "enabled"], enabled)}
            aria-label="Nhà cung cấp có API danh sách đơn"
          />
        </FieldRow>
        {spec.orders.enabled ? (
          <>
            <RequestEditor
              value={spec.orders.request}
              onChange={(request) => kit.set(["orders", "request"], request)}
              variables={kit.variables}
              extra={RANGE_VARIABLES}
              pathPlaceholder="/api/orders"
            />
            <FieldRow
              label="Gọi thử"
              hint="Khoảng thời gian dùng cho biến range.*; tra cứu dự phòng thì Hub thêm {{order.transCode}}."
            >
              <LiveCall
                {...liveProps}
                kind="ORDERS"
                request={spec.orders.request}
                onUseAsSample={(status, body) => onUseAsSample("ORDERS", status, body)}
              />
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("ordersResult")}>Cách đọc danh sách đơn</JumpLink>
          </>
        ) : null}
      </Section>

      <Section
        {...kit.section("testApi")}
        summary={requestSummary(spec.test.request)}
        title="Kiểm tra kết nối"
        description="Một API chỉ đọc (danh sách gói, số dư...) để kiểm tra địa chỉ và khoá. Không được tạo đơn."
      >
        <RequestEditor
          value={spec.test.request}
          onChange={(request) => kit.set(["test", "request"], request)}
          variables={kit.variables}
          pathPlaceholder="/api/packages"
        />
        <FieldRow label="Gọi thử" hint="Gọi thật API kiểm tra bằng bản đang sửa.">
          <LiveCall
            {...liveProps}
            kind="TEST"
            request={spec.test.request}
            onUseAsSample={(status, body) => onUseAsSample("TEST", status, body)}
          />
        </FieldRow>
        <JumpLink onClick={() => kit.reveal("testResult")}>Cách đọc phản hồi kiểm tra</JumpLink>
      </Section>

      <Section
        {...kit.section("callbackApi")}
        state={spec.callback.enabled}
        summary={spec.callback.enabled ? callbackUrlOf(supplier.code) : "Không dùng"}
        title="Callback"
        description="Nhà cung cấp gọi về Hub khi đơn có kết quả. Không bật thì Hub tự kiểm tra trạng thái."
      >
        <FieldRow label="Nhận callback">
          <Switch
            checked={spec.callback.enabled}
            onCheckedChange={(enabled) => kit.set(["callback", "enabled"], enabled)}
            aria-label="Nhận callback"
          />
        </FieldRow>
        {spec.callback.enabled ? (
          <>
            <FieldRow label="Địa chỉ gửi cho nhà cung cấp">
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-subtle px-3 py-2">
                <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all">{callbackUrlOf(supplier.code)}</code>
                <CopyButton value={callbackUrlOf(supplier.code)} />
              </div>
              {supplier.callbackIpWhitelist.length === 0 ? (
                <p className="mt-1.5 text-[12.5px] text-warning">
                  Chưa khai báo IP được phép gửi callback ở tab Cấu hình, mọi callback sẽ bị từ chối.
                </p>
              ) : null}
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("callbackResult")}>Cách đọc callback</JumpLink>
          </>
        ) : null}
      </Section>
    </>
  );
}
