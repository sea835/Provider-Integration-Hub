import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/features/auth/require-permission";
import { HistoryView } from "@/features/balance-checks/history-view";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Lịch sử kiểm tra" };

export default function HistoryPage() {
  return (
    <RequirePermission
      policy={POLICIES.balanceChecks.view}
      description="Tài khoản của bạn chưa được cấp quyền xem lịch sử số dư."
    >
      <Suspense>
        <HistoryView />
      </Suspense>
    </RequirePermission>
  );
}
