"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";

const LABEL = "Đổi giao diện sáng / tối";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Hint label={LABEL} side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label={LABEL}
      >
        <Sun className="hidden dark:block" aria-hidden />
        <Moon className="block dark:hidden" aria-hidden />
      </Button>
    </Hint>
  );
}
