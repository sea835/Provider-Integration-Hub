import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative w-full scrollbar-thin overflow-x-auto">
      <table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:nth-child(odd)]:bg-subtle", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("transition-colors duration-150 hover:bg-accent/70 data-[state=selected]:bg-accent", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-2.5 align-middle first:pl-4 last:pr-4", className)} {...props} />;
}
