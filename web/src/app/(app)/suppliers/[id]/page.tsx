import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/features/auth/require-permission";
import { SupplierDetailView } from "@/features/suppliers/supplier-detail-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Chi tiết nhà cung cấp" };

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission
      policy={POLICIES.suppliers.manage}
      description="Bạn cần quyền quản lý nhà cung cấp để truy cập trang này."
    >
      <Suspense>
        <SupplierDetailView id={id} />
      </Suspense>
    </RequirePermission>
  );
}
