import type { Metadata } from "next";
import { RequirePermission } from "@/features/auth/require-permission";
import { MerchantsView } from "@/features/merchants/merchants-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Store" };

export default function MerchantsPage() {
  return (
    <RequirePermission
      policy={POLICIES.merchants.manage}
      description="Bạn cần quyền quản lý Store để truy cập trang này."
    >
      <MerchantsView />
    </RequirePermission>
  );
}
