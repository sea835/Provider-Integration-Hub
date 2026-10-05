import type { Metadata } from "next";
import { RequirePermission } from "@/features/auth/require-permission";
import { SuppliersView } from "@/features/suppliers/suppliers-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Nhà cung cấp" };

export default function SuppliersPage() {
  return (
    <RequirePermission
      policy={POLICIES.suppliers.manage}
      description="Bạn cần quyền quản lý nhà cung cấp để truy cập trang này."
    >
      <SuppliersView />
    </RequirePermission>
  );
}
