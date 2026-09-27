import type { Metadata } from "next";
import { RequirePermission } from "@/features/auth/require-permission";
import { ProvidersView } from "@/features/providers/providers-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Nhà cung cấp" };

export default function ProvidersPage() {
  return (
    <RequirePermission
      policy={POLICIES.providers.view}
      description="Bạn cần quyền xem nhà cung cấp để truy cập trang này."
    >
      <ProvidersView />
    </RequirePermission>
  );
}
