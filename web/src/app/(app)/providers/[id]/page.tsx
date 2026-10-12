import type { Metadata } from "next";
import { RequirePermission } from "@/features/auth/require-permission";
import { ProviderDetailView } from "@/features/providers/provider-detail-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Cấu hình đối tác" };

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission
      policy={POLICIES.providers.view}
      description="Tài khoản của bạn chưa được cấp quyền xem đối tác và số dư."
    >
      <ProviderDetailView id={id} />
    </RequirePermission>
  );
}
