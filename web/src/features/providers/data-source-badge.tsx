import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { IS_PROVIDER_MOCK } from "./config";

export function DataSourceBadge() {
  if (!IS_PROVIDER_MOCK) return null;
  return (
    <Hint label="Backend chưa có API nhà cung cấp. Dữ liệu được mô phỏng trong trình duyệt; đặt NEXT_PUBLIC_PROVIDER_DATA_SOURCE=api khi backend sẵn sàng.">
      <span tabIndex={0} className="inline-flex rounded-full">
        <Badge tone="warning">
          <FlaskConical aria-hidden />
          Dữ liệu mô phỏng
        </Badge>
      </span>
    </Hint>
  );
}
