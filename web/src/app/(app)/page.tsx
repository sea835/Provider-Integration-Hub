import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Bảng điều khiển" };

export default function DashboardPage() {
  return <DashboardView />;
}
