import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/features/auth/require-permission";
import { UsersView } from "@/features/users/users-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Người dùng" };

export default function UsersPage() {
  return (
    <RequirePermission
      policy={POLICIES.users.view}
      description="Chỉ tài khoản có quyền quản lý người dùng mới xem được danh sách này."
    >
      <Suspense>
        <UsersView />
      </Suspense>
    </RequirePermission>
  );
}
