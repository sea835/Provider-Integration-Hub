import { LockKey } from "@phosphor-icons/react/ssr";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";

const HIGHLIGHTS = [
  { title: "Giám sát theo thời gian thực", text: "Trạng thái kết nối và sức khỏe hệ thống luôn trong tầm mắt." },
  { title: "Đồng bộ chủ động", text: "Kích hoạt đồng bộ và kiểm tra kết nối chỉ với một thao tác." },
  { title: "Phân quyền chi tiết", text: "Ma trận quyền theo vai trò, áp dụng ngay trên giao diện." },
];

export function LoginView({ next, reason }: { next: string; reason: "expired" | "signed-out" | null }) {
  return (
    <div className="flex min-h-dvh items-center justify-center md:p-4">
      <div className="glass-frame grid min-h-dvh w-full max-w-[1040px] md:min-h-0 md:rounded-[28px] md:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-5">
        <section className="sidebar-surface hidden flex-col justify-between rounded-[20px] p-8 lg:flex">
          <Brand />
          <div className="space-y-7 py-10">
            <h2 className="font-display text-[36px] leading-[1.15] font-bold text-white">
              Một bảng điều khiển cho mọi tích hợp.
            </h2>
            <ul className="space-y-5">
              {HIGHLIGHTS.map(({ title, text }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#6fe35a]" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-[13px] leading-relaxed text-hero-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-hero-muted">
            <LockKey className="size-3.5" aria-hidden />
            Phiên đăng nhập được bảo vệ bằng cookie httpOnly
          </p>
        </section>

        <section className="flex flex-col px-5 pt-4 pb-8 md:p-0">
          <div className="flex items-center justify-between">
            <Brand className="lg:invisible" />
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[400px] rounded-xl bg-card p-5 text-card-foreground shadow-lift sm:p-6">
              <div className="mb-7 space-y-2">
                <h1 className="font-display text-[30px] leading-none font-bold">Đăng nhập</h1>
                <p className="text-sm text-muted-foreground">
                  Sử dụng tài khoản được quản trị viên cấp để truy cập bảng điều khiển.
                </p>
              </div>
              <LoginForm next={next} reason={reason} />
            </div>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-hero-muted lg:hidden">
            <LockKey className="size-3.5" aria-hidden />
            Phiên đăng nhập được bảo vệ bằng cookie httpOnly
          </p>
        </section>
      </div>
    </div>
  );
}
