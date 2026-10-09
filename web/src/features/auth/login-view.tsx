import { LockKey } from "@phosphor-icons/react/ssr";
import { Brand, BrandMark } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";

const HIGHLIGHTS = [
  { title: "Giám sát theo thời gian thực", text: "Trạng thái kết nối và sức khỏe hệ thống luôn trong tầm mắt." },
  { title: "Đồng bộ chủ động", text: "Kích hoạt đồng bộ và kiểm tra kết nối chỉ với một thao tác." },
  { title: "Phân quyền chi tiết", text: "Ma trận quyền theo vai trò, áp dụng ngay trên giao diện." },
];

export function LoginView({ next, reason }: { next: string; reason: "expired" | "signed-out" | null }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="hero-glow relative hidden overflow-hidden bg-hero text-hero-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="flex items-center gap-2.5">
          <BrandMark className="[&_circle]:fill-hero [&_path]:stroke-hero [&_rect]:fill-hero-foreground" />
          <span className="font-display text-[16px] font-extrabold">Provider Hub</span>
        </div>
        <div className="max-w-xl space-y-10">
          <h2 className="font-display text-5xl leading-[1.05] font-extrabold xl:text-[56px]">
            Một bảng điều khiển cho mọi tích hợp.
          </h2>
          <ul className="grid gap-5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            {HIGHLIGHTS.map(({ title, text }) => (
              <li key={title} className="space-y-1.5">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-[13px] leading-relaxed text-hero-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col">
        <div className="flex h-14 items-center justify-between px-5 sm:px-8">
          <Brand compact className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-[360px]">
            <div className="mb-7 space-y-2">
              <h1 className="font-display text-[34px] leading-none font-extrabold">Đăng nhập</h1>
              <p className="text-sm text-muted-foreground">
                Sử dụng tài khoản được quản trị viên cấp để truy cập bảng điều khiển.
              </p>
            </div>
            <LoginForm next={next} reason={reason} />
          </div>
        </div>
        <p className="flex items-center justify-center gap-1.5 px-5 pb-5 text-xs text-muted-foreground">
          <LockKey className="size-3.5" aria-hidden />
          Phiên đăng nhập được bảo vệ bằng cookie httpOnly
        </p>
      </section>
    </div>
  );
}
