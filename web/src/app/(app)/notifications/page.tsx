import type { Metadata } from "next";
import { TelegramView } from "@/features/alert-channels/telegram-view";
import { RequirePermission } from "@/features/auth/require-permission";
import { POLICIES } from "@/lib/auth/policies";

export const metadata: Metadata = { title: "Kênh thông báo" };

export default function NotificationsPage() {
  return (
    <RequirePermission
      policy={POLICIES.alertChannels.view}
      description="Chỉ tài khoản được cấp quyền mới xem được cấu hình kênh thông báo."
    >
      <TelegramView />
    </RequirePermission>
  );
}
