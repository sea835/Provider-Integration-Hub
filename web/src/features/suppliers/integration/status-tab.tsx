"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ConditionsEditor,
  FieldRow,
  PathInput,
  RulesEditor,
  SmallSelect,
  StatusMapEditor,
  TemplateInput,
} from "./fields";
import { CHECK_MODES, MATCH_BY } from "./types";
import { JumpLink, Section, type EditorKit } from "./section";

function Disabled({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-subtle p-3 text-[13px] text-muted-foreground">
      Nhà cung cấp không có API này. Bật ở tab Các API nếu có.
      <JumpLink onClick={onEnable}>Bật API</JumpLink>
    </div>
  );
}

export function StatusTab({ kit }: { kit: EditorKit }) {
  const { spec } = kit;
  const byOrders = spec.query.source === "ORDERS";
  const failedCount = spec.order.statusMap.filter((item) => item.outcome === "FAILED").length;
  const successCount = spec.order.statusMap.filter((item) => item.outcome === "SUCCESS").length;

  return (
    <>
      <Section
        {...kit.section("orderStatus")}
        summary={`trạng thái ${spec.order.status || "?"} · ${successCount} thành công · ${failedCount} thất bại · ${spec.order.statusMap.length} giá trị`}
        title="Trạng thái đơn"
        description="Giá trị trạng thái nào là thành công, thất bại hay đang xử lý. Với danh sách đơn, dùng [*] cho từng đơn, vd data.items[*].status; Hub đọc phần sau [*] trong mỗi đơn nên cùng đường dẫn dùng được cho gửi đơn, tra cứu và callback."
      >
        <FieldRow label="Trường trạng thái">
          <PathInput
            value={spec.order.status}
            onChange={(value) => kit.set(["order", "status"], value)}
            mode="order"
            bases={kit.orderBases}
            container={kit.orderContainer}
            label="Trường trạng thái"
            placeholder="data.items[*].status hoặc status"
          />
        </FieldRow>
        <FieldRow label="Bảng trạng thái">
          <StatusMapEditor items={spec.order.statusMap} onChange={(items) => kit.set(["order", "statusMap"], items)} />
        </FieldRow>
        <FieldRow label="Mã đơn phía nhà cung cấp">
          <PathInput
            value={spec.order.supplierTransId}
            onChange={(value) => kit.set(["order", "supplierTransId"], value)}
            mode="order"
            bases={kit.orderBases}
            container={kit.orderContainer}
            label="Mã đơn phía nhà cung cấp"
            placeholder="data.items[*].id"
          />
        </FieldRow>
        <FieldRow label="Mã lỗi và tiền tố" hint="Mã ghi vào đơn = tiền tố + mã nhà cung cấp, vd ANI_4012.">
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_140px]">
            <PathInput
              value={spec.order.errorCode}
              onChange={(value) => kit.set(["order", "errorCode"], value)}
              mode="order"
              bases={kit.orderBases}
              container={kit.orderContainer}
              label="Mã lỗi của đơn"
              placeholder="data.items[*].errorCode"
            />
            <Input
              value={spec.order.errorCodePrefix}
              onChange={(event) => kit.set(["order", "errorCodePrefix"], event.target.value)}
              placeholder="ANI_"
              aria-label="Tiền tố mã lỗi"
              spellCheck={false}
              className="h-8 font-mono text-[13px]"
            />
          </div>
        </FieldRow>
        <FieldRow label="Thông báo lỗi của đơn">
          <PathInput
            value={spec.order.errorMessage}
            onChange={(value) => kit.set(["order", "errorMessage"], value)}
            mode="order"
            bases={kit.orderBases}
            container={kit.orderContainer}
            label="Thông báo lỗi của đơn"
            placeholder="data.items[*].errorMessage"
          />
        </FieldRow>
        <FieldRow label="Giao cho khách" hint="Store nhận các giá trị này khi đơn thành công.">
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
            {(
              [
                ["msisdn", "Số thuê bao"],
                ["serial", "Serial"],
                ["lpa", "Mã LPA (eSIM)"],
                ["qrUrl", "Link QR (eSIM)"],
              ] as const
            ).map(([key, label]) => (
              <PathInput
                key={key}
                value={spec.order.delivery[key]}
                onChange={(value) => kit.set(["order", "delivery", key], value)}
                mode="order"
                bases={kit.orderBases}
                container={kit.orderContainer}
                label={label}
                placeholder={label}
              />
            ))}
          </div>
        </FieldRow>
      </Section>

      <Section
        {...kit.section("packagesResult")}
        state={spec.packages.enabled}
        summary={
          spec.packages.enabled
            ? `danh sách ở ${spec.packages.listPath || "(cả phản hồi)"} · mã gói ${spec.packages.code || "?"}`
            : "Nhà cung cấp không có API danh sách gói"
        }
        title="1. Phản hồi danh sách gói"
        description="Hub đổi về dạng chuẩn cho Store: mã gói, tên, giá, mô tả. Dùng [*] cho từng gói, vd data.items[*].id."
      >
        {spec.packages.enabled ? (
          <>
            <FieldRow label="Gọi thành công khi" hint="Để trống = HTTP 2xx.">
              <ConditionsEditor
                items={spec.packages.success}
                onChange={(success) => kit.set(["packages", "success"], success)}
                mode="response"
                addLabel="Thêm điều kiện"
              />
            </FieldRow>
            <FieldRow
              label="Vị trí danh sách gói"
              hint="Vd data.items. Để trống thì Hub lấy từ các ô dạng data.items[*].x, hoặc cả phản hồi nếu nó là danh sách."
            >
              <PathInput
                value={spec.packages.listPath}
                onChange={(value) => kit.set(["packages", "listPath"], value)}
                mode="list"
                label="Vị trí danh sách gói"
                placeholder="data hoặc data.items"
              />
            </FieldRow>
            <FieldRow label="Các trường của một gói" hint="Mã gói là bắt buộc; Store dùng nó khi đăng ký.">
              <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
                {(
                  [
                    ["code", "Mã gói"],
                    ["name", "Tên gói"],
                    ["price", "Giá"],
                    ["description", "Mô tả"],
                  ] as const
                ).map(([key, label]) => (
                  <PathInput
                    key={key}
                    value={spec.packages[key]}
                    onChange={(value) => kit.set(["packages", key], value)}
                    mode="order"
                    bases={[spec.packages.listPath]}
                    container={kit.packagesContainer}
                    label={label}
                    placeholder={label}
                  />
                ))}
              </div>
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("packagesApi")}>Xem API 1</JumpLink>
          </>
        ) : (
          <Disabled onEnable={() => kit.reveal("packagesApi")} />
        )}
      </Section>

      <Section
        {...kit.section("checkResult")}
        state={spec.check.enabled}
        summary={
          !spec.check.enabled
            ? "Nhà cung cấp không có API kiểm tra gói"
            : spec.check.mode === "LIST"
              ? `Dò ${spec.check.matchValue || "{{order.packageCode}}"} trong ${spec.check.matchField || "?"}`
              : `${spec.check.eligible.length} điều kiện được · ${spec.check.ineligible.length} điều kiện không được`
        }
        title="2. Phản hồi kiểm tra gói"
        description={
          spec.check.mode === "LIST"
            ? "Nhà cung cấp trả danh sách gói thuê bao đăng ký được. Có gói của đơn trong danh sách → được; không có → không được (có kiểm tra trước mỗi đơn thì đơn thất bại ngay). Lỗi hoặc không đọc được danh sách → chưa rõ, Hub vẫn gửi đơn."
            : "Khớp điều kiện Được → đăng ký được. Khớp Không được → không đăng ký được (có kiểm tra trước mỗi đơn thì đơn thất bại ngay). Còn lại là chưa rõ, Hub vẫn gửi đơn."
        }
      >
        {spec.check.enabled ? (
          <>
            <FieldRow label="Cách xác định">
              <SmallSelect
                value={spec.check.mode}
                onChange={(mode) => kit.set(["check", "mode"], mode)}
                options={CHECK_MODES}
                labels={{
                  DIRECT: "Đọc kết quả trả về (được / không được)",
                  LIST: "Dò gói trong danh sách gói đăng ký được",
                }}
                ariaLabel="Cách xác định gói đăng ký được"
                className="sm:w-96"
              />
            </FieldRow>
          </>
        ) : null}
        {spec.check.enabled && spec.check.mode === "LIST" ? (
          <>
            <FieldRow label="Lời gọi hợp lệ khi" hint="Không khớp = chưa rõ, Hub vẫn gửi đơn. Để trống = HTTP 2xx.">
              <ConditionsEditor
                items={spec.check.success}
                onChange={(success) => kit.set(["check", "success"], success)}
                mode="response"
                addLabel="Thêm điều kiện"
                emptyText="HTTP 2xx là hợp lệ."
              />
            </FieldRow>
            <FieldRow label="Vị trí danh sách" hint="Để trống thì lấy theo ô Trường so khớp dạng data.items[*].code.">
              <PathInput
                value={spec.check.listPath}
                onChange={(value) => kit.set(["check", "listPath"], value)}
                mode="list"
                label="Vị trí danh sách gói đăng ký được"
                placeholder="data hoặc data.packages"
              />
            </FieldRow>
            <FieldRow label="Trường so khớp" hint="Trường trong mỗi gói của danh sách: mã gói hoặc tên gói.">
              <PathInput
                value={spec.check.matchField}
                onChange={(value) => kit.set(["check", "matchField"], value)}
                mode="order"
                bases={[spec.check.listPath]}
                container={() => ({
                  path: spec.check.listPath,
                  label: "Vị trí danh sách gói đăng ký được",
                  adopt: (path) => kit.set(["check", "listPath"], path),
                })}
                label="Trường so khớp gói"
                placeholder="data.packages[*].code"
              />
            </FieldRow>
            <FieldRow
              label="Giá trị của đơn đem dò"
              hint="Mặc định mã gói Store gửi. Dò theo tên gói mà Store không gửi tên trong mã gói thì khai báo trường thêm, vd {{order.extra.packageName}}."
            >
              <TemplateInput
                value={spec.check.matchValue}
                onChange={(value) => kit.set(["check", "matchValue"], value)}
                variables={kit.variables}
                ariaLabel="Giá trị của đơn đem dò"
                placeholder="{{order.packageCode}}"
              />
            </FieldRow>
            <FieldRow label="So khớp">
              <div className="flex h-8 items-center gap-2">
                <Switch
                  id="check-ignore-case"
                  checked={spec.check.ignoreCase}
                  onCheckedChange={(ignoreCase) => kit.set(["check", "ignoreCase"], ignoreCase)}
                />
                <label htmlFor="check-ignore-case" className="text-[13px]">
                  Không phân biệt chữ hoa, chữ thường (luôn bỏ khoảng trắng hai đầu)
                </label>
              </div>
            </FieldRow>
            <p className="rounded-md bg-subtle px-3 py-2 text-[12.5px] text-muted-foreground">
              Không có trong danh sách: đơn thất bại với mã <span className="font-mono">PACKAGE_NOT_ELIGIBLE</span>,
              Store tra cứu gói nhận <span className="font-mono">eligible: false</span>.
            </p>
            <JumpLink onClick={() => kit.reveal("checkApi")}>Xem API 2</JumpLink>
          </>
        ) : spec.check.enabled ? (
          <>
            <FieldRow label="Đăng ký được khi" hint="Tất cả điều kiện đều đúng.">
              <ConditionsEditor
                items={spec.check.eligible}
                onChange={(eligible) => kit.set(["check", "eligible"], eligible)}
                mode="response"
                addLabel="Thêm điều kiện"
                emptyText="Chưa khai báo."
              />
            </FieldRow>
            <FieldRow
              label="Không đăng ký được khi"
              hint="Tất cả điều kiện đều đúng. Chỉ khai báo khi nhà cung cấp nói rõ."
            >
              <ConditionsEditor
                items={spec.check.ineligible}
                onChange={(ineligible) => kit.set(["check", "ineligible"], ineligible)}
                mode="response"
                addLabel="Thêm điều kiện"
                emptyText="Chưa khai báo."
              />
            </FieldRow>
            <FieldRow label="Lý do không được" hint="Mã lỗi ghi vào đơn = tiền tố + mã nhà cung cấp.">
              <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
                <PathInput
                  value={spec.check.reasonCode}
                  onChange={(value) => kit.set(["check", "reasonCode"], value)}
                  mode="response"
                  label="Mã lý do"
                  placeholder="body.code"
                />
                <PathInput
                  value={spec.check.reasonMessage}
                  onChange={(value) => kit.set(["check", "reasonMessage"], value)}
                  mode="response"
                  label="Thông báo lý do"
                  placeholder="body.message"
                />
                <Input
                  value={spec.check.errorCodePrefix}
                  onChange={(event) => kit.set(["check", "errorCodePrefix"], event.target.value)}
                  placeholder="NCC_"
                  aria-label="Tiền tố mã lý do"
                  spellCheck={false}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("checkApi")}>Xem API 2</JumpLink>
          </>
        ) : (
          <Disabled onEnable={() => kit.reveal("checkApi")} />
        )}
      </Section>

      <Section
        {...kit.section("balanceResult")}
        state={spec.balance.enabled}
        summary={
          spec.balance.enabled
            ? `Số dư ở ${spec.balance.available || "?"} · tối thiểu ${spec.balance.minimum || "lớn hơn 0"}`
            : "Không dùng"
        }
        title="Phản hồi số dư"
        description="Đọc số dư khả dụng và so với mức tối thiểu để gửi đơn. Đủ → gửi đơn. Không đủ → đơn thất bại ngay khi bật kiểm tra trước mỗi đơn. Lỗi hoặc không đọc được → chưa rõ, Hub vẫn gửi đơn."
      >
        {spec.balance.enabled ? (
          <>
            <FieldRow label="Lời gọi hợp lệ khi" hint="Không khớp = chưa rõ. Vd MoMo: body.error là 862000000.">
              <ConditionsEditor
                items={spec.balance.success}
                onChange={(success) => kit.set(["balance", "success"], success)}
                mode="response"
                addLabel="Thêm điều kiện"
                emptyText="HTTP 2xx là hợp lệ."
              />
            </FieldRow>
            <FieldRow label="Các trường trong phản hồi" hint="Số dư khả dụng là bắt buộc.">
              <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-3">
                <div className="grid gap-1">
                  <span className="text-[11.5px] text-muted-foreground">Số dư khả dụng</span>
                  <PathInput
                    value={spec.balance.available}
                    onChange={(value) => kit.set(["balance", "available"], value)}
                    mode="response"
                    label="Số dư khả dụng"
                    placeholder="body.data.availBalance"
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-[11.5px] text-muted-foreground">Số tiền tạm giữ</span>
                  <PathInput
                    value={spec.balance.pending}
                    onChange={(value) => kit.set(["balance", "pending"], value)}
                    mode="response"
                    label="Số tiền tạm giữ"
                    placeholder="body.data.pendBalance"
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-[11.5px] text-muted-foreground">Đơn vị tiền</span>
                  <PathInput
                    value={spec.balance.currency}
                    onChange={(value) => kit.set(["balance", "currency"], value)}
                    mode="response"
                    label="Đơn vị tiền"
                    placeholder="body.data.currency"
                  />
                </div>
              </div>
            </FieldRow>
            <FieldRow
              label="Số dư tối thiểu để gửi đơn"
              hint="Số, hoặc biến: {{vars.minBalance}}, theo đơn: {{order.extra.amount}}. Để trống = chỉ cần lớn hơn 0."
            >
              <TemplateInput
                value={spec.balance.minimum}
                onChange={(value) => kit.set(["balance", "minimum"], value)}
                variables={kit.variables}
                ariaLabel="Số dư tối thiểu để gửi đơn"
                placeholder="100000"
              />
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("balanceApi")}>Xem API số dư</JumpLink>
          </>
        ) : (
          <Disabled onEnable={() => kit.reveal("balanceApi")} />
        )}
      </Section>

      <Section
        {...kit.section("submitResult")}
        summary={`${spec.submit.success.length} điều kiện thành công · ${spec.submit.rules.length} luật khi không thành công`}
        title="3. Phản hồi đăng ký gói"
        description="Khi nào nhà cung cấp đã nhận đơn, đơn nằm ở đâu, và xử lý các trường hợp không nhận."
      >
        <FieldRow label="Nhận đơn thành công khi" hint="Tất cả điều kiện đều đúng. Để trống = HTTP 2xx.">
          <ConditionsEditor
            items={spec.submit.success}
            onChange={(success) => kit.set(["submit", "success"], success)}
            mode="response"
            addLabel="Thêm điều kiện"
          />
        </FieldRow>
        <FieldRow label="Vị trí đơn hàng trong phản hồi" hint="Để trống nếu cả phản hồi là đơn hàng.">
          <PathInput
            value={spec.submit.orderPath}
            onChange={(value) => kit.set(["submit", "orderPath"], value)}
            mode="body"
            label="Vị trí đơn khi gửi đơn"
            placeholder="data"
          />
        </FieldRow>
        <FieldRow label="Thông báo lỗi nằm ở">
          <PathInput
            value={spec.submit.messagePath}
            onChange={(value) => kit.set(["submit", "messagePath"], value)}
            mode="response"
            label="Thông báo lỗi khi gửi đơn"
            placeholder="body.message"
          />
        </FieldRow>
        <FieldRow
          label="Khi gửi đơn không thành công"
          hint="Xét từ trên xuống, luật đầu tiên khớp được dùng. Không khớp luật nào: Hub coi là chưa rõ và tra cứu lại. Timeout luôn là chưa rõ."
        >
          <RulesEditor items={spec.submit.rules} onChange={(rules) => kit.set(["submit", "rules"], rules)} />
        </FieldRow>
        <JumpLink onClick={() => kit.reveal("submitApi")}>Xem API 3</JumpLink>
      </Section>

      <Section
        {...kit.section("queryResult")}
        summary={
          byOrders
            ? "Kiểm tra bằng danh sách đơn (API 5)"
            : `${spec.query.success.length} điều kiện thành công${spec.query.notFound.length > 0 ? " · có điều kiện không có đơn" : ""}`
        }
        title="4. Phản hồi kiểm tra trạng thái"
        description="Lỗi khi kiểm tra không bao giờ làm đơn thất bại; Hub chỉ kết luận theo trạng thái đơn."
      >
        {byOrders ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-subtle p-3 text-[13px] text-muted-foreground">
            Đang kiểm tra bằng danh sách đơn: Hub đọc theo mục 5. Phản hồi danh sách đơn.
            <JumpLink onClick={() => kit.reveal("ordersResult")}>Cách đọc danh sách đơn</JumpLink>
          </div>
        ) : (
          <>
            <FieldRow label="Tra cứu thành công khi" hint="Để trống = HTTP 2xx.">
              <ConditionsEditor
                items={spec.query.success}
                onChange={(success) => kit.set(["query", "success"], success)}
                mode="response"
                addLabel="Thêm điều kiện"
              />
            </FieldRow>
            <FieldRow label="Vị trí đơn hàng trong phản hồi">
              <PathInput
                value={spec.query.orderPath}
                onChange={(value) => kit.set(["query", "orderPath"], value)}
                mode="body"
                label="Vị trí đơn khi tra cứu"
                placeholder="data hoặc data.items"
              />
            </FieldRow>
            <FieldRow
              label="Trường chứa mã đơn của Hub"
              hint="Không bắt buộc. Có thì Hub kiểm tra đơn trả về đúng là đơn đã gửi."
            >
              <PathInput
                value={spec.query.matchField}
                onChange={(value) => kit.set(["query", "matchField"], value)}
                mode="order"
                bases={kit.orderBases}
                container={kit.orderContainer}
                label="Trường so khớp mã đơn"
                placeholder="requestId"
              />
            </FieldRow>
            <FieldRow label="Nhà cung cấp báo không có đơn khi" hint="Hub sẽ gửi lại đơn với cùng mã.">
              <ConditionsEditor
                items={spec.query.notFound}
                onChange={(notFound) => kit.set(["query", "notFound"], notFound)}
                mode="response"
                addLabel="Thêm điều kiện"
                emptyText="Chưa khai báo."
              />
            </FieldRow>
          </>
        )}
        <JumpLink onClick={() => kit.reveal("queryApi")}>Xem API 4</JumpLink>
      </Section>

      <Section
        {...kit.section("ordersResult")}
        state={spec.orders.enabled}
        summary={
          spec.orders.enabled
            ? `danh sách ở ${spec.orders.listPath || "(cả phản hồi)"} · so khớp ${spec.orders.matchField || "?"}`
            : "Nhà cung cấp không có API danh sách đơn"
        }
        title="5. Phản hồi danh sách đơn"
        description="Mỗi phần tử là một đơn, đọc trạng thái theo mục Trạng thái đơn. Dùng [*] cho từng đơn, vd data.items[*].requestId."
      >
        {spec.orders.enabled ? (
          <>
            <FieldRow label="Gọi thành công khi" hint="Để trống = HTTP 2xx.">
              <ConditionsEditor
                items={spec.orders.success}
                onChange={(success) => kit.set(["orders", "success"], success)}
                mode="response"
                addLabel="Thêm điều kiện"
              />
            </FieldRow>
            <FieldRow
              label="Vị trí danh sách đơn"
              hint="Vd data.items. Để trống thì Hub lấy từ các ô dạng data.items[*].x, hoặc cả phản hồi nếu nó là danh sách."
            >
              <PathInput
                value={spec.orders.listPath}
                onChange={(value) => kit.set(["orders", "listPath"], value)}
                mode="list"
                label="Vị trí danh sách đơn"
                placeholder="data hoặc data.items"
              />
            </FieldRow>
            <FieldRow
              label="Tìm đơn theo"
              hint="Theo mã nhà cung cấp: dùng mã đã lưu lúc tạo đơn (ô Mã đơn phía nhà cung cấp ở mục Trạng thái đơn). Đơn chưa có mã đó thì Hub tìm theo mã đơn Hub."
            >
              <SmallSelect
                value={spec.orders.matchBy}
                onChange={(matchBy) => kit.set(["orders", "matchBy"], matchBy)}
                options={MATCH_BY}
                labels={{
                  TRANS_CODE: "Mã đơn của Hub (requestId gửi đi)",
                  SUPPLIER_ID: "Mã đơn của nhà cung cấp (id)",
                }}
                ariaLabel="Tìm đơn trong danh sách theo"
                className="sm:w-96"
              />
            </FieldRow>
            <FieldRow label="Trường chứa mã đơn của Hub" hint="Bắt buộc: so khớp chính xác để tìm đúng đơn.">
              <PathInput
                value={spec.orders.matchField}
                onChange={(value) => kit.set(["orders", "matchField"], value)}
                mode="order"
                bases={[spec.orders.listPath]}
                container={kit.ordersContainer}
                label="Trường so khớp mã đơn (danh sách đơn)"
                placeholder="data.items[*].requestId"
              />
            </FieldRow>
            <FieldRow label="Thời điểm tạo đơn" hint="Không bắt buộc, để hiển thị.">
              <PathInput
                value={spec.orders.createdAt}
                onChange={(value) => kit.set(["orders", "createdAt"], value)}
                mode="order"
                bases={[spec.orders.listPath]}
                container={kit.ordersContainer}
                label="Thời điểm tạo đơn"
                placeholder="data.items[*].createdAt"
              />
            </FieldRow>
            <JumpLink onClick={() => kit.reveal("ordersApi")}>Xem API 5</JumpLink>
          </>
        ) : (
          <Disabled onEnable={() => kit.reveal("ordersApi")} />
        )}
      </Section>

      <Section
        {...kit.section("testResult")}
        summary={`${spec.test.success.length} điều kiện`}
        title="Phản hồi kiểm tra kết nối"
      >
        <FieldRow label="Kết nối được khi" hint="Để trống = HTTP 2xx.">
          <ConditionsEditor
            items={spec.test.success}
            onChange={(success) => kit.set(["test", "success"], success)}
            mode="response"
            addLabel="Thêm điều kiện"
          />
        </FieldRow>
        <JumpLink onClick={() => kit.reveal("testApi")}>Xem API kiểm tra kết nối</JumpLink>
      </Section>

      <Section
        {...kit.section("callbackResult")}
        state={spec.callback.enabled}
        summary={spec.callback.enabled ? `mã sự kiện ${spec.callback.eventId || "?"}` : "Chưa bật nhận callback"}
        title="Callback gửi về"
        description="Đọc callback nhà cung cấp gửi về: mã sự kiện, mã đơn và đơn hàng."
      >
        {spec.callback.enabled ? (
          <>
            <FieldRow
              label="Mã sự kiện"
              hint="Giữ nguyên khi gửi lại. Đọc header: headers.ten-header. Dùng || để dự phòng."
            >
              <PathInput
                value={spec.callback.eventId}
                onChange={(value) => kit.set(["callback", "eventId"], value)}
                mode="callback"
                label="Mã sự kiện callback"
                placeholder="body.eventId"
              />
            </FieldRow>
            <FieldRow label="Mã đơn của Hub">
              <PathInput
                value={spec.callback.transCode}
                onChange={(value) => kit.set(["callback", "transCode"], value)}
                mode="callback"
                label="Mã đơn trong callback"
                placeholder="body.data.requestId"
              />
            </FieldRow>
            <FieldRow label="Vị trí đơn hàng">
              <PathInput
                value={spec.callback.orderPath}
                onChange={(value) => kit.set(["callback", "orderPath"], value)}
                mode="callback"
                label="Vị trí đơn trong callback"
                placeholder="body.data"
              />
            </FieldRow>
            <FieldRow label="Chỉ nhận khi" hint="Để trống = nhận mọi callback.">
              <ConditionsEditor
                items={spec.callback.accept}
                onChange={(accept) => kit.set(["callback", "accept"], accept)}
                mode="callback"
                addLabel="Thêm điều kiện"
              />
            </FieldRow>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-subtle p-3 text-[13px] text-muted-foreground">
            Chưa bật nhận callback. Bật ở mục Callback trong tab Các API.
            <JumpLink onClick={() => kit.reveal("callbackApi")}>Bật callback</JumpLink>
          </div>
        )}
      </Section>
    </>
  );
}
