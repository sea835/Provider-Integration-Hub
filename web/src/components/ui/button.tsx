import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotch } from "@phosphor-icons/react/ssr";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 ease-out-soft select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline: "bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-danger text-white shadow-xs hover:bg-danger/90",
        "destructive-ghost": "text-danger hover:bg-danger-soft",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
        inverse: "bg-hero-foreground text-hero shadow-xs hover:bg-hero-foreground/90",
        "inverse-ghost": "text-hero-foreground hover:bg-white/10",
      },
      size: {
        sm: "h-8 px-2.5 text-[13px]",
        default: "h-9 px-3.5",
        lg: "h-10 px-4",
        icon: "size-9 pointer-coarse:size-11",
        "icon-sm": "size-8 pointer-coarse:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <CircleNotch className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
