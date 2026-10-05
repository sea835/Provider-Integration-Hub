import type { Metadata } from "next";
import { RequirePermission } from "@/features/auth/require-permission";
import { MerchantDetailView } from "@/features/merchants/merchant-detail-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Chi tiết Store" };

export default async function MerchantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission
      policy={POLICIES.merchants.manage}
      description="Bạn cần quyền quản lý Store để truy cập trang này."
    >
      <MerchantDetailView id={id} />
    </RequirePermission>
  );
}
