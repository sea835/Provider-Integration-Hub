"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Sao chép" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`${label}: ${value}`}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Đã chép" : label}
    </Button>
  );
}
