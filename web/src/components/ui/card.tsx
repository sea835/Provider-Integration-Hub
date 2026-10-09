import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, tone = "subtle", ...props }: ComponentProps<"div"> & { tone?: "subtle" | "plain" }) {
  return (
    <div
      className={cn("rounded-lg text-card-foreground", tone === "subtle" ? "bg-card" : "bg-transparent", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-3 px-4 pt-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-[15px] leading-tight font-bold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-1 text-[13px] leading-snug text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3 px-4 py-2.5", className)} {...props} />;
}
