import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessView } from "@/features/access/access-view";
import { RequirePermission } from "@/features/auth/require-permission";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Phân quyền" };

export default function AccessPage() {
  return (
    <RequirePermission
      policy={POLICIES.access.manage}
      description="Chỉ quản trị viên toàn hệ thống mới quản lý được vai trò và quyền hạn."
    >
      <Suspense>
        <AccessView />
      </Suspense>
    </RequirePermission>
  );
}
