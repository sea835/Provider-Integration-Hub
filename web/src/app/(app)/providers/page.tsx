import type { Metadata } from "next";
import { RequirePermission } from "@/features/auth/require-permission";
import { ProvidersView } from "@/features/providers/providers-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Đối tác" };

export default function ProvidersPage() {
  return (
    <RequirePermission
      policy={POLICIES.providers.view}
      description="Tài khoản của bạn chưa được cấp quyền xem đối tác và số dư."
    >
      <ProvidersView />
    </RequirePermission>
  );
}
