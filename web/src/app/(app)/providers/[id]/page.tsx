import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/features/auth/require-permission";
import { ProviderDetailView } from "@/features/providers/provider-detail-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Chi tiết nhà cung cấp" };

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission
      policy={POLICIES.providers.view}
      description="Bạn cần quyền xem nhà cung cấp để truy cập trang này."
    >
      <Suspense>
        <ProviderDetailView id={id} />
      </Suspense>
    </RequirePermission>
  );
}
