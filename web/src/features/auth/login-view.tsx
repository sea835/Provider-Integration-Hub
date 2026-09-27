import { Activity, KeyRound, LockKeyhole, RefreshCcw } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";
import { TopologyIllustration } from "./topology-illustration";

const HIGHLIGHTS = [
  {
    icon: Activity,
    title: "Giám sát theo thời gian thực",
    text: "Trạng thái kết nối và sức khỏe hệ thống luôn trong tầm mắt.",
  },
  { icon: RefreshCcw, title: "Đồng bộ chủ động", text: "Kích hoạt đồng bộ và kiểm tra kết nối chỉ với một thao tác." },
  { icon: KeyRound, title: "Phân quyền chi tiết", text: "Ma trận quyền theo vai trò, áp dụng ngay trên giao diện." },
];

export function LoginView({ next, reason }: { next: string; reason: "expired" | "signed-out" | null }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div
          className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          aria-hidden
        />
        <Brand className="relative" />
        <div className="relative flex justify-center py-8">
          <TopologyIllustration />
        </div>
        <div className="relative space-y-6">
          <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
            Một bảng điều khiển cho mọi tích hợp.
          </h2>
          <ul className="grid gap-4 xl:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="space-y-1.5">
                <Icon className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-medium">{title}</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col">
        <div className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Brand className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-8 space-y-2">
              <h1 className="text-[28px] font-semibold tracking-tight">Đăng nhập</h1>
              <p className="text-sm text-muted-foreground">
                Sử dụng tài khoản được quản trị viên cấp để truy cập bảng điều khiển.
              </p>
            </div>
            <LoginForm next={next} reason={reason} />
          </div>
        </div>
        <p className="flex items-center justify-center gap-1.5 px-5 pb-6 text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5" aria-hidden />
          Phiên đăng nhập được bảo vệ bằng cookie httpOnly
        </p>
      </section>
    </div>
  );
}
